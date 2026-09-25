/**
 * State of the Sector — national report aggregation.
 *
 * Builds an aggregate-only picture of the network from APPROVED reports:
 * participation, production, diversion, and indicative ESG, by emirate.
 *
 * Privacy (rule UPN-3): every figure here is an aggregate. Per-emirate
 * rows are only broken out when at least MIN_AGGREGATE partners exist in
 * that emirate; smaller emirates are folded into "Other emirates" so no
 * single partner can be inferred.
 */

import { prisma } from './db';
import { REGION_BASELINE } from '@/facts';
import {
  DIVERTED_FATES,
  INDICATIVE_FACTOR_TCO2E_PER_TON,
  nationalEsgEstimate,
  nationalNetZeroContext,
  type EsgEstimate,
  type NetZeroContext,
} from './esg';

export const MIN_AGGREGATE = 3;

export interface EmirateStat {
  code: string;
  nameEn: string;
  nameAr: string;
  baselineQuality: 'SURVEYED' | 'INDICATIVE';
  partners: number;
  reportingPartners: number;
  reportingRatePct: number | null;
  productionTons: number;
  divertedTons: number;
  diversionRatePct: number | null;
  estAvoidedTCO2e: number;
  suppressed: boolean; // true when partner count < MIN_AGGREGATE
}

export interface SectorReport {
  year: number;
  generatedAt: string;
  totals: {
    partners: number;
    reportingPartners: number;
    participationRatePct: number | null;
    approvedReports: number;
    productionTons: number;
    divertedTons: number;
    diversionRatePct: number | null;
  };
  byType: Array<{ type: string; count: number }>;
  byTier: Array<{ tier: string; count: number }>;
  emirates: EmirateStat[];
  otherEmirates: { count: number; partners: number } | null; // folded small emirates
  esg: EsgEstimate;
  netZero: NetZeroContext;
}

const REGION_META = new Map(REGION_BASELINE.map((r) => [r.code, r]));

export async function buildSectorReport(now: Date = new Date()): Promise<SectorReport> {
  const gst = new Date(now.getTime() + 4 * 60 * 60 * 1000); // UAE UTC+4
  const year = gst.getUTCFullYear();

  const partners = await prisma.partner.findMany({
    select: { id: true, region: true, type: true, tier: true },
  });

  const approved = await prisma.quarterlyReport.findMany({
    where: { year, status: 'APPROVED' },
    select: {
      partnerId: true,
      production: { select: { datesProducedTons: true } },
      wasteRecords: { select: { fate: true, tons: true } },
    },
  });

  // Per-partner rollups for this year.
  const reportingByPartner = new Set<string>();
  const prodByPartner = new Map<string, number>();
  const divertedByPartner = new Map<string, number>();
  const wasteByPartner = new Map<string, number>();

  for (const r of approved) {
    reportingByPartner.add(r.partnerId);
    if (r.production?.datesProducedTons) {
      prodByPartner.set(r.partnerId, (prodByPartner.get(r.partnerId) ?? 0) + r.production.datesProducedTons);
    }
    for (const w of r.wasteRecords) {
      wasteByPartner.set(r.partnerId, (wasteByPartner.get(r.partnerId) ?? 0) + w.tons);
      if ((DIVERTED_FATES as readonly string[]).includes(w.fate)) {
        divertedByPartner.set(r.partnerId, (divertedByPartner.get(r.partnerId) ?? 0) + w.tons);
      }
    }
  }

  const partnerRegion = new Map(partners.map((p) => [p.id, p.region as string]));

  // Aggregate by emirate.
  const emirateRaw = new Map<string, { partners: number; reporting: number; prod: number; diverted: number; waste: number }>();
  for (const p of partners) {
    const e = emirateRaw.get(p.region) ?? { partners: 0, reporting: 0, prod: 0, diverted: 0, waste: 0 };
    e.partners += 1;
    if (reportingByPartner.has(p.id)) e.reporting += 1;
    e.prod += prodByPartner.get(p.id) ?? 0;
    e.diverted += divertedByPartner.get(p.id) ?? 0;
    e.waste += wasteByPartner.get(p.id) ?? 0;
    emirateRaw.set(p.region, e);
  }

  const emirates: EmirateStat[] = [];
  let otherCount = 0;
  let otherPartners = 0;

  for (const [code, e] of emirateRaw.entries()) {
    const meta = REGION_META.get(code);
    const suppressed = e.partners < MIN_AGGREGATE;
    if (suppressed) {
      otherCount += 1;
      otherPartners += e.partners;
    }
    emirates.push({
      code,
      nameEn: meta?.nameEn ?? code,
      nameAr: meta?.nameAr ?? code,
      baselineQuality: (meta?.baselineQuality ?? 'INDICATIVE') as 'SURVEYED' | 'INDICATIVE',
      partners: e.partners,
      reportingPartners: e.reporting,
      reportingRatePct: e.partners > 0 ? Math.round((e.reporting / e.partners) * 100) : null,
      productionTons: Math.round(e.prod * 10) / 10,
      divertedTons: Math.round(e.diverted * 10) / 10,
      diversionRatePct: e.waste > 0 ? Math.round((e.diverted / e.waste) * 100) : null,
      estAvoidedTCO2e: Math.round(e.diverted * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
      suppressed,
    });
  }

  // Visible rows: only emirates with >= MIN_AGGREGATE partners, biggest first.
  const visible = emirates
    .filter((e) => !e.suppressed)
    .sort((a, b) => b.partners - a.partners);

  const byTypeMap = new Map<string, number>();
  const byTierMap = new Map<string, number>();
  for (const p of partners) {
    byTypeMap.set(p.type, (byTypeMap.get(p.type) ?? 0) + 1);
    byTierMap.set(p.tier, (byTierMap.get(p.tier) ?? 0) + 1);
  }

  const totalProd = [...prodByPartner.values()].reduce((a, v) => a + v, 0);
  const totalDiverted = [...divertedByPartner.values()].reduce((a, v) => a + v, 0);
  const totalWaste = [...wasteByPartner.values()].reduce((a, v) => a + v, 0);

  const [esg, netZero] = await Promise.all([
    nationalEsgEstimate(year),
    nationalNetZeroContext(now),
  ]);

  void partnerRegion; // reserved for future per-type-by-emirate cuts

  return {
    year,
    generatedAt: gst.toISOString().slice(0, 10),
    totals: {
      partners: partners.length,
      reportingPartners: reportingByPartner.size,
      participationRatePct: partners.length > 0 ? Math.round((reportingByPartner.size / partners.length) * 100) : null,
      approvedReports: approved.length,
      productionTons: Math.round(totalProd * 10) / 10,
      divertedTons: Math.round(totalDiverted * 10) / 10,
      diversionRatePct: totalWaste > 0 ? Math.round((totalDiverted / totalWaste) * 100) : null,
    },
    byType: [...byTypeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byTier: [...byTierMap.entries()].map(([tier, count]) => ({ tier, count })),
    emirates: visible,
    otherEmirates: otherCount > 0 ? { count: otherCount, partners: otherPartners } : null,
    esg,
    netZero,
  };
}
