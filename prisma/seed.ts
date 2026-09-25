/**
 * Seed script — UAE Palm Network (v0).
 *
 *   1. Admin user (platform owner) + network staff demo user
 *   2. The 7-agent roster from src/lib/agents
 *   3. Emirate baseline (public sources + indicative allocations — see src/facts)
 *   4. "UPN Operations" project (internal task workstream)
 *   5. Demo partners across the actor types (Abu Dhabi-weighted for the pilot
 *      demo) + one partner-portal login (Al Ain Heritage Farm)
 *
 * Idempotent — safe to re-run after editing agent specs or facts.
 *
 * Usage: npm run db:seed
 *   Required env: SEED_CEO_PASSWORD (admin), optional SEED_PARTNER_PASSWORD.
 */

import {
  PrismaClient,
  UserRole,
  SafaEntity,
  ProjectStatus,
  PartnerType,
  PartnerSizeClass,
  PartnerTier,
  Region,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AGENT_SPECS } from '../src/lib/agents';
import { REGION_BASELINE } from '../src/facts';

const prisma = new PrismaClient();

const REGION3: Record<string, string> = {
  ABU_DHABI: 'AUH', DUBAI: 'DXB', SHARJAH: 'SHJ', AJMAN: 'AJM',
  UMM_AL_QUWAIN: 'UAQ', RAS_AL_KHAIMAH: 'RAK', FUJAIRAH: 'FUJ',
};

