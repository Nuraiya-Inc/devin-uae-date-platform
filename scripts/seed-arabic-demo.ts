/**
 * Arabic-native demo seed — minimal data to exercise the
 * resolve_quantity → record_* provenance gate end-to-end.
 *
 *   npx tsx scripts/seed-arabic-demo.ts
 *
 * Creates (idempotent):
 *   1. A DRAFT QuarterlyReport for the CURRENT quarter on
 *      Al Ain Heritage Farm (UPN-AUH-00001 — the partner with the
 *      portal login demo.farm@partners.uaepalm.ae). record_* tools only
 *      write to DRAFT/RETURNED reports; everything from the other seeds
 *      is APPROVED, so without this the gate has nothing to write to.
 *   2. One example QuantityResolution + WasteRecord pair so the audit
 *      chain (figure → resolution → farmer's words) is visible in
 *      queries/UI before any chat happens.
 *
 * Run AFTER npm run db:seed (needs the partner to exist).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FARM_REGISTRY = 'UPN-AUH-00001'; // Al Ain Heritage Farm — portal login farm

async function main() {
  const partner = await prisma.partner.findUnique({ where: { registryNo: FARM_REGISTRY } });
  if (!partner) {
    throw new Error(`${FARM_REGISTRY} not found — run npm run db:seed first.`);
  }

  // Current quarter from "now"
  const now = new Date();
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;

  // ── 1. DRAFT report for the current quarter ────────────────
  let report = await prisma.quarterlyReport.findFirst({
    where: { partnerId: partner.id, year, quarter },
  });
  if (!report) {
    report = await prisma.quarterlyReport.create({
      data: { partnerId: partner.id, year, quarter, status: 'DRAFT' },
    });
    console.log(`✔ DRAFT report ${year} Q${quarter} for ${partner.registryNo} (${report.id})`);
  } else {
    console.log(`↺ Report ${year} Q${quarter} already exists (${report.id}, status=${report.status})`);
  }

  // ── 2. One example resolution → waste record pair ──────────
  const existing = await prisma.quantityResolution.findFirst({
    where: { rawText: 'عندي وايت جريد ونص كرب بعد القيظ، رميناه في البر' },
  });
  if (existing) {
    console.log('↺ Example QuantityResolution already present — nothing to do.');
    return;
  }

  const resolution = await prisma.quantityResolution.create({
    data: {
      rawText: 'عندي وايت جريد ونص كرب بعد القيظ، رميناه في البر',
      normalized: 'عندي وايت جريد ونص كرب بعد القيظ رميناه في البر',
      kgLow: 600, kgHigh: 2250, kgMid: 1200,
      count: 1.5,
      unitCode: 'WAITE',
      quantityIndicative: true,
      stream: 'FRONDS', streamMatched: 'جريد',
      fate: 'DUMPED', fateMatched: 'رميناه',
      periodYear: year - 1, periodQuarter: 4, periodBasis: 'SEASON',
      confidence: 'LOW',
      neededClarification: true,
      clarifyQuestion: 'الوايت طن ولا نص تقريبًا؟ (400–1500 كغ على قد المويه/السعف)',
      source: 'CHAT_TEXT',
      notes: [
        'fraction "ونص" → +0.5 of a وايت (implies a whole too)',
        'INDICATIVE. "وايت" range is real spread — ask unless size given.',
        'period: بعد القيظ → Q4 (SEASON, MEDIUM)',
      ],
    },
  });

  await prisma.wasteRecord.create({
    data: {
      reportId: report.id,
      stream: 'FRONDS',
      fate: 'DUMPED',
      tons: resolution.kgMid! / 1000,
      notes: 'Seeded example — figure traceable via resolutionId.',
      resolutionId: resolution.id,
    },
  });

  console.log(`✔ Example resolution ${resolution.id} → waste record (1.2t FRONDS→DUMPED, flagged MUST_CLARIFY)`);
  console.log('\nSmoke test: log in as demo.farm@partners.uaepalm.ae, open Abdullah, send:');
  console.log('  "عندي وايت جريد رميناه في البر" — expect resolve_quantity + a dialect clarifier.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
