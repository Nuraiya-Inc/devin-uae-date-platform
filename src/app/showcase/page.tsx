/**
 * Public showcase — the National MRV counter (M7).
 *
 * Public (excluded from auth middleware). Aggregate-only, no partner-level
 * data ever (UPN-3 floor enforced in buildImpactMap). The shareable
 * "national climate contribution, live" page for the pitch, partners
 * considering joining, and the public verify story.
 */

import Link from 'next/link';
import ImpactMap from '@/components/ImpactMap';
import Logo from '@/components/brand/Logo';
import CountUp from '@/components/viz/CountUp';
import MandateBadges from '@/components/MandateBadges';
import IndicativeChip from '@/components/IndicativeChip';
import { buildImpactMap } from '@/lib/impact-map';
import { nationalNetZeroContext, UAE_NET_ZERO_TARGET_YEAR } from '@/lib/esg';

export const dynamic = 'force-dynamic';

function Big({
  value,
  decimals = 0,
  suffix = '',
  label,
  indicative = false,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
  indicative?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-white/70">
        {label}
        {indicative && <IndicativeChip tone="dark" />}
      </div>
    </div>
  );
}

export default async function ShowcasePage() {
  const [data, netZero] = await Promise.all([
    buildImpactMap(),
    nationalNetZeroContext(),
  ]);
  const t = data.totals;

  return (
    <main className="min-h-screen" style={{ background: '#F4F1EA' }}>
      <div className="gold-bar w-full" aria-hidden />

      {/* Hero — the live national counter */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #07272D, #0C3B43 55%, #124E57)' }}>
        <div className="dot-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <Logo variant="light" width={190} />
          <div className="mt-6 text-lg font-medium font-serif" dir="rtl" lang="ar">
            من النخلة إلى بيانات مناخية موثوقة
          </div>
          <h1 className="mt-1 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            The national MRV layer for date-palm residue — measured, verified, counted.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/75">
            شبكة نخيل الإمارات · Every approved report replaces an estimate with measured national
            data. Every diverted ton is a real contribution toward UAE Net Zero {UAE_NET_ZERO_TARGET_YEAR}.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Big value={t.divertedTons} decimals={1} suffix=" t" label="Residue diverted (measured)" />
            <Big value={t.avoidedTCO2e} decimals={1} label="tCO₂e avoided (est.)" indicative />
            <Big
              value={netZero.measuredSharePct ?? 0}
              decimals={(netZero.measuredSharePct ?? 0) < 10 ? 1 : 0}
              suffix="%"
              label="of estimated residue now measured"
            />
            <Big value={t.reportingPartners} label={`Reporting in ${data.year}`} />
          </div>
          <div className="mt-8">
            <MandateBadges tone="dark" />
          </div>
        </div>
      </section>

      {/* Map — measured vs indicative, honestly labeled */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-lg font-semibold tracking-tight text-brand-800">Participation across the Emirates</h2>
        <p className="mt-1 text-sm text-muted">
          Coloured by the share of each emirate&apos;s partners reporting in {data.year}. Emirates with
          fewer than three partners are shown without a figure to protect confidentiality.
          Only Abu Dhabi&apos;s baseline is surveyed — every other figure starts as an estimate the
          network is actively replacing with measurement.
        </p>
        <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
          <ImpactMap emirates={data.emirates} />
          {/* measured vs indicative legend */}
          <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-line pt-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-[3px] bg-mint-500" /> Measured (approved reports)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-[3px] bg-gold-400" /> Indicative baseline estimate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-[3px] bg-line" /> Suppressed (&lt;3 partners)
            </span>
          </div>
        </div>
      </section>

      {/* How we measure — the honesty note */}
      <section className="mx-auto max-w-5xl px-5 pb-10">
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-brand-800">How we measure</h2>
          <div className="mt-3 grid gap-4 text-sm leading-relaxed text-muted sm:grid-cols-3">
            <div>
              <span className="font-semibold text-ink">1 · Partners report quarterly.</span>{' '}
              Farms, factories, and recyclers record what each residue stream became — fed to
              livestock, sold, recycled, or burned/buried/dumped.
            </div>
            <div>
              <span className="font-semibold text-ink">2 · Officials validate and approve.</span>{' '}
              Every figure on this page comes from APPROVED reports — validated data, not
              self-declared claims.
            </div>
            <div>
              <span className="font-semibold text-ink">3 · Diversion prices the climate win.</span>{' '}
              Diverted tons are priced at a conservative indicative factor (1.2 tCO₂e/t). These are
              indicative avoided emissions — an auditable path toward certification, not credits.
            </div>
          </div>
        </div>
      </section>

      {/* Net Zero framing */}
      <section className="mx-auto max-w-5xl px-5 pb-12">
        <div className="rounded-2xl border border-gold-300 bg-gold-50 p-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-brand-800">Contributing to UAE Net Zero {UAE_NET_ZERO_TARGET_YEAR}</h2>
            <IndicativeChip />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every ton of palm residue a partner diverts from burning or burial to a productive fate
            is recorded and, using a conservative indicative factor, translated into estimated avoided
            emissions — methane that open dumping would release, CO₂ that burning would emit. These
            are auditable records — not offsets or tradeable credits — that build the measured
            foundation the Emirates&apos; net-zero journey needs.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/signin" className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
              Partner sign in →
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-muted">
          UAE Palm Network · operated with Nuraiya · technology by Safa BioWorks FZE. Figures are
          aggregates from approved reports; ESG values are indicative estimates, not verified carbon
          accounting or tradeable credits. من النخلة إلى بيانات مناخية موثوقة
        </p>
      </section>
    </main>
  );
}
