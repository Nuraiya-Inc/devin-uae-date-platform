/**
 * Next Phase — the roadmap, as a demo closing scene (UAE edition).
 *
 * Three honest bands: what the pilot delivers (committed), what the national
 * rollout adds (proposed — commercial proposal in preparation), and the
 * horizon (jointly evaluated — explicitly not promised). Static content;
 * every item must match the commercial paperwork so the platform and the
 * paper never disagree.
 */

export const dynamic = 'force-dynamic';

const BANDS: Array<{
  tag: string;
  tagAr: string;
  tone: string;
  title: string;
  note: string;
  items: Array<{ icon: string; en: string; ar: string; body: string }>;
}> = [
  {
    tag: 'PILOT · 90 DAYS',
    tagAr: 'التجربة · 90 يومًا',
    tone: 'border-mint-300 bg-mint-100/40 text-mint-700',
    title: 'Committed in the pilot',
    note: 'Delivered and measured against jointly signed success criteria.',
    items: [
      { icon: '🇦🇪', en: 'UAE-resident hosting', ar: 'استضافة داخل الإمارات', body: 'Production data lives on UAE infrastructure aligned with the UAE Personal Data Protection Law — before any real partner data.' },
      { icon: '🌾', en: 'Al Ain founding network', ar: 'شبكة العين المؤسسة', body: '50–150 founding partners onboarded across every actor type, with the Founding Member designation they keep forever.' },
      { icon: '📋', en: 'One full reporting cycle', ar: 'دورة تقارير كاملة', body: 'A complete quarterly cycle executed through Abdullah — participation and data quality measured, not estimated.' },
      { icon: '🎓', en: 'Operator enablement', ar: 'تمكين فريق التشغيل', body: 'Console, approvals, and standings training for the operating team; train-the-trainer for field coordinators.' },
    ],
  },
  {
    tag: 'NATIONAL ROLLOUT · 12 MONTHS',
    tagAr: 'التعميم الوطني · 12 شهرًا',
    tone: 'border-brand-200 bg-brand-50 text-brand-700',
    title: 'Proposed for the national phase',
    note: 'Scoped in the commercial proposal (in preparation) — begins on pilot success.',
    items: [
      { icon: '💬', en: 'WhatsApp reporting channel', ar: 'قناة واتساب', body: 'Abdullah on the WhatsApp partners already use: voice notes, photos of paper records, informal dialect — no app, no login. The agents behind it are running today.' },
      { icon: '🗺️', en: 'All seven emirates', ar: 'الإمارات السبع', body: 'Emirate-by-emirate onboarding with standings, launch campaigns, and bulk registration support — building the first measured baseline where none is published.' },
      { icon: '🔗', en: 'Ecosystem integrations', ar: 'التكامل مع المنظومة', body: 'Single sign-on, ID verification where required, and integrations with partner and authority systems as mandates are agreed — including an Emirati quality-mark track.' },
      { icon: '📊', en: 'State of the Sector report', ar: 'تقرير حالة القطاع', body: 'The first annual UAE dataset published from measured platform data — with contributors named and honored.' },
      { icon: '🏆', en: 'National Honors ceremony', ar: 'حفل التكريم الوطني', body: 'Annual Elite recognition presented by dignitaries, timed with the year-end standings — the engagement calendar’s centerpiece.' },
    ],
  },
  {
    tag: 'THE HORIZON · EVALUATED JOINTLY',
    tagAr: 'الأفق · بتقييم مشترك',
    tone: 'border-gold-300 bg-gold-50 text-gold-700',
    title: 'Where this platform can go',
    note: 'Directions evaluated with the operating partner — presented as possibilities, not promises, until jointly scoped.',
    items: [
      { icon: '🌱', en: 'Verification-grade carbon (MRV)', ar: 'قياس الكربون الموثق', body: 'With a qualified methodology partner: from indicative estimates to verification-grade diversion data, positioned for UAE carbon-market infrastructure as programs mature.' },
      { icon: '🛰️', en: 'Remote-sensing crop signals', ar: 'الاستشعار عن بُعد', body: 'Satellite-derived palm counts and health signals cross-checked against partner reports — validation without visits.' },
      { icon: '🎓', en: 'Palm Academy', ar: 'أكاديمية النخيل', body: 'Best-practice courses inside the portal, taught through Abdullah, with completion feeding partner standing.' },
      { icon: '🌍', en: 'Export-readiness services', ar: 'خدمات جاهزية التصدير', body: 'Certified partners packaged for international buyers: verified profiles, QR-backed certificates, and endorsement letters under the network’s mark.' },
      { icon: '📱', en: 'Native mobile apps', ar: 'تطبيقات الجوال', body: 'iOS/Android apps for partners and field staff — offline capture on the farm, syncing when signal returns.' },
    ],
  },
];

export default function RoadmapPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="relative overflow-hidden rounded-2xl p-7 text-white shadow-card-hover"
           style={{ background: 'linear-gradient(135deg, #07272D, #0C3B43 60%, #124E57)' }}>
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">Next Phase · المرحلة القادمة</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            What this platform becomes
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/75">
            Everything running today is the foundation. This is the build path — what the pilot
            commits to, what the national phase adds, and the directions the network and its
            partners evaluate together.
          </p>
        </div>
      </div>

      {BANDS.map((band) => (
        <section key={band.tag} className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${band.tone}`}>
              {band.tag} · {band.tagAr}
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-brand-800">{band.title}</h2>
          </div>
          <p className="-mt-2 text-xs text-muted">{band.note}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {band.items.map((it) => (
              <div key={it.en} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{it.icon}</div>
                  <div>
                    <div className="font-semibold text-ink">{it.en}</div>
                    <div className="text-sm text-brand-700">{it.ar}</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{it.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="pb-4 text-center text-xs text-muted">
        Roadmap items ship against the annually agreed plan; horizon items are commitments only
        once jointly scoped. The platform running today is Phase 1 — complete.
      </p>
    </div>
  );
}
