/**
 * Demo-data seed — makes the platform LOOK ALIVE for the pitch.
 *
 * Adds an Abu Dhabi-weighted set of extra partners and four quarters of
 * APPROVED reports with realistic, non-uniform figures, plus recycled-waste
 * flows into Emirates Palm Recycling (traceability edges) and tier
 * advancements. Idempotent: skips entirely if demo reports already exist.
 *
 * Usage: npm run db:seed-demo   (AFTER npm run db:seed)
 * Demo data only — wipe before any real partner onboarding.
 */

import { PrismaClient, PartnerType, PartnerSizeClass, Region, WasteStream, WasteFate } from '@prisma/client';

const prisma = new PrismaClient();

const PERIODS: Array<[number, number]> = [[2025, 3], [2025, 4], [2026, 1], [2026, 2]];

// Extra demo partners (no portal logins — registry texture)
const EXTRAS = [
  { registryNo: 'UPN-AUH-00004', nameEn: 'Liwa Oasis Palms Estate', nameAr: 'مزارع واحة ليوا للنخيل', type: PartnerType.FARM, sizeClass: PartnerSizeClass.LARGE, region: Region.ABU_DHABI, city: 'Liwa', palms: 2100 },
  { registryNo: 'UPN-AUH-00005', nameEn: 'Al Jimi Dates Farm', nameAr: 'مزرعة الجيمي للتمور', type: PartnerType.FARM, sizeClass: PartnerSizeClass.SMALL, region: Region.ABU_DHABI, city: 'Al Ain', palms: 120 },
  { registryNo: 'UPN-AUH-00006', nameEn: 'Al Dhafra Golden Dates Co.', nameAr: 'شركة الظفرة الذهبية للتمور', type: PartnerType.COMPANY, region: Region.ABU_DHABI, city: 'Madinat Zayed' },
  { registryNo: 'UPN-RAK-00002', nameEn: 'Digdaga Oasis Farms', nameAr: 'مزارع واحة دقداقة', type: PartnerType.FARM, sizeClass: PartnerSizeClass.MEDIUM, region: Region.RAS_AL_KHAIMAH, city: 'Ras Al Khaimah', palms: 640 },
  { registryNo: 'UPN-FUJ-00001', nameEn: 'Fujairah Heritage Gardens', nameAr: 'بساتين الفجيرة التراثية', type: PartnerType.FARM, sizeClass: PartnerSizeClass.MEDIUM, region: Region.FUJAIRAH, city: 'Fujairah', palms: 450 },
];

// Per-partner seasonal production (tons/quarter) — deliberately non-uniform
const PROFILE: Record<string, { palms?: number; prod: number[]; lossRate: number; divert: number }> = {
  'UPN-AUH-00001': { palms: 340, prod: [11.5, 6.2, 2.1, 14.3], lossRate: 0.08, divert: 0.72 },
  'UPN-AUH-00004': { palms: 2100, prod: [78, 41, 12, 96], lossRate: 0.12, divert: 0.55 },
  'UPN-AUH-00005': { palms: 120, prod: [3.8, 2.1, 0.7, 4.6], lossRate: 0.15, divert: 0.3 },
  'UPN-RAK-00002': { palms: 640, prod: [22, 12, 4, 27], lossRate: 0.09, divert: 0.4 },
  'UPN-FUJ-00001': { palms: 450, prod: [15, 8, 3, 19], lossRate: 0.11, divert: 0.6 },
};

