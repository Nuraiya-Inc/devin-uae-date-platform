/**
 * UAE Palm Network — UAE overview dashboard.
 *
 * The showpiece screen: a hero panel with the national opportunity, animated
 * KPI tiles, the regional measured-vs-modeled chart, byproduct composition,
 * the membership ladder, and live activity. Baseline figures are the network's
 * modeled estimates (May 2026, Restricted); measured figures come from
 * APPROVED quarterly reports.
 */

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { REGION_BASELINE, UPN_FACTS } from '@/facts';
import CountUp from '@/components/viz/CountUp';
import RegionBars from '@/components/viz/RegionBars';
import NetZeroTrajectory from '@/components/NetZeroTrajectory';
import IndicativeChip from '@/components/IndicativeChip';
import MandateBadges from '@/components/MandateBadges';
import { nationalEsgEstimate, nationalNetZeroContext, UAE_NET_ZERO_TARGET_YEAR } from '@/lib/esg';

export const dynamic = 'force-dynamic';

// Byproduct composition palette — validated (dataviz six checks, light mode).
// Order is fixed; adjacent hues alternate families for CVD separation.
const COMPOSITION = [
  { key: 'Fronds', ar: 'سعف', hex: '#0B7FB0' },
  { key: 'Fibers', ar: 'ليف', hex: '#E08A00' },
  { key: 'Frond bases', ar: 'كرب', hex: '#4BA6F0' },
  { key: 'Other', ar: 'أخرى', hex: '#8F5E0A' },
] as const;

