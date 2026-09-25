/**
 * ESG estimation — indicative climate-contribution figures from measured
 * waste-diversion data.
 *
 * HONESTY CONTRACT (mirrors hard rule UPN-7): these are INDICATIVE
 * ESTIMATES using placeholder emission factors, clearly labeled as such
 * everywhere they surface. They are NOT verified carbon accounting and do
 * NOT constitute carbon credits. Credits require an accredited methodology
 * (e.g. Verra/Gold Standard, or UAE national mechanisms as they mature),
 * third-party validation, additionality and permanence assessment. What the
 * platform builds is the measured MRV-grade dataset such a project needs.
 *
 * Factor basis (to be replaced by a qualified carbon consultant before any
 * external use): diverting palm residue from open burning / burial to a
 * productive fate (feed, sale, recycling) is credited at a single
 * conservative indicative factor.
 */

import { prisma } from './db';
import { REGION_BASELINE } from '@/facts';

/** Indicative tCO2e avoided per ton of residue diverted from burn/bury/dump. */
export const INDICATIVE_FACTOR_TCO2E_PER_TON = 1.2;

/** Fates that count as productive diversion. */
export const DIVERTED_FATES = ['FEED', 'SOLD', 'RECYCLED'] as const;

/** Fates that are harmful — burn/bury/dump. These are the OPPORTUNITY:
 *  every harmful ton diverted becomes measured avoided emissions. */
export const HARMFUL_FATES = ['BURNED', 'BURIED', 'DUMPED'] as const;

/** Rough equivalence for communication only: passenger car-year ≈ 4.6 tCO2e. */
const CAR_YEAR_TCO2E = 4.6;

export interface EsgEstimate {
  year: number;
  divertedTons: number;
  harmfulTons: number;
  /** Additional indicative tCO2e available if harmful tons were diverted —
   *  the opportunity number: what this partner/sector could still capture. */
  opportunityTCO2e: number;
  totalWasteTons: number;
  diversionRatePct: number | null;
  estAvoidedTCO2e: number;
  carYearEquivalent: number;
  byStream: Array<{ stream: string; divertedTons: number; estAvoidedTCO2e: number }>;
  /** Honesty contract: this is an indicative estimate. UI renders
   *  <IndicativeChip /> wherever these figures surface. Always true. */
  indicative: true;
}

