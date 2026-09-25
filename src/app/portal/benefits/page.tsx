/**
 * Benefits — the answer to "what's in it for me?", made visual.
 *
 * Every benefit is shown relative to THIS partner's tier: what they already
 * hold (ownership → loss aversion), what the next tier unlocks (aspiration),
 * and the annual renewal contract in plain language.
 */

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { TIER_LADDER } from '@/facts';

export const dynamic = 'force-dynamic';

const TIER_BENEFITS: Record<string, Array<{ en: string; ar: string }>> = {
  REGISTERED: [
    { en: 'Listing in the National Partner Registry', ar: 'الإدراج في السجل الوطني للشركاء' },
    { en: 'Abdullah — a dedicated concierge, 24/7, in Arabic', ar: 'عبدالله — مضيفكم الخاص على مدار الساعة' },
    { en: 'Official announcements and event invitations', ar: 'الإعلانات الرسمية ودعوات الفعاليات' },
  ],
  ACTIVE: [
    { en: 'Regional benchmark after every report — where you stand in your region', ar: 'مقارنة إقليمية بعد كل تقرير' },
    { en: 'Marketplace access — list surplus, find buyers inside the network', ar: 'الوصول إلى السوق الداخلي' },
    { en: 'Waste collection priority — recyclers claim your byproducts', ar: 'أولوية جمع النواتج الثانوية' },
  ],
  CERTIFIED: [
    { en: 'Official network certificate with annual seal + public QR verification', ar: 'شهادة رسمية بختم سنوي ورمز تحقق عام' },
    { en: 'Eligibility for national awards, honors, and support programs', ar: 'أهلية الجوائز والمنح الوطنية' },
    { en: 'Export-readiness endorsement and priority introductions', ar: 'تزكية جاهزية التصدير' },
  ],
  ELITE: [
    { en: 'Gold certificate + featured national profile', ar: 'الشهادة الذهبية وملف وطني مميز' },
    { en: 'Annual ceremony recognition, presented by officials', ar: 'تكريم في الحفل السنوي' },
    { en: 'Trade-delegation invitations and advisory-council seat', ar: 'دعوات الوفود التجارية ومقعد استشاري' },
  ],
};

export default async function BenefitsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const myOrder = TIER_LADDER.find((t) => t.code === partner.tier)?.order ?? 0;
  const year = new Date().getUTCFullYear();

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-card-hover sm:p-8"
        style={{ background: 'linear-gradient(135deg, #0C3B43, #124E57 60%, #17606B)' }}
      >
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">Member Benefits · مزايا العضوية</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">What your membership pays you</h1>
          <div className="mt-1 text-lg text-white/85">عضويتكم أصل — وهذه عوائده</div>
          <p className="mt-3 max-w-2xl text-sm text-white/75">
            Every quarterly report returns value the same day — and everything below is held by
            reporting. Green is yours today; locked items show exactly how to earn them.
          </p>
        </div>
      </section>

      {/* Instant returns — what a single report gives back */}
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['📊', 'Your regional benchmark', 'Where you stand among your region’s producers — after every single report.'],
          ['💡', 'One practical insight', 'A concrete, actionable observation from your own figures — every quarter.'],
          ['♻️', 'Byproducts become revenue', 'Fronds and pits posted for collection or sale the moment you mention them.'],
        ].map(([icon, title, body]) => (
          <div key={title as string} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 font-semibold text-brand-800">{title}</div>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      {/* Tier ladder with lock states */}
      <div className="space-y-4">
        {TIER_LADDER.map((tier) => {
          const unlocked = tier.order <= myOrder;
          const isNext = tier.order === myOrder + 1;
          return (
            <section
              key={tier.code}
              className={`rounded-2xl border p-5 sm:p-6 ${
                unlocked ? 'border-mint-300 bg-white shadow-card' : 'border-line bg-mist/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xl ${unlocked ? '' : 'grayscale'}`}>{unlocked ? '🟢' : '🔒'}</span>
                  <div>
                    <div className={`font-semibold ${unlocked ? 'text-brand-800' : 'text-muted'}`}>
                      {tier.nameEn} · {tier.nameAr}
                      {partner.tier === tier.code && (
                        <span className="ml-2 rounded-full bg-mint-100 px-2 py-0.5 text-xs font-medium text-mint-700">
                          Your tier · مستواكم
                        </span>
                      )}
                      {isNext && (
                        <span className="ml-2 rounded-full border border-gold-300 bg-gold-50 px-2 py-0.5 text-xs font-medium text-gold-700">
                          Next · التالي
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">Earned by: {tier.earnedBy}</div>
                  </div>
                </div>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {(TIER_BENEFITS[tier.code] ?? []).map((b) => (
                  <li
                    key={b.en}
                    className={`rounded-xl px-3 py-2.5 text-sm ${
                      unlocked ? 'bg-mint-100/50 text-ink' : 'bg-white/60 text-muted'
                    }`}
                  >
                    <div>{b.en}</div>
                    <div className={`text-xs ${unlocked ? 'text-brand-700' : 'text-muted'}`}>{b.ar}</div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* The renewal contract, in plain language */}
      <section className="rounded-2xl border border-gold-300 bg-gold-50 p-5 sm:p-6">
        <div className="font-semibold text-gold-700">
          The annual seal — how standing stays yours · الختم السنوي
        </div>
        <div className="mt-2 space-y-1.5 text-sm text-gold-700/90">
          <p>◉ Your certificate carries the <b>{year} seal</b>. It renews automatically — quarterly reporting is the renewal.</p>
          <p>◉ One unreported quarter → a friendly heads-up (At-risk). Nothing is lost yet.</p>
          <p>◉ Two unreported quarters → benefits pause until your record is complete. Your history is never erased.</p>
          <p>◉ A full year without an approved report → certification lapses, by official decision. Re-certification is always open.</p>
          <p className="pt-1 font-medium">Every one of these reverses the moment you complete your record with Abdullah — most partners need less than ten minutes a quarter.</p>
        </div>
      </section>

      <div className="rounded-2xl border border-line bg-white p-5 text-center text-sm shadow-card">
        Ten minutes a quarter keeps all of this yours.{' '}
        <Link href="/portal/chat" className="font-semibold text-brand-600 underline underline-offset-2">
          Start with Abdullah · ابدأوا مع عبدالله
        </Link>
      </div>
    </div>
  );
}