async function main() {
  console.log('🌴 Seeding UAE Palm Network…');

  // ─────────────────────────────────────────────
  // 1. Admin + staff users
  // ─────────────────────────────────────────────
  const adminEmail = (process.env.SEED_CEO_EMAIL ?? 'nima.vakili@kmigroup.com').toLowerCase();
  const adminName = process.env.SEED_CEO_NAME ?? 'Nima Vakili';
  const adminPassword = process.env.SEED_CEO_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error('SEED_CEO_PASSWORD must be set (≥ 8 chars).');
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: UserRole.CEO,
      title: 'Platform Owner',
      canAccessAllEntities: true,
      canAccessAllAgents: true,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      role: UserRole.CEO,
      title: 'Platform Owner',
      entity: SafaEntity.GROUP,
      canAccessAllEntities: true,
      canAccessAllAgents: true,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      isActive: true,
    },
  });
  console.log(`   ✔ Admin: ${admin.email}`);

  const staffPassword =
    process.env.SEED_STAFF_PASSWORD && process.env.SEED_STAFF_PASSWORD.length >= 8
      ? process.env.SEED_STAFF_PASSWORD
      : `${adminPassword}-upn`;
  const staff = await prisma.user.upsert({
    where: { email: 'demo.official@uaepalm.ae' },
    update: { isActive: true },
    create: {
      email: 'demo.official@uaepalm.ae',
      name: 'UPN Demo Official',
      role: UserRole.MD,
      title: 'Partner Network Supervisor (Demo)',
      entity: SafaEntity.GROUP,
      canAccessAllEntities: true,
      canAccessAllAgents: true,
      passwordHash: await bcrypt.hash(staffPassword, 12),
      isActive: true,
    },
  });
  console.log(`   ✔ Staff demo user: ${staff.email}`);

  // ─────────────────────────────────────────────
  // 2. Agents
  // ─────────────────────────────────────────────
  for (const spec of AGENT_SPECS) {
    const data = {
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
      model: spec.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      temperature: spec.temperature ?? 0.4,
      deployPhase: spec.deployPhase,
      isActive: true,
      dailyRunEnabled: false,
    };
    await prisma.agent.upsert({
      where: { slug: spec.slug },
      update: data,
      create: { slug: spec.slug, ...data },
    });
  }
  console.log(`   ✔ ${AGENT_SPECS.length} agents upserted`);

  // Deactivate any agents not in the current roster (clean fork hygiene).
  const activeSlugs = AGENT_SPECS.map((a) => a.slug);
  await prisma.agent.updateMany({
    where: { slug: { notIn: activeSlugs } },
    data: { isActive: false },
  });

  // ─────────────────────────────────────────────
  // 3. Regional baseline
  // ─────────────────────────────────────────────
  for (const r of REGION_BASELINE) {
    const data = {
      nameAr: r.nameAr,
      palmTrees: r.palmTrees,
      dateProductionTons: r.dateProductionTons,
      farmDateWasteTons: r.farmDateWasteTons,
      palmByproductsTons: r.palmByproductsTons,
      frondsTons: Math.round(r.frondsTons),
      frondBaseTons: Math.round(r.frondBaseTons),
      fiberTons: Math.round(r.fiberTons),
      otherByproductTons: Math.round(r.otherByproductTons),
      dateFactories: r.dateFactories,
      factoryReceiptTons: r.factoryReceiptTons,
      factoryDateWasteTons: r.factoryDateWasteTons,
      recyclingPlants: r.recyclingPlants,
    };
    await prisma.regionBaseline.upsert({
      where: { region: r.code as Region },
      update: data,
      create: { region: r.code as Region, ...data },
    });
  }
  console.log(`   ✔ ${REGION_BASELINE.length} regional baselines`);

  // ─────────────────────────────────────────────
  // 4. Operations project (internal task workstream)
  // ─────────────────────────────────────────────
  const existingProject = await prisma.project.findFirst({ where: { name: 'UPN Operations' } });
  if (!existingProject) {
    await prisma.project.create({
      data: {
        slug: 'upn-operations',
        name: 'UPN Operations',
        description:
          'Internal workstream of the Partner Network agent team: follow-ups, audits, campaigns, data-gap chases.',
        status: ProjectStatus.IN_FLIGHT,
        entity: SafaEntity.GROUP,
      },
    });
    console.log('   ✔ UPN Operations project created');
  }

  // ─────────────────────────────────────────────
  // 5. Demo partners (pilot: Abu Dhabi-weighted)
  // ─────────────────────────────────────────────
  const partnerPassword =
    process.env.SEED_PARTNER_PASSWORD && process.env.SEED_PARTNER_PASSWORD.length >= 8
      ? process.env.SEED_PARTNER_PASSWORD
      : `${adminPassword}-farm`;

  const partnerUser = await prisma.user.upsert({
    where: { email: 'demo.farm@partners.uaepalm.ae' },
    update: { isActive: true },
    create: {
      email: 'demo.farm@partners.uaepalm.ae',
      name: 'Abu Salem Al Dhaheri',
      role: UserRole.VIEWER,
      title: 'Partner — Al Ain Heritage Farm (Demo)',
      entity: SafaEntity.GROUP,
      passwordHash: await bcrypt.hash(partnerPassword, 12),
      isActive: true,
    },
  });

  const demoPartners: Array<{
    registryNo: string;
    nameEn: string;
    nameAr: string;
    type: PartnerType;
    sizeClass?: PartnerSizeClass;
    factorySubtype?: string;
    region: Region;
    city?: string;
    tier?: PartnerTier;
    foundingMember?: boolean;
    contactName?: string;
    userId?: string;
    profileFacts?: Record<string, unknown>;
  }> = [
    {
      registryNo: `UPN-${REGION3.ABU_DHABI}-00001`,
      nameEn: 'Al Ain Heritage Farm',
      nameAr: 'مزرعة تراث العين',
      type: PartnerType.FARM,
      sizeClass: PartnerSizeClass.MEDIUM,
      region: Region.ABU_DHABI,
      city: 'Al Ain',
      foundingMember: true,
      contactName: 'Abu Salem Al Dhaheri',
      userId: partnerUser.id,
      profileFacts: { palm_count: 340, varieties: 'Khalas, Lulu, Fard', irrigation: 'drip' },
    },
    {
      registryNo: `UPN-${REGION3.ABU_DHABI}-00002`,
      nameEn: 'Liwa Dates Packing House',
      nameAr: 'مصنع ليوا لتعبئة التمور',
      type: PartnerType.FACTORY,
      factorySubtype: 'PACKING',
      region: Region.ABU_DHABI,
      city: 'Liwa',
      foundingMember: true,
      contactName: 'Eng. Saif Al Mazrouei',
    },
    {
      registryNo: `UPN-${REGION3.ABU_DHABI}-00003`,
      nameEn: 'Emirates Palm Recycling',
      nameAr: 'الإمارات لإعادة تدوير النخيل',
      type: PartnerType.RECYCLER,
      region: Region.ABU_DHABI,
      city: 'Al Ain',
      foundingMember: true,
      contactName: 'Dr. Moza Al Kaabi',
      profileFacts: { processes: 'compost, biochar', capacity_tpy: 12000 },
    },
    {
      registryNo: `UPN-${REGION3.DUBAI}-00001`,
      nameEn: 'Al Aweer Dates Trading Co.',
      nameAr: 'شركة العوير لتجارة التمور',
      type: PartnerType.COMPANY,
      region: Region.DUBAI,
      city: 'Dubai',
      contactName: 'Khalid Al Marri',
    },
    {
      registryNo: `UPN-${REGION3.RAS_AL_KHAIMAH}-00001`,
      nameEn: 'RAK Palm Growers Collective',
      nameAr: 'جمعية مزارعي نخيل رأس الخيمة',
      type: PartnerType.COLLECTOR,
      region: Region.RAS_AL_KHAIMAH,
      city: 'Ras Al Khaimah',
      contactName: 'Salem Al Shehhi',
    },
  ];

  for (const p of demoPartners) {
    const { registryNo, profileFacts, ...rest } = p;
    await prisma.partner.upsert({
      where: { registryNo },
      update: {},
      create: {
        registryNo,
        ...rest,
        profileFacts: (profileFacts ?? undefined) as never,
      },
    });
  }
  console.log(`   ✔ ${demoPartners.length} demo partners (Al Ain Heritage Farm has portal login: demo.farm@partners.uaepalm.ae)`);

  // ─────────────────────────────────────────────
  // 6. Announcements (demo)
  // ─────────────────────────────────────────────
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          kind: 'DIRECTIVE',
          titleEn: 'Q3 reporting window opens',
          titleAr: 'فتح نافذة تقارير الربع الثالث',
          bodyEn: 'Harvest-season reports are now open. Abdullah is ready to receive your figures in any format — files, photos, or voice notes.',
          bodyAr: 'نافذة تقارير موسم الحصاد مفتوحة الآن. عبدالله جاهز لاستقبال أرقامكم بأي صيغة — ملفات أو صور أو رسائل صوتية.',
        },
        {
          kind: 'ADVISORY',
          titleEn: 'Red palm weevil advisory — Al Ain & Ras Al Khaimah',
          titleAr: 'تنبيه سوسة النخيل الحمراء — العين ورأس الخيمة',
          bodyEn: 'Increased activity reported. Inspect trunks near the crown; report suspected infestations through the platform for a coordinated response.',
          bodyAr: 'رصد نشاط متزايد. افحصوا الجذوع قرب القمة وبلغوا عن أي اشتباه عبر المنصة لاستجابة منسقة.',
        },
        {
          kind: 'EVENT',
          titleEn: 'Liwa Date Festival — UAE Palm Network Pavilion',
          titleAr: 'مهرجان ليوا للتمور — جناح شبكة نخيل الإمارات',
          bodyEn: 'Founding members are invited to exhibit in the network pavilion. RSVP to reserve a place; certified partners receive priority.',
          bodyAr: 'الشركاء المؤسسون مدعوون للعرض في جناح الشبكة. أكدوا الحضور لحجز مكانكم؛ الأولوية للشركاء المعتمدين.',
          eventDate: new Date(Date.UTC(new Date().getUTCFullYear(), 7, 15)),
          rsvpEnabled: true,
        },
      ],
    });
    console.log('   ✔ 3 announcements');
  }

  // ─────────────────────────────────────────────
  // 7. Demo network activity (one ticket, one listing)
  // ─────────────────────────────────────────────
  const farm = await prisma.partner.findUnique({ where: { registryNo: 'UPN-AUH-00001' } });
  const factory = await prisma.partner.findUnique({ where: { registryNo: 'UPN-AUH-00002' } });
  if (farm && (await prisma.collectionTicket.count()) === 0) {
    await prisma.collectionTicket.create({
      data: {
        partnerId: farm.id,
        stream: 'FRONDS',
        estimatedTons: 3.2,
        region: farm.region,
        city: farm.city,
        locationNote: 'North gate — bundled and dry, loader on site',
        status: 'OPEN',
      },
    });
    console.log('   ✔ demo collection ticket (Al Ain Heritage Farm, 3.2t fronds)');
  }
  if (factory && (await prisma.listing.count()) === 0) {
    await prisma.listing.create({
      data: {
        partnerId: factory.id,
        category: 'PITS',
        title: 'Date pits — cleaned, 6 tons, ex-factory Liwa',
        qtyTons: 6,
        askPriceAed: 4200,
        region: factory.region,
      },
    });
    console.log('   ✔ demo listing (Liwa Dates Packing House, 6t pits)');
  }

  console.log('🌴 Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