export function summarize(
  year: number,
  records: Array<{ stream: string; fate: string; tons: number }>,
): EsgEstimate {
  const total = records.reduce((a, r) => a + r.tons, 0);
  const diverted = records.filter((r) => (DIVERTED_FATES as readonly string[]).includes(r.fate));
  const divertedTons = diverted.reduce((a, r) => a + r.tons, 0);
  const harmfulTons = records
    .filter((r) => (HARMFUL_FATES as readonly string[]).includes(r.fate))
    .reduce((a, r) => a + r.tons, 0);

  const byStreamMap = new Map<string, number>();
  for (const r of diverted) {
    byStreamMap.set(r.stream, (byStreamMap.get(r.stream) ?? 0) + r.tons);
  }

  const est = divertedTons * INDICATIVE_FACTOR_TCO2E_PER_TON;
  return {
    year,
    divertedTons,
    harmfulTons: Math.round(harmfulTons * 10) / 10,
    opportunityTCO2e: Math.round(harmfulTons * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
    totalWasteTons: total,
    diversionRatePct: total > 0 ? Math.round((divertedTons / total) * 100) : null,
    estAvoidedTCO2e: Math.round(est * 10) / 10,
    carYearEquivalent: Math.round(est / CAR_YEAR_TCO2E),
    byStream: [...byStreamMap.entries()]
      .map(([stream, tons]) => ({
        stream,
        divertedTons: Math.round(tons * 10) / 10,
        estAvoidedTCO2e: Math.round(tons * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
      }))
      .sort((a, b) => b.divertedTons - a.divertedTons),
    indicative: true,
  };
}

/** Partner-level annual estimate from APPROVED reports. */
export async function partnerEsgEstimate(partnerId: string, year: number): Promise<EsgEstimate> {
  const records = await prisma.wasteRecord.findMany({
    where: { report: { partnerId, year, status: 'APPROVED' } },
    select: { stream: true, fate: true, tons: true },
  });
  return summarize(year, records);
}

/** National annual estimate from all APPROVED reports. */
export async function nationalEsgEstimate(year: number): Promise<EsgEstimate> {
  const records = await prisma.wasteRecord.findMany({
    where: { report: { year, status: 'APPROVED' } },
    select: { stream: true, fate: true, tons: true },
  });
  return summarize(year, records);
}

// ─────────────────────────────────────────────────────────────────
// ESG SCORE (0–100) — an indicative, fully transparent composite.
//
// Deliberately simple and explainable so an official can defend it:
//   • Diversion   (0–50): how much of reported residue goes to a
//                          productive fate rather than burn/bury/dump.
//   • Consistency (0–30): approved quarterly reports in the trailing
//                          four quarters (participation is the product).
//   • Data quality(0–20): mean validation confidence of those reports.
// Bands label the total. Everything here is INDICATIVE (rule UPN-7).
// ─────────────────────────────────────────────────────────────────

export interface EsgScore {
  score: number;                 // 0–100
  band: 'Leading' | 'Strong' | 'Progressing' | 'Emerging' | 'No data';
  bandAr: string;
  components: {
    diversion: number;           // 0–50
    consistency: number;         // 0–30
    dataQuality: number;         // 0–20
  };
  diversionRatePct: number | null;
  quartersReported: number;      // of the trailing 4
  meanConfidence: number | null; // 0–100
}

function bandFor(score: number): { band: EsgScore['band']; bandAr: string } {
  if (score >= 80) return { band: 'Leading', bandAr: 'ريادي' };
  if (score >= 60) return { band: 'Strong', bandAr: 'قوي' };
  if (score >= 35) return { band: 'Progressing', bandAr: 'متقدّم' };
  return { band: 'Emerging', bandAr: 'ناشئ' };
}

/** Trailing four (year, quarter) periods ending with the given period. */
function trailingQuarters(year: number, quarter: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let y = year;
  let q = quarter;
  for (let i = 0; i < 4; i++) {
    out.push([y, q]);
    q -= 1;
    if (q === 0) { q = 4; y -= 1; }
  }
  return out;
}

/** Partner ESG score for the trailing year ending at the current quarter. */
export async function partnerEsgScore(partnerId: string, now: Date = new Date()): Promise<EsgScore> {
  const gst = new Date(now.getTime() + 4 * 60 * 60 * 1000); // UAE UTC+4
  const year = gst.getUTCFullYear();
  const quarter = Math.floor(gst.getUTCMonth() / 3) + 1;
  const periods = trailingQuarters(year, quarter);

  const reports = await prisma.quarterlyReport.findMany({
    where: {
      partnerId,
      status: 'APPROVED',
      OR: periods.map(([y, q]) => ({ year: y, quarter: q })),
    },
    select: { id: true, confidenceScore: true },
  });

  const quartersReported = reports.length;
  const reportIds = reports.map((r) => r.id);

  const waste = reportIds.length
    ? await prisma.wasteRecord.findMany({
        where: { reportId: { in: reportIds } },
        select: { fate: true, tons: true },
      })
    : [];

  const totalWaste = waste.reduce((a, r) => a + r.tons, 0);
  const divertedTons = waste
    .filter((r) => (DIVERTED_FATES as readonly string[]).includes(r.fate))
    .reduce((a, r) => a + r.tons, 0);
  const diversionRatePct = totalWaste > 0 ? Math.round((divertedTons / totalWaste) * 100) : null;

  const confidences = reports
    .map((r) => r.confidenceScore)
    .filter((c): c is number => typeof c === 'number');
  const meanConfidence = confidences.length
    ? Math.round(confidences.reduce((a, c) => a + c, 0) / confidences.length)
    : null;

  if (quartersReported === 0) {
    return {
      score: 0, band: 'No data', bandAr: 'لا توجد بيانات',
      components: { diversion: 0, consistency: 0, dataQuality: 0 },
      diversionRatePct: null, quartersReported: 0, meanConfidence: null,
    };
  }

  const diversion = Math.round(((diversionRatePct ?? 0) / 100) * 50);
  const consistency = Math.round((quartersReported / 4) * 30);
  const dataQuality = Math.round(((meanConfidence ?? 0) / 100) * 20);
  const score = Math.min(100, diversion + consistency + dataQuality);
  const { band, bandAr } = bandFor(score);

  return {
    score, band, bandAr,
    components: { diversion, consistency, dataQuality },
    diversionRatePct, quartersReported, meanConfidence,
  };
}

// ─────────────────────────────────────────────────────────────────
// NET ZERO 2050 — individual + collective framing.
//
// The UAE has committed to net zero by 2050 (the "UAE Net Zero 2050"
// strategic initiative). We frame the network's MEASURED, INDICATIVE
// avoided emissions as a contribution to that national journey. These
// are not offsets or credits; they are an auditable running total.
// ─────────────────────────────────────────────────────────────────

export const UAE_NET_ZERO_TARGET_YEAR = 2050;

export interface NetZeroContext {
  currentYear: number;
  yearsToTarget: number;
  annualAvoidedTCO2e: number;      // this year, network-wide (indicative)
  cumulativeAvoidedTCO2e: number;  // all approved years to date (indicative)
  annualDivertedTons: number;      // diverted tons this year, network-wide
  carYearEquivalent: number;       // cumulative, for communication
  contributingPartners: number;    // partners with any diverted tonnage this year
  /** MRV coverage — % of the sector's ESTIMATED annual residue now measured
   *  by the network (reported waste tons ÷ baseline palm-byproduct estimate).
   *  This is the headline story number: how much of the invisible residue the
   *  platform has made visible. Null when the baseline is unknown. */
  measuredSharePct: number | null;
  estimatedNationalResidueTons: number; // baseline estimate the share is against
  perYear: Array<{ year: number; avoidedTCO2e: number; divertedTons: number; harmfulTons: number }>;
  /** Honesty contract: every figure here is indicative. Always true. */
  indicative: true;
}

/** Network-wide Net Zero context across all approved years. */
export async function nationalNetZeroContext(now: Date = new Date()): Promise<NetZeroContext> {
  const currentYear = new Date(now.getTime() + 4 * 60 * 60 * 1000).getUTCFullYear();

  const records = await prisma.wasteRecord.findMany({
    where: { report: { status: 'APPROVED' } },
    select: { fate: true, tons: true, report: { select: { year: true, partnerId: true } } },
  });

  const perYearMap = new Map<number, { diverted: number; harmful: number }>();
  const contributorsThisYear = new Set<string>();
  let cumulativeDiverted = 0;
  let annualDiverted = 0;
  let measuredThisYear = 0;

  for (const r of records) {
    const y = r.report.year;
    if (y === currentYear) measuredThisYear += r.tons;
    const py = perYearMap.get(y) ?? { diverted: 0, harmful: 0 };
    if ((DIVERTED_FATES as readonly string[]).includes(r.fate)) {
      py.diverted += r.tons;
      cumulativeDiverted += r.tons;
      if (y === currentYear) {
        annualDiverted += r.tons;
        contributorsThisYear.add(r.report.partnerId);
      }
    } else if ((HARMFUL_FATES as readonly string[]).includes(r.fate)) {
      py.harmful += r.tons;
    }
    perYearMap.set(y, py);
  }

  const cumulativeAvoided = cumulativeDiverted * INDICATIVE_FACTOR_TCO2E_PER_TON;

  // MRV coverage: reported residue tons vs the sector's baseline estimate.
  // Only REPORTED waste counts — the point is measured vs estimated.
  const nationalBaseline = REGION_BASELINE.reduce((a, r) => a + (r.palmByproductsTons ?? 0), 0);
  const measuredSharePct =
    nationalBaseline > 0 ? Math.round((measuredThisYear / nationalBaseline) * 1000) / 10 : null;

  return {
    currentYear,
    yearsToTarget: Math.max(0, UAE_NET_ZERO_TARGET_YEAR - currentYear),
    annualAvoidedTCO2e: Math.round(annualDiverted * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
    cumulativeAvoidedTCO2e: Math.round(cumulativeAvoided * 10) / 10,
    annualDivertedTons: Math.round(annualDiverted * 10) / 10,
    carYearEquivalent: Math.round(cumulativeAvoided / CAR_YEAR_TCO2E),
    contributingPartners: contributorsThisYear.size,
    measuredSharePct,
    estimatedNationalResidueTons: nationalBaseline,
    perYear: [...perYearMap.entries()]
      .map(([year, t]) => ({
        year,
        avoidedTCO2e: Math.round(t.diverted * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
        divertedTons: Math.round(t.diverted * 10) / 10,
        harmfulTons: Math.round(t.harmful * 10) / 10,
      }))
      .sort((a, b) => a.year - b.year),
    indicative: true,
  };
}

// ─────────────────────────────────────────────────────────────────
// CLIMATE NARRATIVE — frames residue diversion honestly.
//
// The honest physics: residue that is burned emits CO2 immediately;
// residue dumped or buried decomposes anaerobically and releases METHANE
// — a far more potent near-term warming gas. Diverting it (feed, sale,
// recycling) avoids BOTH. Methane is the near-term lever: cutting it
// buys time this decade. Diversion = methane avoidance (near-term win)
// + CO2 avoidance (permanent win).
// ─────────────────────────────────────────────────────────────────

export interface ClimateNarrative {
  headlineEn: string;
  headlineAr: string;
  detailEn: string;
  /** The avoided emissions figure — always indicative. */
  avoidedTCO2e: number;
  /** Still-on-the-table: what additional avoidance harmful tons would yield. */
  opportunityTCO2e: number;
  indicative: true;
}

/** Frame an EsgEstimate as methane + CO2 avoidance for any surface. */
export function climateNarrative(est: EsgEstimate): ClimateNarrative {
  const avoided = est.estAvoidedTCO2e;
  return {
    headlineEn: `${avoided.toLocaleString('en-US')} tCO₂e avoided — indicative`,
    headlineAr: `تجنب ${avoided.toLocaleString('en-US')} طن من ثاني أكسيد الكربون المكافئ — تقديري`,
    detailEn:
      'Residue diverted from burning skips the immediate CO₂ release; residue diverted from ' +
      'dumping skips the methane that anaerobic decay releases — a far more potent near-term ' +
      'warming gas. Diversion is a methane cut now plus a CO₂ cut permanently.',
    avoidedTCO2e: avoided,
    opportunityTCO2e: est.opportunityTCO2e,
    indicative: true,
  };
}
