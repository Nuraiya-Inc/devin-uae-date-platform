/**
 * Public showcase — the UAE Palm Network impact map and headline numbers.
 *
 * Public (excluded from auth middleware). Aggregate-only, no partner-level
 * data ever. This is the shareable "what the network is achieving" page for
 * the pitch, partners considering joining, and the public verify story.
 */

import Link from 'next/link';
import ImpactMap from '@/components/ImpactMap';
import Logo from '@/components/brand/Logo';
import { buildImpactMap } from '@/lib/impact-map';
import { UAE_NET_ZERO_TARGET_YEAR } from '@/lib/esg';

export const dynamic = 'force-dynamic';

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs text-white/70">{label}</div>
    </div>
  );
}

export default async function ShowcasePage() {
  const data = await buildImpactMap();
  const t = data.totals;

  return (
    <main className="min-h-screen" style={{ background: '#F4F1EA' }}>
      <div className="gold-bar w-full" aria-hidden />

      {/* Hero */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #07272D, #0C3B43 55%, #124E57)' }}>
        <div className="dot-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <Logo variant="light" width={190} />
          <h1 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            The UAE date-palm sector, measured — one network, seven emirates.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/75">
            شبكة نخيل الإمارات · A partner network turning scattered estimates into a live, verified
            picture of production, circular-economy diversion, and climate contribution.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Big value={t.partners.toLocaleString('en-US')} label="Registered partners" />
            <Big value={t.reportingPartners.toLocaleString('en-US')} label={`Reporting in ${data.year}`} />
            <Big value={`${t.divertedTons.toLocaleString('en-US')} t`} label="Residue diverted (measured)" />
            <Big value={`${t.avoidedTCO2e.toLocaleString('en-US')}`} label="tCO₂e avoided (est., indicative)" />
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-lg font-semibold tracking-tight text-brand-800">Participation across the Emirates</h2>
        <p className="mt-1 text-sm text-muted">
          Coloured by the share of each emirate&apos;s partners reporting in {data.year}. Emirates with
          fewer than three partners are shown without a figure to protect confidentiality.
        </p>
        <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-8">
          <ImpactMap emirates={data.emirates} />
        </div>
      </section>

      {/* Net Zero framing */}
      <section className="mx-auto max-w-5xl px-5 pb-12">
        <div className="rounded-2xl border border-gold-300 bg-gold-50 p-6">
          <h2 className="text-base font-semibold text-brand-800">Contributing to UAE Net Zero {UAE_NET_ZERO_TARGET_YEAR}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Every ton of palm residue a partner diverts from burning or burial to a productive fate
            is recorded and, using a conservative indicative factor, translated into estimated avoided
            emissions. These are auditable records — not offsets or tradeable credits — that build the
            measured foundation the Emirates&apos; net-zero journey needs.
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
          accounting or tradeable credits.
        </p>
      </section>
    </main>
  );
}
