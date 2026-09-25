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

/** Indicative tCO2e avoided per ton of residue diverted from burn/bury/dump. */
export const INDICATIVE_FACTOR_TCO2E_PER_TON = 1.2;

/** Fates that count as productive diversion. */
export const DIVERTED_FATES = ['FEED', 'SOLD', 'RECYCLED'] as const;

/** Rough equivalence for communication only: passenger car-year ≈ 4.6 tCO2e. */
const CAR_YEAR_TCO2E = 4.6;

export interface EsgEstimate {
  year: number;
  divertedTons: number;
  totalWasteTons: number;
  diversionRatePct: number | null;
  estAvoidedTCO2e: number;
  carYearEquivalent: number;
  byStream: Array<{ stream: string; divertedTons: number; estAvoidedTCO2e: number }>;
}

function summarize(
  year: number,
  records: Array<{ stream: string; fate: string; tons: number }>,
): EsgEstimate {
  const total = records.reduce((a, r) => a + r.tons, 0);
  const diverted = records.filter((r) => (DIVERTED_FATES as readonly string[]).includes(r.fate));
  const divertedTons = diverted.reduce((a, r) => a + r.tons, 0);

  const byStreamMap = new Map<string, number>();
  for (const r of diverted) {
    byStreamMap.set(r.stream, (byStreamMap.get(r.stream) ?? 0) + r.tons);
  }

  const est = divertedTons * INDICATIVE_FACTOR_TCO2E_PER_TON;
  return {
    year,
    divertedTons,
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
  carYearEquivalent: number;       // cumulative, for communication
  contributingPartners: number;    // partners with any diverted tonnage this year
  perYear: Array<{ year: number; avoidedTCO2e: number }>;
}

/** Network-wide Net Zero context across all approved years. */
export async function nationalNetZeroContext(now: Date = new Date()): Promise<NetZeroContext> {
  const currentYear = new Date(now.getTime() + 4 * 60 * 60 * 1000).getUTCFullYear();

  const records = await prisma.wasteRecord.findMany({
    where: { report: { status: 'APPROVED' } },
    select: { fate: true, tons: true, report: { select: { year: true, partnerId: true } } },
  });

  const perYearMap = new Map<number, number>();
  const contributorsThisYear = new Set<string>();
  let cumulativeDiverted = 0;
  let annualDiverted = 0;

  for (const r of records) {
    if (!(DIVERTED_FATES as readonly string[]).includes(r.fate)) continue;
    const y = r.report.year;
    cumulativeDiverted += r.tons;
    perYearMap.set(y, (perYearMap.get(y) ?? 0) + r.tons);
    if (y === currentYear) {
      annualDiverted += r.tons;
      contributorsThisYear.add(r.report.partnerId);
    }
  }

  const cumulativeAvoided = cumulativeDiverted * INDICATIVE_FACTOR_TCO2E_PER_TON;

  return {
    currentYear,
    yearsToTarget: Math.max(0, UAE_NET_ZERO_TARGET_YEAR - currentYear),
    annualAvoidedTCO2e: Math.round(annualDiverted * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
    cumulativeAvoidedTCO2e: Math.round(cumulativeAvoided * 10) / 10,
    carYearEquivalent: Math.round(cumulativeAvoided / CAR_YEAR_TCO2E),
    contributingPartners: contributorsThisYear.size,
    perYear: [...perYearMap.entries()]
      .map(([year, tons]) => ({ year, avoidedTCO2e: Math.round(tons * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10 }))
      .sort((a, b) => a.year - b.year),
  };
}
