# Deploy — uae.safabioworks.com

Target: the existing Hostinger VPS (Coolify v4, Traefik). This app deploys as a
**separate Coolify app with its own Postgres** — zero contact with any other
app or database on the box.

## 1. Coolify — Postgres

Coolify → your project → **+ New → Database → PostgreSQL**
- Name: `upn-db` · database `upn` · user `upn`
- Start it, copy the **internal** connection string.

## 2. Coolify — the app

**+ New → Application → Private repository** → `safabioworks/uae-date-platform`,
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

- **Domain:** `https://uae.safabioworks.com`
  (Cloudflare: A record `uae` → the VPS IP, grey cloud.)
  The image's CMD exports NEXTAUTH_URL/AUTH_URL for this domain — if you
  choose a different domain, edit the CMD line in the Dockerfile too.
- Optional: enable the GitHub webhook so every push to `main` auto-deploys.

## 3. First boot

Deploy. Schema applies automatically at boot. Then open the app's **Terminal**:

```bash
npm run db:seed        # admin + demo official/partner users, agents, baseline
npm run db:seed-demo   # 10 demo partners, 4 quarters of history
```

Logins: admin = SEED_CEO_EMAIL/PASSWORD · official demo.official@uaepalm.ae
(`<pw>-upn`) · partner demo.farm@partners.uaepalm.ae (`<pw>-farm`).

## 4. Scheduled task

Coolify → app → Scheduled Tasks → name `standing-review`, frequency `0 4 * * 1`:

```
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/standing-review
```

## 5. Verify

Phone: `/portal` in Arabic RTL with the عربي|EN toggle; membership card;
certificate downloads with the annual seal. Laptop: console dashboard,
Standings, Next Phase. `npm run demo:reset` between demo rehearsals.
