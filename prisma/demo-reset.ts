/**
 * Demo reset — makes the live-demo arc repeatable.
 *
 * The rehearsed demo submits the CURRENT quarter's report for the demo farm
 * (Al Ain Heritage Farm, UPN-AUH-00001) through Abdullah. Without a reset, the second
 * rehearsal fails: the report already exists and Abdullah (correctly) says so.
 *
 * This script deletes ONLY what a rehearsal creates:
 *   - the demo farm's current-quarter report (+ production/waste, cascade)
 *   - collection tickets opened during rehearsal (keeps the seeded one)
 *   - applications/suggestions submitted during rehearsal (keeps seeded ones)
 *   - the demo farm user's chat threads with Abdullah (fresh conversation)
 * It KEEPS: profile facts (never-ask-twice is part of the demo), the four
 * quarters of approved history, tiers, transfers, announcements.
 *
 * Usage: npm run demo:reset   (safe to run any number of times)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_REGISTRY = 'UPN-AUH-00001';

async function main() {
  const partner = await prisma.partner.findUnique({ where: { registryNo: DEMO_REGISTRY } });
  if (!partner) {
    console.log(`Demo partner ${DEMO_REGISTRY} not found — run npm run db:seed first.`);
    return;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;

  // 1. Current-quarter report (production/waste cascade with it)
  const del = await prisma.quarterlyReport.deleteMany({
    where: { partnerId: partner.id, year, quarter },
  });
  console.log(`✔ current-quarter report (${year} Q${quarter}): ${del.count} removed`);

  // 2. Rehearsal collection tickets — keep the original seeded ticket by
  //    keeping the OLDEST one and removing anything newer that is still open.
  const tickets = await prisma.collectionTicket.findMany({
    where: { partnerId: partner.id },
    orderBy: { createdAt: 'asc' },
  });
  if (tickets.length > 1) {
    const extra = tickets.slice(1).filter((t) => t.status === 'OPEN' || t.status === 'CLAIMED');
    for (const t of extra) await prisma.collectionTicket.delete({ where: { id: t.id } });
    console.log(`✔ rehearsal tickets: ${extra.length} removed (seeded ticket kept)`);
  } else {
    console.log('✔ rehearsal tickets: none to remove');
  }

  // 3. Rehearsal applications/suggestions — keep the two seeded demo
  //    applications (identified by the [SEED] tag in the title).
  const apps = await prisma.application.deleteMany({
    where: { partnerId: partner.id, NOT: { title: { startsWith: '[SEED]' } } },
  });
  console.log(`✔ rehearsal applications: ${apps.count} removed`);
  const sugg = await prisma.suggestion.deleteMany({
    where: { partnerId: partner.id, NOT: { body: { startsWith: '[SEED]' } } },
  });
  console.log(`✔ rehearsal suggestions: ${sugg.count} removed`);

  // 4. Fresh Abdullah conversation for the demo farm user
  if (partner.userId) {
    const abd = await prisma.agent.findUnique({ where: { slug: 'abd-00' } });
    if (abd) {
      const threads = await prisma.chatThread.deleteMany({
        where: { userId: partner.userId, agentId: abd.id },
      });
      console.log(`✔ Abdullah chat threads for demo farm: ${threads.count} removed`);
    }
  }

  console.log('🔁 Demo reset complete — the arc can run again from the top.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
