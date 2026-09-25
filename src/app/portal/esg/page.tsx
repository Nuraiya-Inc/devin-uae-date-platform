/**
 * Portal — Sustainability: the partner's estimated climate contribution.
 *
 * Everything here is INDICATIVE and labeled as such (hard rule UPN-7 /
 * esg.factorCaveat). The point is motivation + an auditable record that
 * pre-positions the partner for future carbon-credit programs (GCOM/RVCMC).
 */

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { partnerEsgEstimate, partnerEsgScore, INDICATIVE_FACTOR_TCO2E_PER_TON, UAE_NET_ZERO_TARGET_YEAR } from '@/lib/esg';
import { UPN_FACTS } from '@/facts';

/** Small SVG score ring (0–100). */
function ScoreRing({ score }: { score: number }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const filled = (C * score) / 100;
  const color = score >= 80 ? '#2E9E7E' : score >= 60 ? '#35C4A0' : score >= 35 ? '#D9B36C' : '#9AA6A3';
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`ESG score ${score}`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${filled} ${C}`} transform="rotate(-90 60 60)"
      />
      <text x="60" y="58" textAnchor="middle" fontSize="30" fontWeight="700" fill="#0B1F26">{score}</text>
      <text x="60" y="78" textAnchor="middle" fontSize="11" fill="#6E7A78">/ 100</text>
    </svg>
  );
}

export const dynamic = 'force-dynamic';

const STREAM_AR: Record<string, string> = {
  FRONDS: 'سعف',
  FROND_BASE: 'كرب',
  FIBER: 'ليف',
  PITS: 'نوى',
  DATES: 'فاقد تمور',
  OTHER: 'أخرى',
};

export default async function EsgPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const year = new Date().getUTCFullYear();
  const [current, previous, esg] = await Promise.all([
    partnerEsgEstimate(partner.id, year),
    partnerEsgEstimate(partner.id, year - 1),
    partnerEsgScore(partner.id),
  ]);

  const hasData = current.totalWasteTons > 0 || previous.totalWasteTons > 0;

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Sustainability</h1>
        <p className="text-sm text-muted">
          الاستدامة · Your measured contribution to the Emirates&apos; circular-economy and
          climate goals — built from your approved reports.
        </p>
      </header>

      {/* Contribution hero */}
      <section className="fade-up fade-up-1 relative overflow-hidden rounded-2xl p-6 text-white shadow-card-hover sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0C3B43 0%, #1E6B55 55%, #2E9E7E 100%)' }}>
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
            {year} estimated climate contribution · indicative
          </div>
          <div className="mt-2 text-5xl font-semibold tracking-tight">
            {current.estAvoidedTCO2e.toLocaleString('en-US')}
            <span className="ml-2 text-xl font-normal text-white/75">tCO₂e avoided (est.)</span>
          </div>
          <div className="mt-2 text-sm text-white/80">
            {current.divertedTons.toLocaleString('en-US')} tons diverted from burning or burial
            {current.carYearEquivalent > 0 &&
              ` — roughly ${current.carYearEquivalent.toLocaleString('en-US')} passenger car${current.carYearEquivalent === 1 ? '' : 's'} off the road for a year`}
          </div>
          {previous.estAvoidedTCO2e > 0 && (
            <div className="mt-1 text-xs text-white/60">
              {year - 1}: {previous.estAvoidedTCO2e.toLocaleString('en-US')} tCO₂e (est.)
            </div>
          )}
        </div>
      </section>

      {/* ESG score + Net Zero framing */}
      {esg.band !== 'No data' && (
        <section className="fade-up fade-up-1 grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center justify-center">
            <ScoreRing score={esg.score} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-brand-800">ESG Score</h2>
              <span className="rounded-full bg-mint-100 px-2 py-0.5 text-xs font-semibold text-mint-700">
                {esg.band} · {esg.bandAr}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              An indicative, transparent composite of what you can control. النتيجة تقديرية وشفافة.
            </p>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Diversion', ar: 'التحويل', val: esg.components.diversion, max: 50 },
                { label: 'Consistency', ar: 'الانتظام', val: esg.components.consistency, max: 30 },
                { label: 'Data quality', ar: 'جودة البيانات', val: esg.components.dataQuality, max: 20 },
              ].map((c) => (
                <div key={c.label}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="text-ink">{c.label} · {c.ar}</span>
                    <span className="tabular-nums text-muted">{c.val}/{c.max}</span>
                  </div>
                  <div className="h-[6px] overflow-hidden rounded-full bg-mist">
                    <div className="viz-grow h-full rounded-full bg-brand-600" style={{ width: `${(c.val / c.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Reported {esg.quartersReported}/4 recent quarters
              {esg.diversionRatePct !== null && ` · ${esg.diversionRatePct}% diversion`}
              {esg.meanConfidence !== null && ` · ${esg.meanConfidence}% data confidence`}.
              Every quarter you report and every ton you divert raises this.
            </p>
          </div>
        </section>
      )}

      {/* Net Zero 2050 contribution */}
      <section className="fade-up fade-up-1 rounded-2xl border border-gold-300 bg-gold-50 p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🇦🇪</div>
          <div>
            <h2 className="text-base font-semibold text-brand-800">
              Your contribution to UAE Net Zero {UAE_NET_ZERO_TARGET_YEAR}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Your {year} estimate of <span className="font-semibold text-brand-800">{current.estAvoidedTCO2e.toLocaleString('en-US')} tCO₂e avoided</span> is
              part of the Emirates&apos; national journey to net zero by {UAE_NET_ZERO_TARGET_YEAR}. It is an
              indicative, auditable record — not an offset or a credit — and it is yours to show.
              مساهمتكم في مسيرة الإمارات نحو الحياد المناخي {UAE_NET_ZERO_TARGET_YEAR}.
            </p>
          </div>
        </div>
      </section>

      {!hasData && (
        <section className="fade-up fade-up-2 rounded-2xl border border-dashed border-line bg-white p-6 text-center">
          <p className="text-sm text-ink">
            Your sustainability record starts with your first approved report.
          </p>
          <p className="mt-1 text-xs text-muted">
            Record where your byproducts actually go — every ton diverted to feed, sale, or
            recycling counts. سجل وجهة نواتجكم — كل طن محوّل يُحتسب.
          </p>
          <Link
            href="/portal/chat"
            className="mt-4 inline-block rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Report with Abdullah →
          </Link>
        </section>
      )}

      {/* Breakdown */}
      {current.byStream.length > 0 && (
        <section className="fade-up fade-up-2 rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-brand-800">
            {year} diversion by stream
          </h2>
          <div className="space-y-3">
            {current.byStream.map((s) => {
              const max = current.byStream[0].divertedTons;
              return (
                <div key={s.stream}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink">
                      {s.stream} · {STREAM_AR[s.stream] ?? ''}
                    </span>
                    <span className="tabular-nums text-muted">
                      {s.divertedTons} t → ~{s.estAvoidedTCO2e} tCO₂e
                    </span>
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full bg-mist">
                    <div
                      className="viz-grow h-full rounded-full bg-mint-500"
                      style={{ width: `${Math.max((s.divertedTons / max) * 100, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {current.diversionRatePct !== null && (
            <p className="mt-4 text-xs text-muted">
              Your diversion rate: <span className="font-semibold text-mint-700">{current.diversionRatePct}%</span> —
              national baseline is ~10%. Verified diversion counts toward Elite standing.
            </p>
          )}
        </section>
      )}

      {/* Annual statement + credit pathway */}
      <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="text-base font-semibold text-brand-800">
          Annual Sustainability Contribution Statement
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          At each year&apos;s close, the network issues you a formal statement of your estimated
          contribution — your diverted tonnage, estimated avoided emissions, and your standing in
          the national effort. It carries the Center&apos;s mark and belongs in your company&apos;s
          records. بيان سنوي رسمي بمساهمتكم في أهداف الإمارات المناخية.
        </p>
        <h3 className="mt-4 text-sm font-semibold text-brand-800">About carbon credits</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {UPN_FACTS.esg.creditPathway}
        </p>
        <p className="mt-3 rounded-lg bg-mist p-3 text-[11px] leading-relaxed text-muted">
          Methodology note: figures on this page are indicative estimates using a conservative
          placeholder factor of {INDICATIVE_FACTOR_TCO2E_PER_TON} tCO₂e per productively-diverted
          ton versus a burn/bury baseline. They are not verified carbon accounting and are not
          tradeable. Formal factors will be adopted with a qualified methodology partner.
        </p>
      </section>
    </div>
  );
}
