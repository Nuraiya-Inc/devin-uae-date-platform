/**
 * Regional Standings — the national scoreboard.
 *
 * Honor-based competition between regions: participation rate, reported
 * production, and diversion share for the current reporting cycle. Regions
 * are ranked; the top three get podium treatment. This is the screen an
 * official shows a regional director to move a region — recognition, not
 * penalty (hard rule: never scold).
 *
 * All figures come from partner-submitted, APPROVED reports — labeled as
 * such and never blended silently with the national baseline (UPN-7).
 */

import { prisma } from '@/lib/db';
import { REGION_BASELINE } from '@/facts';

export const dynamic = 'force-dynamic';

function currentCycle(): { year: number; quarter: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), quarter: Math.floor(now.getUTCMonth() / 3) + 1 };
}

function prevCycle(c: { year: number; quarter: number }) {
  return c.quarter === 1 ? { year: c.year - 1, quarter: 4 } : { year: c.year, quarter: c.quarter - 1 };
}

const DIVERTED = ['FEED', 'SOLD', 'RECYCLED'];
const RANK_BADGE = ['bg-gradient-to-br from-gold-400 to-gold-600 text-white', 'bg-gradient-to-br from-slate-300 to-slate-400 text-white', 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'];

interface Row {
  code: string;
  nameEn: string;
  nameAr: string;
  partners: number;
  reporters: number;
  participation: number; // 0..1
  tons: number;
  divertedShare: number | null; // 0..1 or null when no waste reported
  score: number;
}

export default async function StandingsPage() {
  const cycle = currentCycle();
  // Score the most recent COMPLETED cycle plus the live one — a region that
  // already reported this quarter should see it count immediately.
  const scored = [cycle, prevCycle(cycle)];

  const partners = await prisma.partner.findMany({
    select: { id: true, region: true },
  });
  const reports = await prisma.quarterlyReport.findMany({
    where: {
      OR: scored.map((c) => ({ year: c.year, quarter: c.quarter })),
      status: { in: ['SUBMITTED', 'VALIDATED', 'APPROVED'] },
    },
    select: {
      partnerId: true,
      status: true,
      partner: { select: { region: true } },
      production: { select: { datesProducedTons: true } },
      wasteRecords: { select: { fate: true, tons: true } },
    },
  });

  const byRegion = new Map<string, Row>();
  for (const b of REGION_BASELINE) {
    byRegion.set(b.code, {
      code: b.code, nameEn: b.nameEn, nameAr: b.nameAr,
      partners: 0, reporters: 0, participation: 0, tons: 0, divertedShare: null, score: 0,
    });
  }
  for (const p of partners) {
    const r = byRegion.get(p.region);
    if (r) r.partners++;
  }

  const reportedPartner = new Set<string>();
  const wasteTotals = new Map<string, { diverted: number; total: number }>();
  for (const rep of reports) {
    const r = byRegion.get(rep.partner.region);
    if (!r) continue;
    if (!reportedPartner.has(rep.partnerId)) {
      reportedPartner.add(rep.partnerId);
      r.reporters++;
    }
    if (rep.status === 'APPROVED') {
      if (rep.production) r.tons += rep.production.datesProducedTons ?? 0;
      const w = wasteTotals.get(r.code) ?? { diverted: 0, total: 0 };
      for (const wr of rep.wasteRecords) {
        w.total += wr.tons;
        if (DIVERTED.includes(wr.fate)) w.diverted += wr.tons;
      }
      wasteTotals.set(r.code, w);
    }
  }

  const rows: Row[] = [];
  for (const r of byRegion.values()) {
    r.participation = r.partners > 0 ? Math.min(1, r.reporters / r.partners) : 0;
    const w = wasteTotals.get(r.code);
    r.divertedShare = w && w.total > 0 ? w.diverted / w.total : null;
    // Score: participation dominates (the behavior the network wants), diversion
    // second, volume third (log-damped so big regions don't win by size alone).
    r.score =
      r.participation * 100 +
      (r.divertedShare ?? 0) * 30 +
      Math.log10(1 + r.tons) * 5;
    rows.push(r);
  }
  rows.sort((a, b) => b.score - a.score || b.partners - a.partners);

  const active = rows.filter((r) => r.partners > 0);
  const dormant = rows.filter((r) => r.partners === 0);
  const cycleLabel = `${prevCycle(cycle).year} Q${prevCycle(cycle).quarter} – ${cycle.year} Q${cycle.quarter}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Regional Standings</h1>
          <p className="text-sm text-muted">
            الترتيب الوطني للمناطق — reporting cycle {cycleLabel} · from partner-submitted reports only
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-muted">
          Rank = participation first, diversion second, volume third
        </div>
      </div>

      {/* Podium — top three active regions */}
      <div className="grid gap-4 md:grid-cols-3">
        {active.slice(0, 3).map((r, i) => (
          <div
            key={r.code}
            className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card-hover"
          >
            <div className="gold-bar absolute inset-x-0 top-0" aria-hidden />
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-ink">{r.nameEn}</div>
                <div className="text-sm text-brand-700">{r.nameAr}</div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold shadow ${RANK_BADGE[i]}`}>
                {i + 1}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted">
                  <span>Participation</span>
                  <span className="font-semibold text-ink">
                    {r.reporters}/{r.partners} · {Math.round(r.participation * 100)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-mist">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-600 to-mint-500"
                    style={{ width: `${Math.round(r.participation * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-lg bg-mist p-2">
                  <div className="font-semibold text-ink">{r.tons.toLocaleString(undefined, { maximumFractionDigits: 0 })} t</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">reported production</div>
                </div>
                <div className="rounded-lg bg-mist p-2">
                  <div className="font-semibold text-ink">
                    {r.divertedShare == null ? '—' : `${Math.round(r.divertedShare * 100)}%`}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">byproducts diverted</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="p-3">Rank</th>
              <th className="p-3">Region</th>
              <th className="p-3">Partners</th>
              <th className="p-3">Reported this cycle</th>
              <th className="p-3">Participation</th>
              <th className="p-3">Production (t)</th>
              <th className="p-3">Diverted</th>
            </tr>
          </thead>
          <tbody>
            {active.map((r, i) => (
              <tr key={r.code} className="border-t border-line/70">
                <td className="p-3">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? RANK_BADGE[i] : 'bg-mist text-muted'}`}>
                    {i + 1}
                  </span>
                </td>
                <td className="p-3">
                  <span className="font-medium text-ink">{r.nameEn}</span>
                  <span className="text-muted"> · {r.nameAr}</span>
                </td>
                <td className="p-3">{r.partners}</td>
                <td className="p-3">{r.reporters}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${Math.round(r.participation * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted">{Math.round(r.participation * 100)}%</span>
                  </div>
                </td>
                <td className="p-3">{r.tons.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                <td className="p-3">{r.divertedShare == null ? '—' : `${Math.round(r.divertedShare * 100)}%`}</td>
              </tr>
            ))}
            {dormant.length > 0 && (
              <tr className="border-t border-line/70">
                <td className="p-3 text-muted" colSpan={7}>
                  Awaiting first registered partner: {dormant.map((r) => r.nameEn).join(' · ')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Figures reflect partner-submitted reports (submitted or better; production and diversion counted once
        approved) — not the national baseline. Standings recognize participation; no region is penalized. Regional
        recognition letters can be drafted from here via Abdullah.
      </p>
    </div>
  );
}
