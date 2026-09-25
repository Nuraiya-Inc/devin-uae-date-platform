#!/bin/sh
# =============================================================
# Boot script — runs on container start.
#
# Order of operations:
#   1. Wait for the database to accept connections (up to 60s).
#   2. If prisma/migrations/ exists with content → `migrate deploy`
#      (an existing db-push database is baselined once, automatically).
#   3. Otherwise → `db push` (first-deploy bootstrap).
#   4. Start the Next.js standalone server.
#
# POSIX-sh compatible (no bash-isms — alpine /bin/sh is dash).
# The seed (npm run db:seed) is NOT auto-run; the operator runs it once
# from the Coolify terminal after first deploy. Idempotent, safe to repeat.
# =============================================================

set -e

# Wait up to ~60s for the database. We use a pipe (not `<<<`) for POSIX
# compatibility, and pipe a trivial SELECT 1 through `prisma db execute`.
echo "[boot] Waiting for database..."
i=0
while [ "$i" -lt 30 ]; do
  if echo "SELECT 1;" | npx prisma db execute --stdin >/dev/null 2>&1; then
    echo "[boot] Database reachable."
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$i" -eq 30 ]; then
  echo "[boot] WARNING: database did not become reachable in 60s. Attempting schema sync anyway."
fi

# Schema sync — `migrate deploy` if migrations directory has content,
# else `db push` (first-ever deploy bootstrap).
if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "[boot] Running prisma migrate deploy..."
  if ! out=$(npx prisma migrate deploy 2>&1); then
    echo "$out"
    # P3005 = database was created by `db push` (pre-migrations era) and has
    # no migration history. Baseline it once: sync additively (no
    # --accept-data-loss, so anything destructive aborts the boot), then mark
    # every existing migration as applied. Later deploys take the normal path.
    if echo "$out" | grep -q "P3005"; then
      echo "[boot] Existing database without migration history — baselining..."
      npx prisma db push --skip-generate
      for m in prisma/migrations/*/; do
        name=$(basename "$m")
        echo "[boot] Marking migration $name as applied"
        npx prisma migrate resolve --applied "$name"
      done
      npx prisma migrate deploy
    else
      exit 1
    fi
  else
    echo "$out"
  fi
else
  echo "[boot] No migrations directory found — running prisma db push (first deploy)..."
  npx prisma db push --accept-data-loss --skip-generate
fi

echo "[boot] Database ready. Starting Next.js server."
exec node server.js
