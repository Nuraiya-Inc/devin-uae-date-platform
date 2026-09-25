# UAE Palm Network — Devin Build Pack

**Purpose:** a single, ordered handoff that lets Devin (a) replicate the platform skeleton and (b) add the Safa BioWorks value-chain network directory (232 real entities), cleanly and verifiably.

**How to use this pack.** Give Devin four things: this file, the architecture spec (*UAE Palm Network — System Architecture Specification*), the reference repo `Nuraiya-Inc/devin-uae-date-platform`, and the three asset files in this pack (`prisma-directory-module.prisma`, `seed-directory.ts`, `directory-data.json`). Then run the tasks below **in order**, one at a time, checking each task's acceptance criteria before starting the next. Do not batch tasks; Devin does best with one scoped task and clear "done" criteria, and badly with mid-task scope changes.

> Two paths, pick one before you start:
> - **Fast clean launch (recommended for today):** point Devin at the reference repo and have it *replicate + extend*. Fastest, lowest risk, demoable today.
> - **From-scratch bake-off:** give Devin the spec + this pack but **not** the code, and have it build fresh. Higher risk, only if the hackathon requires a true independent build.

---

## Part 0 — One-time Devin setup (do before any task)

1. **Connect the repo.** Give Devin GitHub access to `Nuraiya-Inc/devin-uae-date-platform`.
2. **Provision the environment (Devin's Machine).** Node 20, a Postgres it can reach, and the env vars from the reference repo (`DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `ANTHROPIC_API_KEY`, optional `OPENAI_API_KEY`). Use throwaway dev secrets, not production keys.
3. **First job = boot only.** Before any feature: "install deps, run `prisma generate`, run `next build`, start the app, confirm `GET /api/health` returns ok." Do not proceed until the app builds and boots.
4. **Load the standing rules (Part 1) into Devin Knowledge** so every task inherits them.

## Part 1 — Standing rules (paste into Devin "Knowledge")

These are non-negotiable and must hold across every task:

- **UPN-2 (draft, not authority):** agents may only *create* an `ApprovalRequest`; tier/certification/registry/publication changes are applied by a human via a separate route. Never let an agent apply one directly.
- **UPN-3 (confidentiality + aggregation floor):** never expose one partner's figures to another; every aggregate requires ≥ 3 partners (`MIN_AGGREGATE = 3`), enforced in code, not just prompts.
- **UPN-7 (baseline honesty):** only Abu Dhabi's sector baseline is surveyed; all other emirates are **indicative** placeholders. Never render indicative data as measured.
- **ESG honesty:** all carbon/ESG figures are **indicative estimates** from a stated factor, never audited.
- **UPN-1 (neutrality):** the platform is neutral infrastructure. Do not favor the technology/operating partner in shared/public surfaces. (Directly relevant to the directory module — see TD1.)
- **Arabic-first** partner communications; Latin numerals in both languages.
- **Authority lives in the tool layer, not the prompt.** Agents affect the world only through tool executors that enforce identity, approval, and aggregation.

---

## Part 2 — Platform skeleton (build order)

Build bottom-up. Each task lists Goal, Files/context, and Acceptance criteria. Full detail for each layer is in the architecture spec sections noted.

### T1 — Database schema (core domain) — *spec §4*
- **Goal:** stand up the core Prisma schema: `Partner`, `QuarterlyReport`, `ProductionRecord`, `WasteRecord`, `MaterialTransfer`, `TierEvent`, `RegionBaseline`, plus enums (`Region` = 7 emirates, `PartnerType`, `PartnerTier`, `PartnerStanding`, `ReportPeriodStatus`, `WasteStream`, `WasteFate`).
- **Acceptance:** `prisma migrate` applies clean; `(partnerId, year, quarter)` is unique; cascade deletes work; indexes from §4 present.

### T2 — Auth + access model — *spec §5, §7*
- **Goal:** NextAuth v5 (JWT sessions), credentials + bcrypt (cost 12), role/branch access in `access.ts`, `resolvePartner()` locking portal users to their own record.
- **Acceptance:** login works via server-action `signIn`; a partner user cannot read another partner's record; official/staff roles gated.

### T3 — Facts engine — *spec §1, §6*
- **Goal:** port `src/facts/index.ts`: taxonomy, 7-emirate baseline (Abu Dhabi surveyed; others indicative), tier ladder, hard rules UPN-1..9, and `buildCachedPrefix()`.
- **Acceptance:** the cached prefix builds; only Abu Dhabi is flagged surveyed; validators pass.

### T4 — Tool catalog (governance boundary) — *spec §3, §6*
- **Goal:** the 25 tools as `{name, description, input_schema}` + executors with `resolvePartner`, `audit`, `err`. Agents reach the DB only through here.
- **Acceptance:** `request_tier_change` creates an `ApprovalRequest` and does **not** change a tier; a 1–2-partner aggregate returns suppressed.

### T5 — Agent runtime (bounded loop + caching) — *spec §3, §5*
- **Goal:** the chat route `POST /api/agents/[slug]/chat`: bounded tool-use loop, prompt caching (`cache_control: ephemeral` on the facts+prompt prefix), transparency payload, attachment handling (vision), model fallback chain.
- **Acceptance:** caps enforced (`MAX_TOOL_ROUNDS=10`, `MAX_CONSULTATIONS_PER_TURN=3`, `MAX_CONSULT_DEPTH=2`, `MAX_OUTPUT_TOKENS_PER_ROUND=16384`, `MAX_ATTACHMENTS_PER_TURN=8`, `MAX_TOTAL_ATTACHMENT_BYTES=80MB`); response returns `{threadId, content, transparency}`.

### T6 — The 7 agents — *spec §3*
- **Goal:** port the agent specs: `abd-00` (Abdullah, orchestrator, partner-facing) + `int/val/ana/cer/eng/reg-01`. Per-agent tool assignment via `toolsForAgent()`.
- **Acceptance:** partners only reach Abdullah; Abdullah can `consult_agent` a backend agent and answer in his own voice; Arabic-first default.

### T7 — Partner portal + official dashboard — *spec §2*
- **Goal:** the UI: partner chat/portal, official registry, approval queue, activity feed. Bilingual, RTL.
- **Acceptance:** a partner completes a quarterly report through Abdullah; an official approves a drafted change in the queue; instant value returned on submission (summary + benchmark + one insight).

### T8 — ESG / sector report / impact showcase — *spec §2, §6*
- **Goal:** `esg.ts` (indicative factor, 0–100 ESG score, Net Zero 2050 context), `sector-report.ts`, `impact-map.ts`, public `/showcase` (≥3 suppression), "Ask the Sector" (ana-01).
- **Acceptance:** ESG figures labeled indicative; sub-3 metrics suppressed on the public map; state-of-sector prints.

---

## Part 3 — Value-chain directory module (the new work)

Adds Safa BioWorks' established network of 232 value-chain entities as a **separate layer** from `Partner`, with a promotion path. This is what "make the database more robust" means, done without corrupting partner aggregates.

### TD1 — Add the DirectoryEntry model — *asset: `prisma-directory-module.prisma`*
- **Goal:** add `DirectoryEntry` + enums (`ValueChainStage`, `DirectoryPriority`, `ConfidenceLevel`, `RelationshipStatus`) and the optional `partnerId` promotion link. Add the back-relation `directoryEntry DirectoryEntry?` to `Partner`.
- **Why separate:** `DirectoryEntry` is **never** counted in participation rates, benchmarks, the sector report, or ESG math. Only `Partner` rows are. This keeps UPN-7 honesty intact.
- **Neutrality (UPN-1):** the `safaRelevance` field and the contact block are **staff-only** — never surface them on the neutral/public impact map or showcase.
- **Acceptance:** migration applies clean; `DirectoryEntry` has no relation that feeds any partner aggregate; `partnerId` is unique and nullable.

### TD2 — Import the 232 entries — *assets: `seed-directory.ts`, `directory-data.json`*
- **Goal:** place `directory-data.json` at `prisma/data/directory-data.json` and `seed-directory.ts` at `scripts/seed-directory.ts`; run `npx tsx scripts/seed-directory.ts`.
- **Mapping (handled by the script):** stage string → `ValueChainStage`; `tier` → `DirectoryPriority`; `confidence` → `ConfidenceLevel`; single emirate → `Region` (else null + `emirateLabel`); `sources` split on `" | "`.
- **Acceptance:** 232 rows imported, 0 skipped; counts match — 90 High / 83 Medium / 59 Low confidence; stages: 57 Growers, 57 Ecosystem, 55 Traders, 37 Waste, 22 Processors, 4 Buyers. Re-running the seed does not duplicate.

### TD3 — Directory browse UI (staff)
- **Goal:** a staff-only `/directory` page: searchable list filtered by stage, emirate, priority, confidence, and relationship status; entry detail shows contact block + sources + `safaRelevance`.
- **Acceptance:** filters work; page is behind staff auth; not linked from partner or public nav.

### TD4 — Promotion to Partner
- **Goal:** a staff action "Register this entry as a partner" that creates a `Partner` (with a new registry number), sets `DirectoryEntry.relationship = REGISTERED`, and links `partnerId`. Follows UPN-2 if any tier/certification is involved (drafted, approved).
- **Acceptance:** promoting an entry creates exactly one `Partner`, links it, and the entry stops appearing as an un-engaged prospect; aggregates now include the new partner (and only after promotion).

---

## Part 4 — Parity checklist (test both builds against behavior, not screenshots)

- [ ] UPN-2: "promote this partner to CERTIFIED" creates an `ApprovalRequest`, does not change the tier.
- [ ] UPN-3: a 1–2-partner aggregate returns suppressed; no cross-partner data leak.
- [ ] UPN-7: a Dubai/Sharjah figure is labeled indicative; only Abu Dhabi shown as surveyed.
- [ ] ESG: carbon numbers stated as indicative estimates with the factor named.
- [ ] Intake: Arabic-numeral ledger photo read via vision; voice note transcribed; messy Excel mapped without reformatting.
- [ ] UPN-6: returning partner greeted by name, not re-asked known facts.
- [ ] UPN-5: default partner replies Arabic, warm-formal, Latin numerals.
- [ ] Runtime caps enforced; consult depth ≤ 2.
- [ ] Orchestration: Abdullah consults a backend agent; partner never sees it.
- [ ] Instant value on every submission (summary + benchmark + insight).
- [ ] Transparency payload reports tools used + agents consulted.
- [ ] **Directory:** 232 entries imported; none counted in partner aggregates until promoted; `safaRelevance`/contacts never on public surfaces.

---

## Appendix — files in this pack

| File | Put it at | Purpose |
| --- | --- | --- |
| `DEVIN_BUILD_PACK.md` | (hand to Devin) | This handoff |
| `prisma-directory-module.prisma` | merge into `prisma/schema.prisma` | The directory model + enums |
| `seed-directory.ts` | `scripts/seed-directory.ts` | Import script with field mapping |
| `directory-data.json` | `prisma/data/directory-data.json` | The 232 researched entries |

Also hand Devin: the architecture spec (*UAE Palm Network — System Architecture Specification*) and repo access to `Nuraiya-Inc/devin-uae-date-platform`.
