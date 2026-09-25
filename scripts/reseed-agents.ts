/**
 * Targeted agent re-seed — refreshes ONLY the agent definitions
 * (system prompts, daily-run briefs, tools, mission, KPIs, etc.) from the
 * specs in src/lib/agents into the live database.
 *
 * Why this exists: agent prompts live in the Agent table (seeded from the
 * spec files), and the runtime reads them from the DB. Editing the .ts spec
 * files and deploying does NOT change the live prompts until the DB is
 * refreshed. The full `npm run db:seed` is unsafe to re-run (it .create()s
 * RAID/investors/phases → duplicates, and re-seeds the data room). This script
 * touches ONLY the Agent table — no users, projects, RAID, investors, or
 * data-room data are affected. It refreshes each agent's definitional fields
 * AND sets dailyRunEnabled (on for the orchestrator + 5 C-suite heads, off for
 * everyone else) — i.e. it's also the "on switch" for the autonomous morning loop.
 *
 * Usage (in the Coolify app terminal, after deploying updated specs):
 *   npx tsx scripts/reseed-agents.ts
 */

import { PrismaClient } from '@prisma/client';
import { AGENT_SPECS } from '../src/lib/agents';

const prisma = new PrismaClient();

// All 18 agents now participate in the daily sweep — orchestrator +
// 5 C-suite heads + 12 functional reports. Keep this in sync with
// DAILY_RUN_SLUGS in prisma/seed.ts and BRANCH_PLAN in the cron route.
const DAILY_RUN_SLUGS = new Set([
  'md-00',
  'cfo-00', 'cto-00', 'cco-00', 'cmo-00', 'coo-00',
  'fin-01', 'fin-04', 'fin-05',
  'comm-01',
  'ops-01', 'ops-03', 'ops-05', 'ops-06',
  'tech-01', 'tech-04', 'tech-07', 'tech-08',
]);

async function main() {
  let updated = 0;
  let skipped = 0;

  for (const spec of AGENT_SPECS) {
    const existing = await prisma.agent.findUnique({
      where: { slug: spec.slug },
      select: { id: true },
    });
    if (!existing) {
      console.log(`  skip (agent not in DB): ${spec.slug}`);
      skipped++;
      continue;
    }

    await prisma.agent.update({
      where: { slug: spec.slug },
      data: {
        name: spec.name,
        title: spec.title,
        tier: spec.tier,
        branch: spec.branch,
        reportsToSlug: spec.reportsToSlug,
        mission: spec.mission,
        decisionRights: spec.decisionRights.trim(),
        responsibilities: spec.responsibilities.trim(),
        kpis: spec.kpis.trim(),
        tools: spec.tools.trim(),
        systemPrompt: spec.systemPrompt,
        dailyRunBrief: spec.dailyRunBrief ?? null,
        model: spec.model ?? 'claude-sonnet-4-6',
        temperature: spec.temperature ?? 0.4,
        deployPhase: spec.deployPhase,
        // Enable autonomous morning runs for the orchestrator + C-suite heads,
        // disable for everyone else. This is the "on switch" for the daily loop.
        dailyRunEnabled: DAILY_RUN_SLUGS.has(spec.slug),
      },
    });
    updated++;
  }

  console.log(
    `\n✔ Refreshed ${updated}/${AGENT_SPECS.length} agent definitions (prompts, briefs, tools).` +
      (skipped ? ` Skipped ${skipped} not in DB.` : '') +
      ` No other data touched.`,
  );
}

main()
  .catch((e) => {
    console.error('reseed-agents failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
