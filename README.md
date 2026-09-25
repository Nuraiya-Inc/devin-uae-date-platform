# UAE Palm Network — Platform

Multi-agent partner platform for the **UAE date-palm ecosystem** — the
**UAE Palm Network** (operating partner Nuraiya · technology partner Safa
BioWorks FZE). Positions the network as the home of the date palm
ecosystem: membership, certification, incentives, and recognition flow through one
partner identity, and quarterly reporting is the price of belonging.

**Operating principle:** prestige → benefits → membership → reporting → data →
insight → more prestige to distribute. The platform converts modeled
estimates (uniform 10% loss, ~20 kg/tree coefficients) into measured national data.

## Agent roster (v0 — 7 agents)

```
ABD-00  Abdullah — Agentic Director  ← the only agent partners ever meet
├─ INT-01  Intake & Polishing   (Excel/ledger photos/voice → schema records)
├─ VAL-01  Validation           (plausibility vs priors + history; confidence scores)
├─ ANA-01  Analytics            (coverage map, benchmarks — min 3 partners per aggregate)
├─ CER-01  Certification & Tiers (standing engine; drafts only — officials approve)
├─ ENG-01  Engagement           (honor-based campaigns, regional standings, reminders)
└─ REG-01  Registry             (national registry; public changes via approval queue)
```

## The flow

1. A partner talks to Abdullah (web chat now, WhatsApp in Sprint 3) and hands over
   whatever they have — an Excel in any layout, a photo of a paper ledger, a voice note.
2. Abdullah extracts, confirms (never interrogates), records production + waste
   records against the national schema, and submits.
3. VAL-01 scores the report against regional priors, the partner's own history, and
   physical plausibility. Clean → VALIDATED; questions → RETURNED (kindly).
4. Network staff approve VALIDATED reports; approved data feeds the live national
   dashboard (measured vs modeled coverage per region).
5. CER-01 recomputes tier eligibility; tier changes land in the approvals queue —
   **agents draft, officials decide** (hard rule UPN-2).

## Domain model

Partner (registry no, type, region, tier, standing, profile memory) ·
QuarterlyReport (DRAFT→SUBMITTED→VALIDATED→APPROVED / RETURNED) ·
ProductionRecord · WasteRecord (stream × fate × tons, destination for traceability) ·
MaterialTransfer (farm-outbound ↔ recycler-inbound reconciliation) · TierEvent ·
RegionBaseline (public sources + flagged indicative allocations; seeded as
validation priors).

## Stack

Next.js 15 App Router + TypeScript · Prisma 5.22 + Postgres · NextAuth v5 ·
Anthropic SDK (per-agent system prompts, bounded tool catalog, prompt-cached
UPN fact-graph prefix) · exceljs/mammoth/sharp/Whisper intake · pdfkit/docx
generators · Docker/Coolify deploy.

Forked from the Safa BioWorks platform architecture (same runtime patterns:
approval queue, audit log, cron locks, document pipeline). All Safa data,
facts, and history removed — fresh git history.

## Run locally

```bash
npm install
cp .env.example .env   # set DATABASE_URL, AUTH secrets, ANTHROPIC_API_KEY, SEED_CEO_PASSWORD
docker compose up -d db
npx prisma db push
npm run db:seed
npm run dev            # → http://localhost:3000
```

Seeded logins (rotate immediately):
- Admin: SEED_CEO_EMAIL / SEED_CEO_PASSWORD
- Network demo official: demo.official@uaepalm.ae / <SEED_CEO_PASSWORD>-upn
- Demo partner (Al Ain Heritage Farm, Abu Dhabi): demo.farm@partners.uaepalm.ae / <SEED_CEO_PASSWORD>-farm

## Deploy

See **DEPLOY.md** — Coolify steps for uae.safabioworks.com (own app + own Postgres).

## Data handling

Only Abu Dhabi's baseline is surveyed (ADAFSA, reported 2024). The other
emirates' rows are explicitly flagged indicative placeholders — never quote
them externally; network-measured data replaces them.
