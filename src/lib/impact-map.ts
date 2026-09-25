/**
 * Impact map aggregation — all seven emirates, for the public showcase.
 *
 * Returns one row per emirate (from the canonical list), with aggregate
 * participation / diversion / indicative avoided emissions. To honour the
 * ≥3-partner aggregate rule (UPN-3), metrics are nulled for any emirate
 * with fewer than MIN_AGGREGATE partners — the map still shows the emirate,
 * just without a figure that could expose a single partner.
 */

import { prisma } from './db';
import { REGION_BASELINE } from '@/facts';
import { DIVERTED_FATES, INDICATIVE_FACTOR_TCO2E_PER_TON } from './esg';
import { MIN_AGGREGATE } from './sector-report';

export interface EmirateImpact {
  code: string;
  nameEn: string;
  nameAr: string;
  baselineQuality: 'SURVEYED' | 'INDICATIVE';
  partners: number;
  participationPct: number | null; // null when suppressed or no partners
  diversionPct: number | null;
  avoidedTCO2e: number | null;
  suppressed: boolean;
}

export interface ImpactMapData {
  year: number;
  emirates: EmirateImpact[];
  totals: {
    partners: number;
    reportingPartners: number;
    divertedTons: number;
    avoidedTCO2e: number;
  };
}

export async function buildImpactMap(now: Date = new Date()): Promise<ImpactMapData> {
  const year = new Date(now.getTime() + 4 * 60 * 60 * 1000).getUTCFullYear();

  const partners = await prisma.partner.findMany({ select: { id: true, region: true } });
  const approved = await prisma.quarterlyReport.findMany({
    where: { year, status: 'APPROVED' },
    select: { partnerId: true, wasteRecords: { select: { fate: true, tons: true } } },
  });

  const reporting = new Set<string>();
  const divertedByPartner = new Map<string, number>();
  const wasteByPartner = new Map<string, number>();
  for (const r of approved) {
    reporting.add(r.partnerId);
    for (const w of r.wasteRecords) {
      wasteByPartner.set(r.partnerId, (wasteByPartner.get(r.partnerId) ?? 0) + w.tons);
      if ((DIVERTED_FATES as readonly string[]).includes(w.fate)) {
        divertedByPartner.set(r.partnerId, (divertedByPartner.get(r.partnerId) ?? 0) + w.tons);
      }
    }
  }

  const agg = new Map<string, { partners: number; reporting: number; diverted: number; waste: number }>();
  for (const p of partners) {
    const e = agg.get(p.region) ?? { partners: 0, reporting: 0, diverted: 0, waste: 0 };
    e.partners += 1;
    if (reporting.has(p.id)) e.reporting += 1;
    e.diverted += divertedByPartner.get(p.id) ?? 0;
    e.waste += wasteByPartner.get(p.id) ?? 0;
    agg.set(p.region, e);
  }

  const emirates: EmirateImpact[] = REGION_BASELINE.map((meta) => {
    const e = agg.get(meta.code) ?? { partners: 0, reporting: 0, diverted: 0, waste: 0 };
    const suppressed = e.partners < MIN_AGGREGATE;
    return {
      code: meta.code,
      nameEn: meta.nameEn,
      nameAr: meta.nameAr,
      baselineQuality: meta.baselineQuality,
      partners: e.partners,
      participationPct: suppressed || e.partners === 0 ? null : Math.round((e.reporting / e.partners) * 100),
      diversionPct: suppressed || e.waste === 0 ? null : Math.round((e.diverted / e.waste) * 100),
      avoidedTCO2e: suppressed ? null : Math.round(e.diverted * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
      suppressed,
    };
  });

  const divertedTons = [...divertedByPartner.values()].reduce((a, v) => a + v, 0);
  return {
    year,
    emirates,
    totals: {
      partners: partners.length,
      reportingPartners: reporting.size,
      divertedTons: Math.round(divertedTons * 10) / 10,
      avoidedTCO2e: Math.round(divertedTons * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10,
    },
  };
}