export default async function DashboardPage() {
  const [
    partnerCount,
    partnersByTier,
    partnersByRegion,
    reportCounts,
    approvedReports,
    pendingApprovals,
    recentActivity,
  ] = await Promise.all([
    prisma.partner.count(),
    prisma.partner.groupBy({ by: ['tier'], _count: true }),
    prisma.partner.groupBy({ by: ['region'], _count: true }),
    prisma.quarterlyReport.groupBy({ by: ['status'], _count: true }),
    prisma.quarterlyReport.findMany({
      where: { status: 'APPROVED' },
      include: { production: true, wasteRecords: true, partner: { select: { region: true } } },
    }),
    prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
    prisma.activityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 7,
      include: { actorAgent: { select: { slug: true } }, actorUser: { select: { name: true } } },
    }),
  ]);

  const [esg, netZero] = await Promise.all([
    nationalEsgEstimate(new Date().getUTCFullYear()),
    nationalNetZeroContext(),
  ]);
  const totals = UPN_FACTS.baseline.nationalTotals;
  const tierCount = (t: string) => partnersByTier.find((x) => x.tier === t)?._count ?? 0;
  const statusCount = (s: string) => reportCounts.find((x) => x.status === s)?._count ?? 0;

  const measuredProductionTons = approvedReports.reduce(
    (a, r) => a + (r.production?.datesProducedTons ?? 0),
    0,
  );
  const coveragePct = Math.min(100, (measuredProductionTons / totals.dateProductionTons) * 100);

  const allWaste = approvedReports.flatMap((r) => r.wasteRecords);
  const wasteTons = allWaste.reduce((a, w) => a + w.tons, 0);
  const divertedTons = allWaste
    .filter((w) => w.fate === 'RECYCLED' || w.fate === 'SOLD' || w.fate === 'FEED')
    .reduce((a, w) => a + w.tons, 0);
  const diversionPct = wasteTons > 0 ? Math.round((divertedTons / wasteTons) * 100) : null;

  const measuredByRegion = new Map<string, number>();
  for (const r of approvedReports) {
    measuredByRegion.set(
      r.partner.region,
      (measuredByRegion.get(r.partner.region) ?? 0) + (r.production?.datesProducedTons ?? 0),
    );
  }
  const partnersInRegion = (code: string) =>
    partnersByRegion.find((x) => x.region === code)?._count ?? 0;

  const regionRows = REGION_BASELINE.map((r) => ({
    code: r.code,
    nameEn: r.nameEn,
    nameAr: r.nameAr,
    baseline: r.dateProductionTons,
    measured: measuredByRegion.get(r.code) ?? 0,
    partners: partnersInRegion(r.code),
  }));

  // Byproduct composition values (national baseline)
  const compTotal = 459703.5 + 22539.1 + 244173.4 + 24886.9;
  const compValues = [459703.5, 22539.1, 244173.4, 24886.9]; // fronds, fibers, frond bases, other

  // Gauge: share of the byproduct stream measured through approved reports
  const usedPct = Math.max(1, Math.round(coveragePct));
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const arc = (CIRC * 270) / 360; // 270° gauge
  const usedLen = (arc * usedPct) / 100;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-4">
      {/* ── Hero: the national opportunity ─────────────────── */}
      <section className="fade-up relative overflow-hidden rounded-2xl bg-brand-gradient text-white shadow-card-hover">
        <div className="dot-grid absolute inset-0" aria-hidden />
        <div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #D5B672 0%, transparent 65%)' }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-8 p-7 sm:p-9 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-gold-200">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" />
              The national opportunity
            </div>
            <div className="text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
              <CountUp value={totals.palmByproductsTons} duration={1400} />
              <span className="ml-2 text-2xl font-normal text-white/70">tons / year</span>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75">
              of palm byproducts are generated every year across the tracked emirates — and their fate
              is almost entirely unmeasured. Every approved report on this platform replaces an
              indicative estimate with measured national data, and every diverted ton is a visible
              contribution to the Emirates&apos; circular-economy and Net Zero 2050 goals.
            </p>
            {netZero.measuredSharePct !== null && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2">
                <span className="text-2xl font-semibold tabular-nums">
                  <CountUp value={netZero.measuredSharePct} decimals={netZero.measuredSharePct < 10 ? 1 : 0} suffix="%" />
                </span>
                <span className="text-[11px] leading-tight text-white/75">
                  of estimated national residue<br />now measured · the MRV gap we close
                </span>
              </div>
            )}
          </div>

          {/* Utilization gauge — 270° arc */}
          <div className="relative mx-auto shrink-0 md:mx-0">
            <svg width="164" height="164" viewBox="0 0 132 132" role="img" aria-label={`Share of stream measured ${usedPct}%`}>
              <g transform="rotate(135 66 66)">
                <circle
                  cx="66" cy="66" r={R} fill="none"
                  stroke="rgba(255,255,255,0.14)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${arc} ${CIRC}`}
                />
                <circle
                  className="arc-animate"
                  cx="66" cy="66" r={R} fill="none"
                  stroke="#D5B672" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${CIRC} ${CIRC}`}
                  style={{
                    ['--arc-len' as string]: `${CIRC}`,
                    ['--arc-off' as string]: `${CIRC - usedLen}`,
                  }}
                />
              </g>
              <text x="66" y="60" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="600">
                {usedPct}%
              </text>
              <text x="66" y="78" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="9.5">
                of stream measured
              </text>
              <text x="66" y="90" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="8">
                baseline · modeled
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* ── National ESG strip ─────────────────────────────── */}
      <section className="fade-up fade-up-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint-300 bg-mint-100/60 px-5 py-4 shadow-card">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-mint-700">
            National climate contribution · measured, indicative
          </div>
          <div className="mt-0.5 text-xl font-semibold text-ink">
            ~<CountUp value={esg.estAvoidedTCO2e} /> tCO₂e avoided this year
            <IndicativeChip className="mx-2 -translate-y-0.5 align-middle" />
            <span className="text-sm font-normal text-muted">
              from {esg.divertedTons.toLocaleString('en-US')} t verified diversion
              {esg.carYearEquivalent > 0 && ` · ≈ ${esg.carYearEquivalent.toLocaleString('en-US')} cars off the road`}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-muted">
          Indicative factor · not verified carbon accounting — MRV dataset for GCOM/RVCMC readiness
        </span>
      </section>

      {/* ── Net Zero 2050 trajectory + fate shift ────────────── */}
      <section className="fade-up fade-up-2 grid gap-6 lg:grid-cols-5">
        {/* Trajectory */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:col-span-3">
          <div className="section-rule" aria-hidden />
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-brand-800">
                Net Zero {UAE_NET_ZERO_TARGET_YEAR} trajectory
              </h2>
              <p className="text-xs text-muted">
                Cumulative measured diversion, priced as indicative avoided emissions · hover a point for detail
              </p>
            </div>
            <IndicativeChip />
          </div>
          <div className="mt-4">
            {netZero.perYear.length > 0 ? (
              <NetZeroTrajectory
                perYear={netZero.perYear}
                targetYear={UAE_NET_ZERO_TARGET_YEAR}
                currentYear={netZero.currentYear}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted">
                The trajectory starts with the first approved report.
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted">
            <span>
              <span className="font-semibold text-ink tabular-nums">
                {netZero.cumulativeAvoidedTCO2e.toLocaleString('en-US')}
              </span>{' '}
              tCO₂e cumulative (indicative)
            </span>
            <span>
              <span className="font-semibold text-ink tabular-nums">
                {netZero.contributingPartners}
              </span>{' '}
              partners contributing in {netZero.currentYear}
            </span>
            <span>
              <span className="font-semibold text-ink tabular-nums">
                {netZero.yearsToTarget}
              </span>{' '}
              years to the horizon
            </span>
          </div>
        </div>

        {/* Fate shift — diverted vs harmful, diverging palette */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:col-span-2">
          <div className="section-rule" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-brand-800">Fate shift</h2>
          <p className="mb-4 text-xs text-muted">
            Residue diverted vs burned/buried/dumped, per year — the shift the platform measures
          </p>
          {netZero.perYear.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No approved reports yet.</p>
          ) : (
            <div className="space-y-4">
              {netZero.perYear.map((y) => {
                const tot = y.divertedTons + y.harmfulTons;
                const pct = tot > 0 ? (y.divertedTons / tot) * 100 : 0;
                return (
                  <div key={y.year}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-ink">{y.year}</span>
                      <span className="tabular-nums text-muted">
                        {Math.round(pct)}% diverted
                      </span>
                    </div>
                    <div className="flex h-[18px] w-full gap-[2px] overflow-hidden rounded-lg">
                      <div
                        className="viz-grow h-full bg-mint-500"
                        style={{ width: `${pct}%` }}
                        title={`${y.divertedTons.toLocaleString('en-US')} t diverted`}
                      />
                      <div
                        className="h-full bg-gold-600"
                        style={{ width: `${100 - pct}%` }}
                        title={`${y.harmfulTons.toLocaleString('en-US')} t burned/buried/dumped`}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-muted">
                      <span>{y.divertedTons.toLocaleString('en-US')} t diverted</span>
                      <span>{y.harmfulTons.toLocaleString('en-US')} t still harmful</span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 pt-1 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-[3px] bg-mint-500" /> Diverted
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-[3px] bg-gold-600" /> Burned · buried · dumped
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Mandate hooks — every number feeds a commitment ── */}
      <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-brand-800">
            What these numbers feed
          </h2>
          <span className="text-[11px] text-muted">measured residue → national mandates</span>
        </div>
        <MandateBadges />
      </section>

      {/* ── KPI tiles ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile className="fade-up fade-up-1" label="Network partners" href="/partners">
          <div className="text-3xl font-semibold tracking-tight text-ink">
            <CountUp value={partnerCount} />
          </div>
          <TileHint>{tierCount('CERTIFIED') + tierCount('ELITE')} certified or elite</TileHint>
        </Tile>

        <Tile className="fade-up fade-up-2" label="Measured coverage">
          <div className="text-3xl font-semibold tracking-tight text-ink">
            {coveragePct > 0 && coveragePct < 1 ? (
              <CountUp value={coveragePct} decimals={2} suffix="%" />
            ) : (
              <CountUp value={Math.round(coveragePct)} suffix="%" />
            )}
          </div>
          {/* meter: filled accent on a lighter step of the same ramp */}
          <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-brand-100">
            <div
              className="viz-grow h-full rounded-full bg-brand-600"
              style={{ width: `${Math.max(coveragePct, 1.2)}%` }}
            />
          </div>
          <TileHint>of national production under approved reports</TileHint>
        </Tile>

        <Tile className="fade-up fade-up-3" label="Reports in pipeline" href="/approvals">
          <div className="text-3xl font-semibold tracking-tight text-ink">
            <CountUp value={statusCount('SUBMITTED') + statusCount('VALIDATED') + statusCount('DRAFT')} />
          </div>
          <TileHint>
            {statusCount('DRAFT')} draft · {statusCount('SUBMITTED')} submitted · {statusCount('APPROVED')} approved
          </TileHint>
        </Tile>

        <Tile className="fade-up fade-up-4" label="Waste diversion (measured)">
          <div className="text-3xl font-semibold tracking-tight text-ink">
            {diversionPct !== null ? <CountUp value={diversionPct} suffix="%" /> : '—'}
          </div>
          <TileHint>vs unmeasured fate in the baseline</TileHint>
        </Tile>
      </section>

      {pendingApprovals > 0 && (
        <Link
          href="/approvals"
          className="fade-up fade-up-2 flex items-center justify-between rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-800 shadow-card transition hover:shadow-card-hover"
        >
          <span>
            <span className="font-semibold">{pendingApprovals}</span> decision
            {pendingApprovals === 1 ? '' : 's'} awaiting a network official — tier changes apply only
            with your approval
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      {/* ── Regions chart ──────────────────────────────────── */}
      <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <header className="mb-5 flex items-baseline justify-between">
          <div>
            <div className="section-rule" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight text-brand-800">
              Regions — measured vs modeled
            </h2>
            <p className="text-xs text-muted">
              Annual date production per administrative region · hover a bar for detail
            </p>
          </div>
          <Link href="/facts" className="text-xs text-brand-600 hover:underline">
            Table view →
          </Link>
        </header>
        <RegionBars rows={regionRows} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Byproduct composition ────────────────────────── */}
        <section className="fade-up fade-up-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:col-span-3">
          <div className="section-rule" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-brand-800">
            What the byproduct stream is made of
          </h2>
          <p className="mb-5 text-xs text-muted">UAE palm-byproduct stream · working set, modeled</p>

          {/* stacked bar with 2px surface gaps */}
          <div className="flex h-[22px] w-full gap-[2px] overflow-hidden rounded-lg">
            {COMPOSITION.map((c, i) => {
              const pct = (compValues[i] / compTotal) * 100;
              return (
                <div
                  key={c.key}
                  className="group relative h-full"
                  style={{ width: `${pct}%`, background: c.hex }}
                >
                  <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-white px-3 py-1.5 text-xs opacity-0 shadow-card-hover transition-opacity group-hover:opacity-100">
                    <span className="font-medium text-ink">{c.key} · {c.ar}</span>{' '}
                    <span className="text-muted">
                      {Math.round(compValues[i]).toLocaleString('en-US')} t · {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* legend with values (relief for low-contrast hues) */}
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            {COMPOSITION.map((c, i) => (
              <div key={c.key} className="flex items-center gap-2">
                <i className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: c.hex }} />
                <span className="text-ink">{c.key}</span>
                <span className="ml-auto tabular-nums text-muted">
                  {((compValues[i] / compTotal) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Membership ladder ────────────────────────────── */}
        <section className="fade-up fade-up-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:col-span-2">
          <div className="section-rule" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-brand-800">Membership ladder</h2>
          <p className="mb-5 text-xs text-muted">Standing is held, not owned</p>
          <div className="space-y-3">
            {(
              [
                { t: 'ELITE', label: 'Elite · نخبة', cls: 'bg-gold-500' },
                { t: 'CERTIFIED', label: 'Certified · معتمد', cls: 'bg-mint-500' },
                { t: 'ACTIVE', label: 'Active · نشط', cls: 'bg-brand-500' },
                { t: 'REGISTERED', label: 'Registered · مسجّل', cls: 'bg-brand-200' },
              ] as const
            ).map((row) => {
              const n = tierCount(row.t);
              const pct = partnerCount > 0 ? (n / partnerCount) * 100 : 0;
              return (
                <div key={row.t}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink">{row.label}</span>
                    <span className="tabular-nums text-muted">{n}</span>
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full bg-mist">
                    <div
                      className={`viz-grow h-full rounded-full ${row.cls}`}
                      style={{ width: `${Math.max(pct, n > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/partners"
            className="mt-5 inline-block text-xs text-brand-600 hover:underline"
          >
            Open the national registry →
          </Link>
        </section>
      </div>

      {/* ── Live activity ──────────────────────────────────── */}
      <section className="fade-up fade-up-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="section-rule" aria-hidden />
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-brand-800">Live activity</h2>
          <Link href="/feed" className="text-xs text-brand-600 hover:underline">
            Full feed →
          </Link>
        </div>
        <div className="mt-4 space-y-0">
          {recentActivity.length === 0 && (
            <p className="text-sm text-muted">
              Quiet for now — the moment a report is submitted or validated, it appears here in real
              time.
            </p>
          )}
          {recentActivity.map((a, i) => (
            <div key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* timeline spine */}
              {i < recentActivity.length - 1 && (
                <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />
              )}
              <span
                className={`relative mt-1.5 inline-block h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white ${
                  a.severity === 'WARNING' || a.severity === 'CRITICAL' ? 'bg-gold-500' : 'bg-mint-500'
                }`}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="truncate text-sm text-ink">{a.title}</div>
                <div className="text-[11px] text-muted">
                  {a.actorAgent?.slug ?? a.actorUser?.name ?? 'system'} ·{' '}
                  {a.createdAt.toISOString().slice(5, 16).replace('T', ' ')} UTC
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="pb-2 text-center text-[11px] text-muted">
        Baseline figures: public sources (ADAFSA survey; FAO 2022) + indicative allocations — modeled estimates.
        Measured figures: approved partner reports. شبكة نخيل الإمارات
      </p>
    </div>
  );
}

function Tile({
  label,
  href,
  className,
  children,
}: {
  label: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <div
      className={`h-full rounded-2xl border border-line bg-white p-4 shadow-card transition hover:shadow-card-hover ${className ?? ''}`}
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">{label}</div>
      {children}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function TileHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 text-[11px] leading-snug text-muted">{children}</div>;
}
