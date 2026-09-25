# Devin Task 00 — Boot the app (do this first, nothing else)

Repository: `Nuraiya-Inc/devin-uae-date-platform` (branch `main`).

Your ONLY goal in this task is to get the existing application installing, building, and booting in your dev environment, and to confirm its health endpoint responds. Do NOT add features, refactor, change the schema, or "improve" anything. If something is broken, fix the minimum needed to boot and report exactly what you changed.

## Stack (for your reference)
- Next.js 15.5 (App Router, `output: 'standalone'`), React 19, TypeScript, Node 20.
- Prisma 5.22 + PostgreSQL. NextAuth v5 (beta). Anthropic SDK.

## Environment variables to set (use throwaway DEV values, never production secrets)
- `DATABASE_URL` — a Postgres database you can reach
- `AUTH_SECRET` — any random 32+ char string
- `NEXTAUTH_URL` — `http://localhost:3000`
- `AUTH_TRUST_HOST` — `true`
- `ANTHROPIC_API_KEY` — a dev key (the app boots without a valid one; AI chat just won't answer)
- `OPENAI_API_KEY` — optional (voice transcription only); leave unset is fine

## Steps
1. Clone the repo and install dependencies (`npm ci`, fall back to `npm install --legacy-peer-deps` if the lockfile drifts).
2. Run `npx prisma generate`.
3. Create the database schema: `npx prisma db push`.
4. Start the app in dev mode: `npm run dev` (listening on port 3000).
5. In the browser tool, open `http://localhost:3000/api/health` and confirm it returns a healthy response.
6. Open `http://localhost:3000` and confirm the app renders (a login or landing page).
7. Separately confirm a production build succeeds: `npm run build` (standalone output, no build errors).

## Acceptance criteria (all must pass)
- [ ] `npm run build` completes with no errors.
- [ ] The dev server starts and `GET /api/health` returns a healthy/ok response.
- [ ] The home page renders in the browser without a server error.
- [ ] You report: exact commands run, any file you had to change to boot, and the final env var list (names only, not values).

Do not open a PR for this task unless you changed a file to make it boot; if you did, open a PR with only those minimal changes and list them.
