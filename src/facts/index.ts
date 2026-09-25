/**
 * UAE Palm Network — fact graph (v0, UAE edition).
 *
 * Single source of truth for the taxonomy, per-emirate baseline, tier ladder,
 * and hard rules that every agent inherits via the cached prompt prefix.
 *
 * BASELINE HONESTY CONTRACT (stricter than usual — read before editing):
 *   - ABU_DHABI figures are from the ADAFSA date-palm survey reported in 2024
 *     (6,750,699 farm palms across 22,581 farms; production 234,079 t) — the
 *     only per-emirate MEASURED baseline published in the UAE.
 *   - National anchors: ~40 million date palms (UAE University, 2022 — includes
 *     urban/ornamental plantings) and ~400,000 t/yr production, 8th globally
 *     (FAO 2022, cited by ADAFSA). Both are approximations.
 *   - The other six emirates have NO published palm/production baseline.
 *     Their rows are INDICATIVE allocations of the national remainder so that
 *     dashboards render — flagged baselineQuality: 'INDICATIVE'. They are
 *     placeholders to be REPLACED by network-measured data, never quoted
 *     externally, never presented as fact by any agent.
 *   - Waste/byproduct figures everywhere are coefficient-based estimates
 *     (~20 kg/tree byproducts; 10%-of-production farm date loss) — the same
 *     validation priors used in regional date-palm literature. Modeled, not
 *     measured. Filling them with real data IS the product.
 *
 * This module also provides back-compat shims for the runtime the platform
 * inherited (freeze/pause status, current-date block, theme block).
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface RegionBaselineFact {
  /** Canonical enum value used in the DB (matches Prisma Region enum) */
  code: string;
  nameEn: string;
  nameAr: string;
  /** SURVEYED = published measurement · INDICATIVE = allocation placeholder */
  baselineQuality: 'SURVEYED' | 'INDICATIVE';
  palmTrees: number;
  dateProductionTons: number;
  farmDateWasteTons: number;      // estimate: 10% of production
  palmByproductsTons: number;     // estimate: ~20 kg/tree
  frondsTons: number;
  frondBaseTons: number;
  fiberTons: number;
  otherByproductTons: number;
  dateFactories: number | null;   // null = not centrally published
  factoryReceiptTons: number | null;
  factoryDateWasteTons: number | null;
  recyclingPlants: number | null;
}

export interface TierFact {
  code: string;
  order: number;
  nameEn: string;
  nameAr: string;
  earnedBy: string;
  unlocks: string;
}

export type FactsSection =
  | 'identity'
  | 'taxonomy'
  | 'regions'
  | 'tiers'
  | 'baseline'
  | 'engagement'
  | 'esg'
  | 'rules';

export const FACTS_SECTIONS: FactsSection[] = [
  'identity',
  'taxonomy',
  'regions',
  'tiers',
  'baseline',
  'engagement',
  'esg',
  'rules',
];

// ─────────────────────────────────────────────────────────────────
// The facts — seven emirates
// ─────────────────────────────────────────────────────────────────
//
// Byproduct columns are derived with the same coefficient set as the
// literature-based priors below (fronds ≈ 12.24 kg/tree; frond base ≈ 6.5;
// fiber ≈ 0.6; other ≈ 0.66; total ≈ 20 kg/tree), rounded.

