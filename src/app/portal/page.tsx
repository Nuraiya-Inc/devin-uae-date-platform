/**
 * Portal home — the partner's standing, this quarter's status, and one
 * benchmark insight. Dignity first: the tier card is the hero.
 */

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { TIER_LADDER, REGION_BASELINE } from '@/facts';
import { getPortalLang, t } from '@/lib/portal-lang';
import { partnerEsgEstimate, DIVERTED_FATES } from '@/lib/esg';
import { MIN_AGGREGATE } from '@/lib/sector-report';
import IndicativeChip from '@/components/IndicativeChip';
import CountUp from '@/components/viz/CountUp';

export const dynamic = 'force-dynamic';

const TIER_GRADIENT: Record<string, string> = {
  ELITE: 'linear-gradient(135deg, #4D3A18 0%, #B08A3E 60%, #D5B672 100%)',
  CERTIFIED: 'linear-gradient(135deg, #0C3B43 0%, #1E6B55 60%, #2E9E7E 100%)',
  ACTIVE: 'linear-gradient(135deg, #07272D 0%, #124E57 60%, #2E747C 100%)',
  REGISTERED: 'linear-gradient(135deg, #3A4547 0%, #56666A 60%, #6E7A78 100%)',
};

export default async function PortalHome() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const lang = await getPortalLang();
  const partner = await prisma.partner.findUnique({
    where: { userId: session.user.id },
    include: {
      reports: { orderBy: [{ year: 'desc' }, { quarter: 'desc' }], take: 4 },
    },
  });
  if (!partner) redirect('/dashboard');

  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  const year = now.getUTCFullYear();
  const current = partner.reports.find((r) => r.year === year && r.quarter === q);

  const approvedCount = await prisma.quarterlyReport.count({
    where: { partnerId: partner.id, status: 'APPROVED' },
  });
  const tierInfo = TIER_LADDER.find((t) => t.code === partner.tier);
  const nextTier = TIER_LADDER.find((t) => t.order === (tierInfo?.order ?? 0) + 1);
  const quartersToNext =
    partner.tier === 'REGISTERED' ? Math.max(0, 2 - approvedCount)
    : partner.tier === 'ACTIVE' ? Math.max(0, 4 - approvedCount)
    : null;

  const baseline = REGION_BASELINE.find((r) => r.code === partner.region);
  const openTickets = await prisma.collectionTicket.count({
    where: { partnerId: partner.id, status: { in: ['OPEN', 'CLAIMED'] } },
  });

  // ── M3: My Contribution — climate stats, fate mix, benchmark ──
  const esg = await partnerEsgEstimate(partner.id, year);
  const harmfulTons = esg.harmfulTons;

  // Benchmark position: partner's diversion rate vs emirate peers (≥3 floor).
  const peerReports = await prisma.wasteRecord.findMany({
    where: {
      report: { status: 'APPROVED', year, partner: { region: partner.region } },
    },
    select: { fate: true, tons: true, report: { select: { partnerId: true } } },
  });
  const peerIds = new Set(peerReports.map((r) => r.report.partnerId));
  let benchmarkPct: number | null = null;
  if (peerIds.size >= MIN_AGGREGATE && esg.diversionRatePct !== null) {
    const rates = new Map<string, { d: number; t: number }>();
    for (const r of peerReports) {
      const e = rates.get(r.report.partnerId) ?? { d: 0, t: 0 };
      e.t += r.tons;
      if ((DIVERTED_FATES as readonly string[]).includes(r.fate)) e.d += r.tons;
      rates.set(r.report.partnerId, e);
    }
    const better = [...rates.entries()].filter(([id, v]) => {
      if (id === partner.id) return false;
      return v.t > 0 && (v.d / v.t) * 100 < esg.diversionRatePct!;
    }).length;
    // percentile = share of peers whose rate is below yours
    benchmarkPct = Math.max(1, Math.round((better / (peerIds.size - 1)) * 100));
  }

  const statusLabel: Record<string, string> = {
    DRAFT: t(lang, 'In progress with Abdullah', 'قيد الإعداد مع عبدالله'),
    SUBMITTED: t(lang, 'Submitted — validation in progress', 'تم الإرسال — قيد التدقيق'),
    VALIDATED: t(lang, 'Validated — awaiting network approval', 'تم التدقيق — بانتظار اعتماد الشبكة'),
    APPROVED: t(lang, 'Approved — شكراً لمساهمتكم', 'معتمد — شكرًا لمساهمتكم'),
    RETURNED: t(lang, 'Returned with questions — Abdullah has the details', 'أُعيد باستفسارات — التفاصيل لدى عبدالله'),
  };

  return (
    <div className="space-y-5">
      {/* Tier card — the hero */}
      <section
        className="fade-up relative overflow-hidden rounded-2xl p-6 text-white shadow-card-hover sm:p-8"
        style={{ background: TIER_GRADIENT[partner.tier] ?? TIER_GRADIENT.REGISTERED }}
      >
        <div className="dot-grid absolute inset-0 opacity-60" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/70" dir="ltr">
                {partner.registryNo}
                {partner.foundingMember && t(lang, ' · Founding Member', ' · عضو مؤسس')}
              </div>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                {lang === 'ar' ? (partner.nameAr ?? partner.nameEn) : partner.nameEn}
              </h1>
              {partner.nameAr && (
                <div className="text-lg text-white/85">{lang === 'ar' ? partner.nameEn : partner.nameAr}</div>
              )}
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-center backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/70">{t(lang, 'Membership', 'العضوية')}</div>
              <div className="text-xl font-semibold">{lang === 'ar' ? tierInfo?.nameAr : (tierInfo?.nameEn ?? partner.tier)}</div>
              <div className="text-sm text-white/85">{lang === 'ar' ? tierInfo?.nameEn : tierInfo?.nameAr}</div>
              <a
                href={`/api/certificates/${partner.id}`}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-block rounded-lg border border-white/30 px-3 py-1 text-xs text-white/90 transition hover:bg-white/15"
              >
                Certificate · الشهادة ↓
              </a>
              <div className="mt-1.5 text-[10px] text-white/60">
                {t(lang, `Annual seal ${new Date().getUTCFullYear()} · renews by reporting`, `الختم السنوي ${new Date().getUTCFullYear()} · يتجدد بتقاريركم`)}
              </div>
            </div>
          </div>

          {nextTier && quartersToNext !== null && (
            <div className="mt-5 max-w-md">
              <div className="mb-1.5 flex justify-between text-xs text-white/80">
                <span>
                  {quartersToNext === 0
                    ? t(lang, `Eligible for ${nextTier.nameEn} — under network review`, `مؤهلون لمستوى «${nextTier.nameAr}» — قيد اعتماد الشبكة`)
                    : t(lang, `${quartersToNext} approved quarter${quartersToNext === 1 ? '' : 's'} to ${nextTier.nameEn}`, `${quartersToNext} من التقارير المعتمدة تفصلكم عن «${nextTier.nameAr}»`)}
                </span>
                <span>{t(lang, `${approvedCount} approved`, `${approvedCount} معتمد`)}</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-white/20">
                <div
                  className="viz-grow h-full rounded-full bg-white"
                  style={{
                    width: `${Math.min(100, (approvedCount / (partner.tier === 'REGISTERED' ? 2 : 4)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Standing protection — visible only when action is needed */}
      {partner.standing === 'AT_RISK' && (
        <section className="fade-up rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-800">
                {t(lang, 'Protect your standing — one quarter is unreported · احموا اعتمادكم', 'احموا اعتمادكم — ربع واحد لم يُرفع تقريره بعد')}
              </div>
              <p className="mt-0.5 text-sm text-amber-800/80">
                {t(lang, 'Your next report restores everything instantly. Abdullah can complete it with you in minutes — even from a photo of your records.', 'تقريركم القادم يعيد كل شيء فورًا. عبدالله يكمله معكم في دقائق — حتى من صورة لسجلاتكم.')}
              </p>
            </div>
            <Link
              href="/portal/chat"
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              {t(lang, 'Complete it now →', '← أكملوه الآن')}
            </Link>
          </div>
        </section>
      )}
      {partner.standing === 'PAUSED' && (
        <section className="fade-up rounded-2xl border border-red-300 bg-red-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-red-800">
                {t(lang, 'Standing paused — benefits on hold · العضوية موقوفة مؤقتًا', 'العضوية موقوفة مؤقتًا — المزايا معلّقة')}
              </div>
              <p className="mt-0.5 text-sm text-red-800/80">
                {t(lang, 'Marketplace, collection priority, and your certificate are paused — nothing is lost. Complete your record with Abdullah and standing returns to GOOD automatically.', 'السوق وأولوية الجمع والشهادة معلّقة مؤقتًا — ولم يُفقد شيء. أكملوا سجلكم مع عبدالله وتعود العضوية تلقائيًا.')}
              </p>
            </div>
            <Link
              href="/portal/chat"
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-800"
            >
              {t(lang, 'Restore my standing →', '← استعادة العضوية')}
            </Link>
          </div>
        </section>
      )}

      {/* My Contribution — climate stats first (M3) */}
      <section className="fade-up fade-up-1 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
            {t(lang, 'Reported', 'مُبلَّغ')}
          </div>
          <div className="text-2xl font-semibold tracking-tight text-ink">
            <CountUp value={esg.totalWasteTons} decimals={1} />
            <span className="ml-1 text-sm font-normal text-muted">t</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {t(lang, `residue in ${year}`, `نواتج في ${year}`)}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
            {t(lang, 'Diverted', 'مُحوَّل')}
          </div>
          <div className="text-2xl font-semibold tracking-tight text-mint-700">
            <CountUp value={esg.divertedTons} decimals={1} />
            <span className="ml-1 text-sm font-normal text-muted">t</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {esg.diversionRatePct !== null
              ? `${esg.diversionRatePct}% ${t(lang, 'of your residue', 'من نواتجكم')}`
              : t(lang, 'fed · sold · recycled', 'أعلاف · مبيعات · تدوير')}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
            {t(lang, 'Climate', 'الأثر المناخي')}
            <IndicativeChip />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-ink">
            <CountUp value={esg.estAvoidedTCO2e} decimals={1} />
            <span className="ml-1 text-sm font-normal text-muted">tCO₂e</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {t(lang, 'avoided (est.)', 'انبعاثات متجنَّبة')}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">
            {t(lang, 'Opportunity', 'الفرصة')}
          </div>
          <div className="text-2xl font-semibold tracking-tight text-gold-600">
            <CountUp value={esg.opportunityTCO2e} decimals={1} />
            <span className="ml-1 text-sm font-normal text-muted">tCO₂e</span>
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {harmfulTons > 0
              ? t(lang, `if ${harmfulTons} t burned/dumped were diverted`, `لو حُوِّلت ${harmfulTons} طن محروقة/مدفونة`)
              : t(lang, 'no harmful-fate residue — ممتاز', 'لا نواتج ضارة — ممتاز')}
          </div>
        </div>
      </section>

      {/* Fate mix + benchmark position */}
      {esg.totalWasteTons > 0 && (
        <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="section-rule" aria-hidden />
              <h2 className="text-lg font-semibold tracking-tight text-brand-800">
                {t(lang, 'Where your residue went', 'وجهة نواتجكم')}
              </h2>
            </div>
            {benchmarkPct !== null && (
              <span className="rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-mint-700">
                {benchmarkPct >= 50
                  ? t(lang, `Top ${100 - benchmarkPct}% in your emirate`, `ضمن أفضل ${100 - benchmarkPct}% في إمارتكم`)
                  : t(lang, `Ahead of ${benchmarkPct}% of your emirate`, `متقدمون على ${benchmarkPct}% في إمارتكم`)}
              </span>
            )}
          </div>
          <div className="mt-4 flex h-[22px] w-full gap-[2px] overflow-hidden rounded-lg">
            {esg.divertedTons > 0 && (
              <div
                className="viz-grow h-full bg-mint-500"
                style={{ width: `${(esg.divertedTons / esg.totalWasteTons) * 100}%` }}
                title={`${esg.divertedTons.toLocaleString('en-US')} t diverted`}
              />
            )}
            {harmfulTons > 0 && (
              <div
                className="h-full bg-gold-600"
                style={{ width: `${(harmfulTons / esg.totalWasteTons) * 100}%` }}
                title={`${harmfulTons.toLocaleString('en-US')} t burned/buried/dumped`}
              />
            )}
            {esg.totalWasteTons - esg.divertedTons - harmfulTons > 0 && (
              <div
                className="h-full bg-brand-100"
                style={{ width: `${((esg.totalWasteTons - esg.divertedTons - harmfulTons) / esg.totalWasteTons) * 100}%` }}
                title="Unclassified fate"
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-[3px] bg-mint-500" />
              {t(lang, `Diverted — ${esg.divertedTons} t`, `مُحوَّل — ${esg.divertedTons} طن`)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-[3px] bg-gold-600" />
              {t(lang, `Burned · buried · dumped — ${harmfulTons} t`, `محروق · مدفون · ملقى — ${harmfulTons} طن`)}
            </span>
            {esg.opportunityTCO2e > 0 && (
              <span className="ml-auto text-gold-700">
                {t(lang, `Divert it all → +${esg.opportunityTCO2e} tCO₂e`, `حوّلوه كله ← +${esg.opportunityTCO2e} طن مكافئ`)}
              </span>
            )}
          </div>
        </section>
      )}

      {/* This quarter */}
      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="section-rule" aria-hidden />
            <h2 className="text-lg font-semibold tracking-tight text-brand-800">
              {t(lang, `Q${q} ${year} report`, `تقرير الربع ${q} لسنة ${year}`)}
            </h2>
            <p className="text-sm text-muted">
              {current
                ? statusLabel[current.status] ?? current.status
                : t(lang, 'Not started — Abdullah can complete it with you in a few minutes.', 'لم يبدأ بعد — عبدالله يكمله معكم في دقائق.')}
            </p>
          </div>
          <Link
            href="/portal/chat"
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {current ? t(lang, 'Continue with Abdullah →', '← أكملوا مع عبدالله') : t(lang, 'Start with Abdullah →', '← ابدأوا مع عبدالله')}
          </Link>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickAction
          className="fade-up fade-up-1"
          href="/portal/collection"
          title={t(lang, 'Request collection', 'طلب جمع النواتج')}
          ar={t(lang, 'طلب جمع النواتج', 'Request collection')}
          hint={openTickets > 0 ? t(lang, `${openTickets} active ticket${openTickets === 1 ? '' : 's'}`, `${openTickets} تذكرة نشطة`) : t(lang, 'Fronds, pits, fibers…', 'سعف، نوى، ليف…')}
        />
        <QuickAction
          className="fade-up fade-up-2"
          href="/portal/market"
          title={t(lang, 'Sell surplus', 'بيع الفائض')}
          ar={t(lang, 'بيع الفائض', 'Sell surplus')}
          hint={t(lang, 'List dates or byproducts', 'اعرضوا التمور أو النواتج')}
        />
        <QuickAction
          className="fade-up fade-up-3"
          href="/portal/applications"
          title={t(lang, 'Apply', 'التقديم')}
          ar={t(lang, 'التقديم', 'Apply')}
          hint={t(lang, 'Awards · grants · honors', 'جوائز · منح · تكريم')}
        />
        <QuickAction
          className="fade-up fade-up-4"
          href="/portal/profile"
          title={t(lang, 'Your profile', 'ملف المنشأة')}
          ar={t(lang, 'ملف المنشأة', 'Your profile')}
          hint={t(lang, 'Keep your record complete', 'أبقوا سجلكم مكتملًا')}
        />
      </section>

      {/* Region context */}
      {baseline && (
        <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="section-rule" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-brand-800">
            {lang === 'ar' ? `منطقتكم — ${baseline.nameAr} · ${baseline.nameEn}` : `Your region — ${baseline.nameEn} · ${baseline.nameAr}`}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-semibold text-ink">
                {(baseline.palmTrees / 1_000_000).toFixed(1)}M
              </div>
              <div className="text-[11px] text-muted">{t(lang, 'palm trees', 'نخلة')}</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-ink">
                {Math.round(baseline.dateProductionTons / 1000).toLocaleString('en-US')}K t
              </div>
              <div className="text-[11px] text-muted">{t(lang, 'date production / yr', 'إنتاج التمور سنويًا')}</div>
            </div>
            <div>
              <div className="text-xl font-semibold text-ink">
                {Math.round(baseline.palmByproductsTons / 1000).toLocaleString('en-US')}K t
              </div>
              <div className="text-[11px] text-muted">{t(lang, 'byproducts / yr', 'نواتج ثانوية سنويًا')}</div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {t(lang, "Your reports build the Emirates' food-security map — every measured ton replaces an estimate. مساهمتكم تبني الخريطة الوطنية.", 'تقاريركم تبني خريطة الأمن الغذائي للإمارات — كل طن مُقاس يحل محل تقدير. Your reports build the national map.')}
          </p>
        </section>
      )}
    </div>
  );
}

function QuickAction({
  href,
  title,
  ar,
  hint,
  className,
}: {
  href: string;
  title: string;
  ar: string;
  hint: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border border-line bg-white p-4 shadow-card transition hover:shadow-card-hover ${className ?? ''}`}
    >
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="text-xs text-brand-600">{ar}</div>
      <div className="mt-2 text-[11px] leading-snug text-muted">{hint}</div>
    </Link>
  );
}