async function main() {
  const marker = await prisma.quarterlyReport.findFirst({
    where: { partner: { registryNo: 'UPN-AUH-00004' } },
  });
  if (marker) {
    console.log('Demo data already present — nothing to do.');
    return;
  }

  console.log('🎬 Seeding demo activity…');

  for (const e of EXTRAS) {
    const { palms, ...data } = e;
    await prisma.partner.upsert({
      where: { registryNo: e.registryNo },
      update: {},
      create: {
        ...data,
        foundingMember: true,
        profileFacts: palms ? ({ palm_count: palms, varieties: 'Khalas, Lulu' } as never) : undefined,
      },
    });
  }
  console.log(`   ✔ ${EXTRAS.length} extra registry partners`);

  const recycler = await prisma.partner.findUnique({ where: { registryNo: 'UPN-AUH-00003' } });
  const factory = await prisma.partner.findUnique({ where: { registryNo: 'UPN-AUH-00002' } });

  let reports = 0;
  for (const [registryNo, p] of Object.entries(PROFILE)) {
    const partner = await prisma.partner.findUnique({ where: { registryNo } });
    if (!partner) continue;

    for (let i = 0; i < PERIODS.length; i++) {
      const [year, quarter] = PERIODS[i];
      const prod = p.prod[i];
      const submitted = new Date(Date.UTC(year, quarter * 3 - 1, 20 + (i % 3)));

      const report = await prisma.quarterlyReport.create({
        data: {
          partnerId: partner.id,
          year,
          quarter,
          status: 'APPROVED',
          confidenceScore: 82 + ((i * 5 + partner.registryNo.length) % 15),
          validationNotes: 'CHECKED: history, regional priors, physical bounds. DEVIATIONS: none material. RECOMMENDATION: approve.',
          submittedAt: submitted,
          validatedAt: new Date(submitted.getTime() + 3600e3),
          approvedAt: new Date(submitted.getTime() + 26 * 3600e3),
        },
      });
      reports++;

      await prisma.productionRecord.create({
        data: {
          reportId: report.id,
          palmTreeCount: p.palms ?? null,
          datesProducedTons: prod,
          datesSoldTons: Math.round(prod * 0.85 * 10) / 10,
          varieties: ['Khalas', 'Lulu'],
        },
      });

      // Waste: date losses + fronds (harvest quarters heavier)
      const dateLoss = Math.round(prod * p.lossRate * 10) / 10;
      const fronds = Math.round((p.palms ?? 300) * 0.006 * (quarter === 3 || quarter === 4 ? 1.6 : 0.7) * 10) / 10;
      const divertedFronds = Math.round(fronds * p.divert * 10) / 10;
      const burnedFronds = Math.round((fronds - divertedFronds) * 10) / 10;

      if (dateLoss > 0)
        await prisma.wasteRecord.create({
          data: { reportId: report.id, stream: WasteStream.DATES, fate: WasteFate.FEED, tons: dateLoss },
        });
      if (divertedFronds > 0)
        await prisma.wasteRecord.create({
          data: {
            reportId: report.id, stream: WasteStream.FRONDS, fate: WasteFate.RECYCLED,
            tons: divertedFronds, destinationRegistryNo: recycler?.registryNo ?? null,
          },
        });
      if (burnedFronds > 0)
        await prisma.wasteRecord.create({
          data: { reportId: report.id, stream: WasteStream.FRONDS, fate: WasteFate.BURNED, tons: burnedFronds },
        });

      // Traceability edge for the recycled share
      if (recycler && divertedFronds > 0) {
        await prisma.materialTransfer.create({
          data: {
            fromPartnerId: partner.id, toPartnerId: recycler.id,
            stream: WasteStream.FRONDS, tons: divertedFronds, year, quarter, reconciled: true,
          },
        });
      }
    }
  }
  console.log(`   ✔ ${reports} approved quarterly reports with production + waste records`);

  // Factory reports (receipts + pits to recycler)
  if (factory) {
    for (let i = 0; i < PERIODS.length; i++) {
      const [year, quarter] = PERIODS[i];
      const receipts = [420, 610, 180, 730][i];
      const submitted = new Date(Date.UTC(year, quarter * 3 - 1, 24));
      const r = await prisma.quarterlyReport.create({
        data: {
          partnerId: factory.id, year, quarter, status: 'APPROVED',
          confidenceScore: 90, submittedAt: submitted,
          validatedAt: submitted, approvedAt: new Date(submitted.getTime() + 20 * 3600e3),
        },
      });
      await prisma.productionRecord.create({
        data: { reportId: r.id, datesProducedTons: receipts, processingCapacityTons: 4000 },
      });
      const pits = Math.round(receipts * 0.11 * 10) / 10;
      await prisma.wasteRecord.create({
        data: {
          reportId: r.id, stream: WasteStream.PITS, fate: WasteFate.RECYCLED, tons: pits,
          destinationRegistryNo: recycler?.registryNo ?? null,
        },
      });
      if (recycler)
        await prisma.materialTransfer.create({
          data: { fromPartnerId: factory.id, toPartnerId: recycler.id, stream: WasteStream.PITS, tons: pits, year, quarter, reconciled: true },
        });
    }
    console.log('   ✔ factory reports (receipts + pit recycling)');
  }

  // Tier advancements earned by the history above
  const promote: Array<[string, 'ACTIVE' | 'CERTIFIED']> = [
    ['UPN-AUH-00001', 'CERTIFIED'],
    ['UPN-AUH-00004', 'CERTIFIED'],
    ['UPN-AUH-00002', 'ACTIVE'],
    ['UPN-AUH-00005', 'ACTIVE'],
    ['UPN-RAK-00002', 'ACTIVE'],
    ['UPN-FUJ-00001', 'ACTIVE'],
  ];
  for (const [registryNo, tier] of promote) {
    const partner = await prisma.partner.findUnique({ where: { registryNo } });
    if (!partner) continue;
    await prisma.partner.update({ where: { id: partner.id }, data: { tier } });
    await prisma.tierEvent.create({
      data: {
        partnerId: partner.id, fromTier: partner.tier, toTier: tier,
        fromStanding: 'GOOD', toStanding: 'GOOD',
        reason: 'Demo: consecutive approved quarterly reports',
      },
    });
  }
  console.log(`   ✔ ${promote.length} tier advancements`);

  // Applications + a suggestion — so the portal Applications page and the
  // staff Network Inbox have life in the demo. [SEED] tag protects them from
  // npm run demo:reset.
  const alAin = await prisma.partner.findUnique({ where: { registryNo: 'UPN-AUH-00001' } });
  const liwaEstate = await prisma.partner.findUnique({ where: { registryNo: 'UPN-AUH-00004' } });
  if (alAin) {
    await prisma.application.create({
      data: {
        partnerId: alAin.id, kind: 'AWARD', status: 'UNDER_REVIEW',
        title: '[SEED] Excellence in Circular Practice — 2026 nomination',
        body: 'ترشيح لجائزة التميز في الممارسات الدائرية: 72% من نواتجنا الثانوية حُوِّلت هذا العام عبر تذاكر الجمع الموثقة في المنصة. Nomination based on verified diversion records held by the network.',
      },
    });
    await prisma.suggestion.create({
      data: {
        partnerId: alAin.id, kind: 'IDEA',
        body: '[SEED] اقتراح: إتاحة تنبيه موسمي قبل موجات الغبار لجدولة الحصاد — Seasonal dust-wave alerts to help schedule harvest windows.',
        status: 'NEW',
      },
    });
  }
  if (liwaEstate) {
    await prisma.application.create({
      data: {
        partnerId: liwaEstate.id, kind: 'GRANT', status: 'APPROVED',
        title: '[SEED] Frond-chipping equipment support — Al Dhafra program',
        body: 'طلب دعم لمعدات تقطيع السعف ضمن برنامج الظفرة. Approved on the strength of four consecutive verified quarters.',
        decisionNote: 'Approved — consistent verified reporting; equipment tied to diversion targets.',
        decidedAt: new Date(Date.UTC(2026, 5, 12)),
      },
    });
  }
  console.log('   ✔ demo applications + suggestion');

  await prisma.activityEvent.createMany({
    data: [
      { kind: 'REPORT_APPROVED', severity: 'INFO', title: 'UPN-AUH-00004 · 2026 Q2 APPROVED (96 t — largest report this quarter)', payload: {} },
      { kind: 'TIER_CHANGE_APPLIED', severity: 'NOTABLE', title: 'Al Ain Heritage Farm advanced to CERTIFIED · مبروك', payload: {} },
      { kind: 'REPORT_SUBMITTED', severity: 'INFO', title: 'UPN-FUJ-00001 submitted 2026 Q2 via Abdullah (Excel intake)', payload: {} },
    ],
  });

  console.log('🎬 Demo seed complete — dashboards are alive.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
