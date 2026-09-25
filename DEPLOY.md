# Deploy — devin.nuraiya.ai

Target: Coolify v4 (Traefik). This app deploys as a **separate Coolify app with
its own Postgres** — zero contact with any other app or database on the box.

## 0. DNS (do first)

`devin.nuraiya.ai` → A record → the Coolify VPS public IP (grey cloud if
behind Cloudflare — Traefik terminates TLS itself).

## 1. Coolify — Postgres

Coolify → your project → **+ New → Database → PostgreSQL**
- Name: `upn-db` · database `upn` · user `upn`
- Start it, copy the **internal** connection string.

## 2. Coolify — the app

**+ New → Application → Private repository** → `Nuraiya-Inc/devin-uae-date-platform`,
branch `main`, Build Pack: **Dockerfile**.

- **Resources:** set memory limit 4–6 GB (Next.js build needs it).
- **Environment variables** (verify each one saved — the env UI can be flaky):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the internal Postgres URL from step 1 |
| `AUTH_SECRET` | fresh: `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | a dedicated key for this platform |
| `CRON_SECRET` | fresh random string |
| `SEED_CEO_EMAIL` | nima.vakili@kmigroup.com |
| `SEED_CEO_NAME` | Nima Vakili |
| `SEED_CEO_PASSWORD` | fresh — never reuse another platform's |

- **Domain:** `https://devin.nuraiya.ai`
  The image's CMD exports NEXTAUTH_URL/AUTH_URL for this domain — if you
  change the domain, edit the CMD line in the Dockerfile too (and set
  `CANONICAL_URL` to override `src/lib/auth.ts`'s production default).
- Optional: enable the GitHub webhook so every push to `main` auto-deploys.

## 3. First boot

Deploy. Schema applies automatically at boot (`prisma db push` in
`prisma/boot.sh`). Then open the app's **Terminal**:

```bash
npm run db:seed                      # admin + demo official/partner, agents, baseline
npm run db:seed-demo                 # demo partners + 4 quarters of history
npx tsx scripts/seed-directory.ts    # 232-entry value-chain directory
```

Logins: admin = SEED_CEO_EMAIL/PASSWORD · official demo.official@uaepalm.ae
(`<pw>-upn`) · partner demo.farm@partners.uaepalm.ae (`<pw>-farm`).

## 4. Scheduled task

Coolify → app → Scheduled Tasks → name `standing-review`, frequency `0 4 * * 1`:

```
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/standing-review
```

## 5. Verify

`https://devin.nuraiya.ai/api/health` → `{"status":"ok"}`. Sign in, check
`/directory` (232 entries, staff-only), `/partners`, `/dashboard`. Phone:
`/portal` in Arabic RTL with the عربي|EN toggle; membership card; certificate
downloads. `npm run demo:reset` between demo rehearsals.

---

**Alternative:** `docker-compose.yml` deploys app + Postgres as a single
compose resource instead of two separate ones — same env vars, `db` service
handles Postgres. Use whichever the Coolify project convention prefers.