export const REGION_BASELINE: RegionBaselineFact[] = [
  // MEASURED — ADAFSA survey (reported 2024): 6,750,699 farm palms / 22,581
  // farms (Al Ain 3.86M · Al Dhafra 2.35M · Abu Dhabi city 0.54M); production
  // 234,079 t (2023). Factories/recyclers not centrally published.
  { code: 'ABU_DHABI', nameEn: 'Abu Dhabi', nameAr: 'أبوظبي', baselineQuality: 'SURVEYED', palmTrees: 6_750_699, dateProductionTons: 234_079, farmDateWasteTons: 23_408, palmByproductsTons: 135_014, frondsTons: 82_628, frondBaseTons: 43_880, fiberTons: 4_050, otherByproductTons: 4_456, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
  // INDICATIVE — no published per-emirate baseline. Allocations of the
  // national remainder (farm-relevant palms), to be replaced by measurement.
  { code: 'RAS_AL_KHAIMAH', nameEn: 'Ras Al Khaimah', nameAr: 'رأس الخيمة', baselineQuality: 'INDICATIVE', palmTrees: 900_000, dateProductionTons: 55_000, farmDateWasteTons: 5_500, palmByproductsTons: 18_000, frondsTons: 11_016, frondBaseTons: 5_850, fiberTons: 540, otherByproductTons: 594, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
  { code: 'SHARJAH', nameEn: 'Sharjah', nameAr: 'الشارقة', baselineQuality: 'INDICATIVE', palmTrees: 700_000, dateProductionTons: 45_000, farmDateWasteTons: 4_500, palmByproductsTons: 14_000, frondsTons: 8_568, frondBaseTons: 4_550, fiberTons: 420, otherByproductTons: 462, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
  { code: 'DUBAI', nameEn: 'Dubai', nameAr: 'دبي', baselineQuality: 'INDICATIVE', palmTrees: 650_000, dateProductionTons: 30_000, farmDateWasteTons: 3_000, palmByproductsTons: 13_000, frondsTons: 7_956, frondBaseTons: 4_225, fiberTons: 390, otherByproductTons: 429, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
  { code: 'FUJAIRAH', nameEn: 'Fujairah', nameAr: 'الفجيرة', baselineQuality: 'INDICATIVE', palmTrees: 450_000, dateProductionTons: 22_000, farmDateWasteTons: 2_200, palmByproductsTons: 9_000, frondsTons: 5_508, frondBaseTons: 2_925, fiberTons: 270, otherByproductTons: 297, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
  { code: 'UMM_AL_QUWAIN', nameEn: 'Umm Al Quwain', nameAr: 'أم القيوين', baselineQuality: 'INDICATIVE', palmTrees: 200_000, dateProductionTons: 8_000, farmDateWasteTons: 800, palmByproductsTons: 4_000, frondsTons: 2_448, frondBaseTons: 1_300, fiberTons: 120, otherByproductTons: 132, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
  { code: 'AJMAN', nameEn: 'Ajman', nameAr: 'عجمان', baselineQuality: 'INDICATIVE', palmTrees: 150_000, dateProductionTons: 6_000, farmDateWasteTons: 600, palmByproductsTons: 3_000, frondsTons: 1_836, frondBaseTons: 975, fiberTons: 90, otherByproductTons: 99, dateFactories: null, factoryReceiptTons: null, factoryDateWasteTons: null, recyclingPlants: null },
];

export const TIER_LADDER: TierFact[] = [
  { code: 'REGISTERED', order: 0, nameEn: 'Registered',        nameAr: 'مسجّل',      earnedBy: 'Verified identity + basic profile', unlocks: 'Network registry listing, Abdullah access, Academy access' },
  { code: 'ACTIVE',     order: 1, nameEn: 'Active Member',     nameAr: 'عضو نشط',    earnedBy: '2 consecutive verified quarterly reports', unlocks: 'Member seal, emirate benchmarking reports, marketplace listing' },
  { code: 'CERTIFIED',  order: 2, nameEn: 'Certified Partner', nameAr: 'شريك معتمد', earnedBy: '4 quarters of reporting + quality audit aligned with recognized Emirati quality standards', unlocks: 'Certification mark, export-readiness endorsement, incentive eligibility, priority introductions' },
  { code: 'ELITE',      order: 3, nameEn: 'Elite Partner',     nameAr: 'شريك نخبة',  earnedBy: 'Sustained excellence + contribution to national goals (data quality, verified waste diversion, mentoring)', unlocks: 'Annual ceremony recognition, trade-delegation invitations, advisory-council seat, featured national profile' },
];

export const UPN_FACTS = {
  identity: {
    platformNameEn: 'UAE Palm Network',
    platformNameAr: 'شبكة نخيل الإمارات',
    authority:
      'An independent partner-network platform for the UAE date-palm ecosystem. Operating partner: Nuraiya. Technology partner: Safa BioWorks FZE (Dubai). The platform is built in alignment with the UAE’s national food-security and Net Zero 2050 agendas; it does not represent, and must never claim to represent, any government authority unless a mandate is formally in place.',
    mission:
      'Give the UAE date-palm ecosystem one partner identity: membership, certification, incentives and recognition flow through the network, and quarterly reporting is the price of belonging. The platform converts scattered estimates into a measured national dataset — starting where no per-emirate baseline exists at all.',
    principle:
      'Prestige → benefits → membership → reporting → data → insight → more prestige to distribute.',
  },
  taxonomy: {
    partnerTypes: [
      { code: 'FARM',      en: 'Dates Farm',      ar: 'مزرعة تمور',   subtypes: ['SMALL', 'MEDIUM', 'LARGE'] },
      { code: 'FACTORY',   en: 'Date Factory',    ar: 'مصنع تمور',    subtypes: ['PACKING', 'TRANSFORMATIVE'] },
      { code: 'COMPANY',   en: 'Dates Company',   ar: 'شركة تمور',    subtypes: [] as string[] },
      { code: 'RECYCLER',  en: 'Recycling Plant', ar: 'مصنع إعادة تدوير', subtypes: [] as string[] },
      { code: 'COLLECTOR', en: 'Collector / Association', ar: 'جهة جمع / جمعية', subtypes: [] as string[] },
    ],
    wasteStreams: [
      { code: 'DATES',      en: 'Date losses',  ar: 'فاقد التمور' },
      { code: 'PITS',       en: 'Date pits',    ar: 'نوى التمور' },
      { code: 'FRONDS',     en: 'Palm fronds',  ar: 'سعف' },
      { code: 'FROND_BASE', en: 'Frond bases',  ar: 'كرب' },
      { code: 'FIBER',      en: 'Palm fibers',  ar: 'ليف' },
      { code: 'OTHER',      en: 'Other byproducts', ar: 'نواتج أخرى' },
    ],
    wasteFates: ['FEED', 'SOLD', 'RECYCLED', 'BURNED', 'BURIED', 'DUMPED', 'UNKNOWN'],
  },
  regions: REGION_BASELINE,
  tiers: TIER_LADDER,
  membership: {
    annualRenewal:
      'Certification (CERTIFIED and ELITE) is ANNUAL. The certificate carries a year stamp and is valid through 31 December of its year. It renews automatically as long as quarterly reporting stays current. A full 12 months with no approved report triggers a certification LAPSE — drafted by cer-01 for official approval (never announced as final before approval). Re-certification after a lapse: 4 fresh approved quarters; history and registry number are always preserved.',
    standingLadder:
      'Standing decays mechanically without reporting (a quarter becomes due 30 days after it ends): 1 missed due quarter → AT_RISK (courteous heads-up; benefits intact — frame as "protect your standing"); 2+ missed → PAUSED (benefits paused: marketplace, collection priority, certificate download; membership and history preserved). Restoration is instant: completing the missing record with Abdullah returns standing to GOOD automatically.',
    tone:
      'Never threaten. State the fact, the date it takes effect, and the easy path back — in one breath. "التقرير القادم يحمي اعتمادكم" beats any warning. Loss language is allowed only as protection language: partners should feel they are protecting something valuable they already own.',
  },
  baseline: {
    source:
      'Public sources: ADAFSA date-palm survey reported 2024 (Abu Dhabi, measured); FAO 2022 production data as cited by ADAFSA/Aletihad (national); UAE University 2022 national palm estimate. Non-Abu-Dhabi emirate rows are INDICATIVE allocations, not published data.',
    nationalTotals: {
      /** ~40M national estimate (UAEU 2022) — includes urban/ornamental palms */
      palmTreesApprox: 40_000_000,
      /** Farm palms actually surveyed (Abu Dhabi only, ADAFSA) */
      farmPalmsSurveyed: 6_750_699,
      farmsSurveyed: 22_581,
      /** FAO 2022 — UAE ranks 8th globally */
      dateProductionTons: 400_000,
      globalRank: 8,
      dateVarieties: 120,
      /** Sum of the region table (farm-relevant working set, mostly indicative) */
      workingSetPalmTrees: 9_800_699,
      workingSetProductionTons: 400_079,
      /** Coefficient estimates over the working set */
      farmDateWasteTons: 40_008,
      palmByproductsTons: 196_014,
      /** Not centrally published — the network's first data campaign */
      dateFactories: null as number | null,
      recyclingPlants: null as number | null,
    },
    caveats: [
      'Only Abu Dhabi has a published, measured per-emirate baseline (ADAFSA survey). The other six emirate rows are INDICATIVE allocations of the national remainder — placeholders to be replaced by network-measured data, never to be quoted externally or presented as fact.',
      'The ~40M national palm figure includes urban and ornamental plantings; the farm-relevant working set the platform tracks is smaller.',
      'Farm date waste is a uniform 10%-of-production assumption; palm byproducts a ~20 kg/tree coefficient — modeled, not measured.',
      'Factory and recycling-plant counts and intake volumes are not centrally published in the UAE — establishing them is the platform’s first data campaign.',
      'Most reused palm waste today goes to livestock feed or compost informally; a frond-based OSB plant and cash-for-palm-waste schemes have operated in Abu Dhabi.',
    ],
    validationPriors: {
      farmDateLossRateTypical: 0.10,
      factoryDateLossRateTypical: 0.06,
      byproductKgPerTreeTypical: 20,
      frondsKgPerTreeTypical: 12.24,
    },
  },
  engagement: {
    seasonalCalendar: [
      { period: 'Feb–Apr', focus: 'Pollination season — agronomy advisories, early-year registration drive' },
      { period: 'Jul–Aug', focus: 'Harvest season — production reporting push; Liwa Date Festival and Al Dhaid Date Festival presence' },
      { period: 'Ramadan', focus: 'Demand peak — market access benefits, procurement introductions' },
      { period: 'Q4',      focus: 'Annual recognition — tier ceremonies, emirate standings announcement' },
    ],
    gamification:
      'Honor-based, not points-based: emirate standings (never individual shaming), ceremonial awards presented by dignitaries, physical member seals, founding-partner designations. Every report returns immediate value: polished bilingual summary + emirate benchmark + one actionable insight.',
  },
  esg: {
    principle:
      'Every diverted ton is a measurable climate contribution. The platform converts diversion data into INDICATIVE avoided-emissions estimates and an annual Sustainability Contribution Statement per partner — and builds the UAE-wide palm-waste ESG picture no one currently has.',
    indicativeFactorTCO2ePerTon: 1.2,
    factorCaveat:
      'Single conservative placeholder factor (1.2 tCO2e per productively-diverted ton vs a burn/bury baseline). INDICATIVE ONLY — replace with methodology-specific factors from a qualified carbon consultant before any external claim.',
    creditPathway:
      'Estimates are NOT carbon credits. The pathway: the UAE’s Net Zero 2050 strategy and the 2024 federal climate law establish national carbon accounting, and Abu Dhabi hosts carbon-market infrastructure (e.g. exchange platforms in ADGM). Waste-to-biochar and avoided-burning projects have recognized methodologies internationally (e.g. Verra biochar). The platform’s role is the measured, auditable MRV dataset such projects require — partners with verified diversion records are pre-positioned for enrollment when a program opens. Verify current program details before citing specifics to partners.',
    agentGuidance:
      'When partners ask about carbon credits: be encouraging AND precise. Their verified diversion builds an auditable record that positions them for future credit programs; the estimate itself is indicative and not tradeable. Never promise credits or revenue.',
  },
  hardRules: [
    { id: 'UPN-1', severity: 'CRITICAL', rule: 'The network is neutral infrastructure for the UAE date-palm ecosystem. Never favor any commercial party (including the operating or technology partner) in analysis, matchmaking, or data access.' },
    { id: 'UPN-2', severity: 'CRITICAL', rule: 'Certification grants, tier changes, standing suspensions, and public registry changes are agent-DRAFTED but human-APPROVED. Never announce one as final until a network official approves it in the review queue.' },
    { id: 'UPN-3', severity: 'CRITICAL', rule: 'Partner data is confidential. Never reveal one partner’s figures to another partner. Benchmarks are aggregates only (minimum 3 partners per aggregate).' },
    { id: 'UPN-4', severity: 'CRITICAL', rule: 'Never claim or imply government authority, endorsement, or mandate. The network is an independent platform aligned with national goals; certification is the NETWORK’s recognition unless a formal government mandate exists.' },
    { id: 'UPN-5', severity: 'HIGH', rule: 'Arabic first. Partner-facing messages default to Arabic (Modern Standard, warm-formal register) with English available. Latin numerals in both languages.' },
    { id: 'UPN-6', severity: 'HIGH', rule: 'Never ask a partner for information they have already provided. Check the partner profile and report history first. Confirm, don’t interrogate: play back what you understood, ask only for genuinely missing fields.' },
    { id: 'UPN-7', severity: 'HIGH', rule: 'Baseline figures: only Abu Dhabi’s are surveyed; other emirates’ are INDICATIVE placeholders, and waste figures everywhere are coefficient estimates. Use them as validation priors, never present them as measured fact. Reported data replaces modeled data.' },
    { id: 'UPN-8', severity: 'MEDIUM', rule: 'Tone: professional, warm, respectful of the partner’s standing. Recognition language is generous; compliance language is never threatening — a lapsed standing is "paused", framed with a clear path back.' },
    { id: 'UPN-9', severity: 'MEDIUM', rule: 'Frame participation as contribution to the UAE’s food-security and Net Zero 2050 goals and to the Emirates’ date-palm heritage (Al Ain and Liwa oases are FAO-recognized agricultural heritage systems).' },
  ],
  brand: {
    palette: {
      // Neutral gov-modern identity carried over: deep teal ground, gold
      // accent, mint highlight. Re-skin when a client brand is adopted.
      deepTeal: '#0E2A33',
      teal: '#14444F',
      gold: '#D9B36C',
      mint: '#35C4A0',
      sand: '#F4EFE6',
      ink: '#0B1F26',
    },
  },
} as const;

export type UpnFacts = typeof UPN_FACTS;

// ─────────────────────────────────────────────────────────────────
// Cached prefix builder — prepended to every agent's system prompt
// ─────────────────────────────────────────────────────────────────

export function buildCachedFactsPrefix(): string {
  const f = UPN_FACTS;
  const t = f.baseline.nationalTotals;

  const regionTable = [
    '| Emirate | Baseline | Palm trees | Production (t) | Est. farm waste (t) | Byproducts (t) |',
    '|---|---|---|---|---|---|',
    ...f.regions.map(
      (r) =>
        `| ${r.nameEn} (${r.nameAr}) | ${r.baselineQuality} | ${r.palmTrees.toLocaleString('en-US')} | ${r.dateProductionTons.toLocaleString('en-US')} | ${r.farmDateWasteTons.toLocaleString('en-US')} | ${r.palmByproductsTons.toLocaleString('en-US')} |`,
    ),
  ].join('\n');

  const tierList = f.tiers
    .map((tier) => `- **${tier.nameEn} / ${tier.nameAr}** — earned by: ${tier.earnedBy}. Unlocks: ${tier.unlocks}`)
    .join('\n');

  const rules = f.hardRules.map((r) => `[${r.id} · ${r.severity}] ${r.rule}`).join('\n');

  return [
    `# ${f.identity.platformNameEn} — ${f.identity.platformNameAr}`,
    '',
    `**Who runs this:** ${f.identity.authority}`,
    '',
    `**Mission:** ${f.identity.mission}`,
    '',
    `**Operating principle:** ${f.identity.principle}`,
    '',
    '## Hard rules (non-negotiable, inherited by every agent)',
    '',
    rules,
    '',
    '## Partner taxonomy',
    '',
    f.taxonomy.partnerTypes
      .map((p) => `- ${p.code}: ${p.en} / ${p.ar}${p.subtypes.length ? ` (subtypes: ${p.subtypes.join(', ')})` : ''}`)
      .join('\n'),
    '',
    'Waste streams: ' + f.taxonomy.wasteStreams.map((w) => `${w.code} (${w.en} / ${w.ar})`).join(', '),
    'Waste fates: ' + f.taxonomy.wasteFates.join(', '),
    '',
    '## Membership tier ladder (standing is HELD, not owned — it decays without reporting)',
    '',
    tierList,
    '',
    '## Membership lifecycle (annual renewal + standing decay)',
    '',
    f.membership.annualRenewal,
    f.membership.standingLadder,
    f.membership.tone,
    '',
    '## UAE baseline (public sources + indicative allocations — see caveats, UPN-7)',
    '',
    `National palms: ~${t.palmTreesApprox.toLocaleString('en-US')} (approx., incl. urban/ornamental) · Surveyed farm palms (Abu Dhabi, ADAFSA): ${t.farmPalmsSurveyed.toLocaleString('en-US')} across ${t.farmsSurveyed.toLocaleString('en-US')} farms · National production: ~${t.dateProductionTons.toLocaleString('en-US')} t/yr (FAO 2022, 8th globally) · ${t.dateVarieties}+ varieties · Est. byproducts (working set): ${t.palmByproductsTons.toLocaleString('en-US')} t/yr · Factory & recycler counts: not centrally published — the network's first data campaign`,
    '',
    regionTable,
    '',
    'Caveats: ' + f.baseline.caveats.join(' '),
    '',
    '## Engagement doctrine',
    '',
    f.engagement.gamification,
    '',
    f.engagement.seasonalCalendar.map((s) => `- ${s.period}: ${s.focus}`).join('\n'),
    '',
    '## ESG & climate contribution',
    '',
    f.esg.principle,
    f.esg.factorCaveat,
    f.esg.agentGuidance,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────
// Per-turn dynamic blocks (inherited runtime contract)
// ─────────────────────────────────────────────────────────────────

export function buildCurrentDateBlock(now: Date = new Date()): string {
  const gst = new Date(now.getTime() + 4 * 60 * 60 * 1000); // UAE (GST) = UTC+4
  const date = gst.toISOString().slice(0, 10);
  const q = Math.floor(gst.getUTCMonth() / 3) + 1;
  return [
    '# Current date',
    `Today is ${date} (UAE time, UTC+4). Current reporting period: Q${q} ${gst.getUTCFullYear()}.`,
    'Quarterly reports for a period are due within 30 days of quarter end.',
  ].join('\n');
}

/** Weekly theme — not used in v0. Kept for runtime compatibility. */
export async function buildCurrentThemeBlock(_now: Date = new Date()): Promise<string | null> {
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Freeze / pause shims — inherited from the base platform's runtime.
// v0 launches with everything live; wire real switches later.
// ─────────────────────────────────────────────────────────────────

export interface FreezeStatus {
  active: boolean;
  reason?: string;
  liftsAt?: string;
  endsOn?: string;
}

export function getDataRoomFreezeStatus(): FreezeStatus {
  return { active: false };
}

export function getAutonomousAgentPauseStatus(): FreezeStatus {
  return { active: false };
}

export function buildAutonomousAgentPauseSkip(route: string) {
  return {
    skipped: true,
    route,
    reason: 'Autonomous agent runs are not enabled in v0.',
  };
}

export function buildDataRoomFreezeError(): string {
  return 'Document promotion is not available.';
}

// ─────────────────────────────────────────────────────────────────
// Validation shim — structural sanity on the baseline.
// ─────────────────────────────────────────────────────────────────

export interface ValidationError {
  path: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING';
}
export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

export function validateFacts(): ValidationResult {
  const errors: ValidationError[] = [];
  const sum = (k: keyof RegionBaselineFact) =>
    REGION_BASELINE.reduce((acc, r) => acc + ((r[k] as number | null) ?? 0), 0);
  const totals = UPN_FACTS.baseline.nationalTotals;
  // Working-set totals must equal the region table exactly.
  const checks: Array<[string, number, number]> = [
    ['workingSetPalmTrees', sum('palmTrees'), totals.workingSetPalmTrees],
    ['workingSetProductionTons', sum('dateProductionTons'), totals.workingSetProductionTons],
    ['palmByproductsTons', sum('palmByproductsTons'), totals.palmByproductsTons],
    ['farmDateWasteTons', sum('farmDateWasteTons'), totals.farmDateWasteTons],
  ];
  for (const [path, got, want] of checks) {
    if (Math.abs(got - want) / want > 0.005) {
      errors.push({ path, message: `regional sum ${got} deviates from working-set total ${want}`, severity: 'CRITICAL' });
    }
  }
  // The working set must stay below the national approximation.
  if (sum('palmTrees') > totals.palmTreesApprox) {
    errors.push({ path: 'palmTreesApprox', message: 'working set exceeds national approximation', severity: 'CRITICAL' });
  }
  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────
// Back-compat aliases — the runtime imported these names historically.
// ─────────────────────────────────────────────────────────────────

export { UPN_FACTS as PLATFORM_FACTS };
export type PlatformFacts = typeof UPN_FACTS;
