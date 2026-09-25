/**
 * State of the Sector — the network's annual national report, generated
 * live from approved partner data. Aggregate-only (rule UPN-3): per-emirate
 * rows appear only where ≥3 partners exist; smaller emirates are folded.
 *
 * "Print / Save as PDF" uses the browser's native print — the layout has
 * print styles, so the exported PDF is clean and bilingual.
 */

import { buildSectorReport } from '@/lib/sector-report';
import { INDICATIVE_FACTOR_TCO2E_PER_TON } from '@/lib/esg';
import PrintButton from '@/components/PrintButton';
import Logo from '@/components/brand/Logo';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  FARM: 'Farms', FACTORY: 'Factories', COMPANY: 'Companies',
  RECYCLER: 'Recyclers', COLLECTOR: 'Collectors',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-2xl font-semibold tracking-tight text-brand-800">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export default async function StateOfSectorPage() {
  const r = await buildSectorReport();
  const t = r.totals;
  const hasData = t.approvedReports > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
            State of the Sector · تقرير حالة القطاع
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-800 sm:text-3xl">
            UAE Date-Palm Sector — {r.year}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Generated {r.generatedAt} from approved partner reports. Aggregate figures only.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="hidden print:block"><Logo width={150} /></div>
          <PrintButton />
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center">
          <p className="text-sm text-ink">No approved reports yet for {r.year}.</p>
          <p className="mt-1 text-xs text-muted">
            The report fills automatically as partners submit and officials approve. Seed the demo
            data to preview it with a full year of activity.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Registered partners" value={t.partners.toLocaleString('en-US')} />
            <Stat label="Reporting this year" value={t.reportingPartners.toLocaleString('en-US')}
              sub={t.participationRatePct !== null ? `${t.participationRatePct}% participation` : undefined} />
            <Stat label="Dates reported (t)" value={t.productionTons.toLocaleString('en-US')} />
            <Stat label="Diverted (t)" value={t.divertedTons.toLocaleString('en-US')}
              sub={t.diversionRatePct !== null ? `${t.diversionRatePct}% of residue` : undefined} />
          </section>

          {/* Net Zero contribution */}
          <section className="rounded-2xl border border-gold-300 bg-gold-50 p-5">
            <h2 className="text-base font-semibold text-brand-800">
              Contribution to UAE Net Zero {r.netZero.currentYear + r.netZero.yearsToTarget}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label={`${r.year} avoided (est., indicative)`} value={`${r.netZero.annualAvoidedTCO2e.toLocaleString('en-US')} tCO₂e`} />
              <Stat label="Cumulative avoided (est.)" value={`${r.netZero.cumulativeAvoidedTCO2e.toLocaleString('en-US')} tCO₂e`}
                sub={r.netZero.carYearEquivalent > 0 ? `≈ ${r.netZero.carYearEquivalent.toLocaleString('en-US')} car-years` : undefined} />
              <Stat label="Contributing partners" value={r.netZero.contributingPartners.toLocaleString('en-US')} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Indicative estimate using a conservative placeholder factor of {INDICATIVE_FACTOR_TCO2E_PER_TON} tCO₂e
              per productively-diverted ton. Not verified carbon accounting; not tradeable credits.
              An auditable record contributing to the Emirates&apos; national net-zero journey.
            </p>
          </section>

          {/* By emirate */}
          <section className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold text-brand-800">By emirate</h2>
              <p className="text-[11px] text-muted">Emirates with fewer than 3 partners are folded into &quot;Other&quot; to protect confidentiality.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-5 py-2 font-medium">Emirate</th>
                    <th className="px-3 py-2 font-medium">Baseline</th>
                    <th className="px-3 py-2 text-right font-medium">Partners</th>
                    <th className="px-3 py-2 text-right font-medium">Reporting</th>
                    <th className="px-3 py-2 text-right font-medium">Production (t)</th>
                    <th className="px-3 py-2 text-right font-medium">Diversion</th>
                    <th className="px-5 py-2 text-right font-medium">tCO₂e (est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.emirates.map((e) => (
                    <tr key={e.code} className="border-b border-line/60">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-ink">{e.nameEn}</span>
                        <span className="text-muted"> · {e.nameAr}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.baselineQuality === 'SURVEYED' ? 'bg-mint-100 text-mint-700' : 'bg-mist text-muted'}`}>
                          {e.baselineQuality === 'SURVEYED' ? 'Surveyed' : 'Indicative'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{e.partners}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{e.reportingRatePct !== null ? `${e.reportingRatePct}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{e.productionTons.toLocaleString('en-US')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{e.diversionRatePct !== null ? `${e.diversionRatePct}%` : '—'}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{e.estAvoidedTCO2e.toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                  {r.otherEmirates && (
                    <tr className="border-b border-line/60 text-muted">
                      <td className="px-5 py-2.5 italic">Other emirates ({r.otherEmirates.count})</td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.otherEmirates.partners}</td>
                      <td className="px-3 py-2.5 text-right" colSpan={4}>folded for confidentiality</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Composition */}
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-brand-800">Network by actor type</h2>
              <div className="space-y-2">
                {r.byType.map((row) => {
                  const max = r.byType[0]?.count || 1;
                  return (
                    <div key={row.type}>
                      <div className="mb-0.5 flex justify-between text-xs">
                        <span className="text-ink">{TYPE_LABEL[row.type] ?? row.type}</span>
                        <span className="tabular-nums text-muted">{row.count}</span>
                      </div>
                      <div className="h-[6px] overflow-hidden rounded-full bg-mist">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${(row.count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="mb-3 text-base font-semibold text-brand-800">Membership tiers</h2>
              <div className="space-y-2">
                {r.byTier.map((row) => (
                  <div key={row.tier} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{row.tier}</span>
                    <span className="tabular-nums text-muted">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p className="pb-6 text-center text-[11px] text-muted">
            UAE Palm Network · operated with Nuraiya · technology by Safa BioWorks FZE. Figures are
            aggregates from approved reports; ESG values are indicative estimates, not verified
            carbon accounting.
          </p>
        </>
      )}
    </div>
  );
}
