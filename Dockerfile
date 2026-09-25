# =============================================================
# Safa BioWorks platform — multi-stage Dockerfile
# Optimised for Coolify on a single VPS.
# =============================================================

# ---------- 1. deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma needs OpenSSL on alpine
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
# `--ignore-scripts` skips our own postinstall (`prisma generate`) — the
# Prisma schema isn't copied in this stage. The Prisma client is generated
# explicitly in the builder stage below.
RUN if [ -f package-lock.json ]; then \
      npm ci --no-audit --no-fund --ignore-scripts \
        || (echo "[deps] npm ci failed (lockfile drift) — falling back to npm install" \
            && npm install --no-audit --no-fund --legacy-peer-deps --ignore-scripts); \
    else \
      npm install --no-audit --no-fund --legacy-peer-deps --ignore-scripts; \
    fi

# ---------- 2. build ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules

# Cache buster — change this string to force Docker to rebuild from this layer.
# Bump when stale cached layers are causing chunk hash mismatches or missing
# files (e.g. public/ assets that were added in a recent commit but don't
# appear in the deployed container).
ARG CACHE_BUSTER=2026-05-16-fix-public-mp3
RUN echo "Cache busted at: $CACHE_BUSTER"

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Cap Node heap to keep the build from getting OOM-killed on small VPSes.
# Bumped 2 GB → 3 GB after the codebase grew (review workflow, account
# page, morning digest, new agent tools) and 2 GB started getting tight.
# Build only — runtime container does not set NODE_OPTIONS, so the running
# app still uses Node defaults (~1.5 GB) and leaves headroom for Postgres /
# Traefik on a 4 GB Hostinger box.
ENV NODE_OPTIONS="--max-old-space-size=3072"

# Generate Prisma client + build Next.js (standalone output)
RUN npx prisma generate
RUN npm run build

# ---------- 3. runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini wget curl \
    && addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs \
    && npm install -g tsx@4.19.2

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Hardcode auth URL — Coolify env var management has been inconsistent.
# These values get burned into the runtime image and override anything
# Coolify tries (or fails) to pass at deploy time.
ENV NEXTAUTH_URL=https://devin.nuraiya.ai
ENV AUTH_URL=https://devin.nuraiya.ai
ENV AUTH_TRUST_HOST=true

# Standalone output bundles only what's needed at runtime
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma engines + CLI + schema for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Seed script needs the source (it imports src/lib/agents)
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Operator scripts (run via `npx tsx scripts/...` from Coolify terminal —
# e.g. seed-channels, password resets, one-off DB ops).
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# bcryptjs is required at runtime (seed + credentials provider). Next.js
# sometimes tree-shakes it out of the standalone trace when reachable from
# middleware (Edge runtime).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

ENV PATH="/app/node_modules/.bin:${PATH}"

# Boot script: db push on first deploy, migrate deploy on subsequent
RUN chmod +x ./prisma/boot.sh

# Persistent volume for uploaded documents. In Coolify, attach a Persistent
# Storage entry mounted at /app/uploads so files survive redeploys.
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads
VOLUME ["/app/uploads"]

USER nextjs
EXPOSE 3000

# tini = clean PID 1, so SIGTERM is forwarded properly
ENTRYPOINT ["/sbin/tini", "--"]
# Force-override auth URLs at startup BEFORE boot.sh runs. This wins against
# whatever Coolify passes via docker -e, because exports inside the shell
# replace the parent env for all child processes. Hard-codes the canonical
# URL so login redirects always go to the real domain.
CMD ["sh", "-c", "export NEXTAUTH_URL=https://devin.nuraiya.ai; export AUTH_URL=https://devin.nuraiya.ai; export AUTH_TRUST_HOST=true; exec ./prisma/boot.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
