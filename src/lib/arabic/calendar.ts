/**
 * Emirati seasonal/Hijri time anchors → reporting quarter.
 *
 * Farmers don't say "Q3 2026". They say "بعد القيظ" (after the summer
 * heat), "طلع سهيل" (when Suhail rose — the traditional marker that the
 * worst heat is breaking, ~late August), or a Hijri month. This module
 * maps those anchors to a {year, quarter} deterministically, relative to
 * a reference date, so the model never silently guesses a period.
 *
 * Conventions:
 *  - Named seasons resolve to the quarter in which they dominantly fall.
 *  - "الماضي/اللي راح" (last/past) picks the most recent completed
 *    occurrence of the anchor.
 *  - Hijri months map via a compact AH→Gregorian table (1446–1448 covers
 *    June 2024 – June 2027; enough for the reporting horizon) and a
 *    mean-month fallback outside it.
 */

import { normalizeArabic, containsTerm } from './lexicon';

export interface PeriodResolution {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  /** What phrase matched and how we got the answer — goes to the audit trail. */
  matched: string;
  basis: 'SEASON' | 'HIJRI' | 'EXPLICIT' | 'APPROX';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  note?: string;
}

// ── Seasonal anchors ───────────────────────────────────────────
// quarterOf(month) helper: Jan-Mar=Q1 … Oct-Dec=Q4.

interface SeasonAnchor {
  code: string;
  variants: string[];
  /** Gregorian month range the anchor refers to. */
  monthStart: number; // 1-12
  monthEnd: number;
  /** Which quarter the phrase resolves to as a reporting period. */
  quarter: 1 | 2 | 3 | 4;
  note?: string;
}

export const SEASON_ANCHORS: SeasonAnchor[] = [
  {
    code: 'GHAITH',
    variants: ['القيظ', 'قيظ', 'القيظ اللي راح', 'عز القيظ', 'شدة الحر', 'ذروة الصيف', 'الصيف', 'الصيف الماضي', 'after the summer', 'the summer heat'],
    monthStart: 6, monthEnd: 9,
    quarter: 3,
    note: 'القيظ = peak summer heat (Jun–Sep) — dominant quarter Q3. "بعد القيظ" resolves to Q4.',
  },
  {
    code: 'POST_GHAITH',
    variants: ['بعد القيظ', 'بعد الصيف', 'بعد الحر', 'بعد شدة الحر', 'بعد ما راحت الحر', 'بعد انقضاء الصيف'],
    monthStart: 9, monthEnd: 12,
    quarter: 4,
    note: '"After the summer heat" — the cooling-off and post-harvest cleanup period.',
  },
  {
    code: 'SUHAIL',
    variants: ['سهيل', 'طلع سهيل', 'طلوع سهيل', 'عند طلوع سهيل', 'لما طلع سهيل', 'suhail', 'suhail star'],
    monthStart: 8, monthEnd: 9,
    quarter: 3,
    note: 'Suhail (Canopus) rises ~late August — the traditional marker that peak heat is breaking; falls in Q3.',
  },
  {
    code: 'HASAD',
    variants: ['الحصاد', 'موسم الحصاد', 'وقت الحصاد', 'القطاف', 'موسم القطاف', 'حصادنا', 'قطفنا', 'harvest', 'harvest season'],
    monthStart: 6, monthEnd: 9,
    quarter: 3,
    note: 'Date harvest (rutab/tamr picking) runs Jun–Sep in the UAE → Q3.',
  },
  {
    code: 'SHITA',
    variants: ['الشتاء', 'شتاء', 'الشتويه', 'البرد', 'زمن البرد', 'السراب', 'winter', 'the cold season'],
    monthStart: 12, monthEnd: 2,
    quarter: 1,
    note: 'Winter (Dec–Feb). Reporting-wise a winter utterance mid-year refers to the most recent winter → Q1; near year-end it can be ambiguous — resolver flags cross-year cases.',
  },
  {
    code: 'RABIEE',
    variants: ['الربيع', 'ربيع', 'موسم الربيع', 'الدسم', 'الرطب الأول', 'spring', 'early spring'],
    monthStart: 2, monthEnd: 4,
    quarter: 1,
    note: 'الربيع/الدسم — pollination-to-early-fruit window → Q1 (Apr spillover handled by caller asking).',
  },
];

// ── Hijri months ───────────────────────────────────────────────

export const HIJRI_MONTHS: { ar: string; index: number; variants: string[] }[] = [
  { ar: 'محرم', index: 1, variants: ['محرم', 'المحرم'] },
  { ar: 'صفر', index: 2, variants: ['صفر'] },
  { ar: 'ربيع الأول', index: 3, variants: ['ربيع الأول', 'ربيع الاول', 'ربيع ١'] },
  { ar: 'ربيع الآخر', index: 4, variants: ['ربيع الآخر', 'ربيع الاخر', 'ربيع الثاني', 'ربيع ٢'] },
  { ar: 'جمادى الأولى', index: 5, variants: ['جمادى الأولى', 'جمادى الاولى', 'جمادى ١'] },
  { ar: 'جمادى الآخرة', index: 6, variants: ['جمادى الآخرة', 'جمادى الاخرة', 'جمادى الثانية', 'جمادى ٢'] },
  { ar: 'رجب', index: 7, variants: ['رجب'] },
  { ar: 'شعبان', index: 8, variants: ['شعبان'] },
  { ar: 'رمضان', index: 9, variants: ['رمضان', 'شهر رمضان', 'ramadan'] },
  { ar: 'شوال', index: 10, variants: ['شوال', 'شوّال', 'عيد الفطر', 'العيد الصغير'] },
  { ar: 'ذو القعدة', index: 11, variants: ['ذو القعدة', 'ذي القعدة', 'القعدة'] },
  { ar: 'ذو الحجة', index: 12, variants: ['ذو الحجة', 'ذي الحجة', 'الحج', 'أيام الحج', 'عيد الأضحى', 'العيد الكبير'] },
];

/**
 * Gregorian start month (approx) of each Hijri month for AH 1446–1448.
 * Table values are { [hijriMonth]: [gregYear, gregMonth(1-12)] } for the
 * 1st of that month (±1 day is fine — we only need the quarter).
 * Sources: Umm al-Qura calendar (standard for UAE).
 */
const HIJRI_STARTS: Record<number, Record<number, [number, number]>> = {
  // AH 1446 began ~7 Jul 2024
  1446: { 1: [2024, 7], 2: [2024, 8], 3: [2024, 9], 4: [2024, 10], 5: [2024, 11], 6: [2024, 12], 7: [2025, 1], 8: [2025, 1], 9: [2025, 3], 10: [2025, 3], 11: [2025, 4], 12: [2025, 5] },
  // AH 1447 began ~26 Jun 2025
  1447: { 1: [2025, 6], 2: [2025, 7], 3: [2025, 9], 4: [2025, 10], 5: [2025, 11], 6: [2025, 12], 7: [2026, 1], 8: [2026, 1], 9: [2026, 2], 10: [2026, 3], 11: [2026, 4], 12: [2026, 5] },
  // AH 1448 begins ~16 Jun 2026
  1448: { 1: [2026, 6], 2: [2026, 7], 3: [2026, 9], 4: [2026, 10], 5: [2026, 11], 6: [2026, 12], 7: [2027, 1], 8: [2027, 1], 9: [2027, 2], 10: [2027, 3], 11: [2027, 4], 12: [2027, 5] },
};

function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Resolve a farmer's time reference to a reporting {year, quarter}.
 * `refDate` is "now" from the caller's perspective (usually new Date()).
 * Returns null when nothing matched — the caller asks a generic question.
 */
export function resolvePeriod(text: string, refDate: Date = new Date()): PeriodResolution | null {
  const t = normalizeArabic(text);

  // Explicit quarter/month mentions first — highest confidence.
  const explicit = matchExplicitPeriod(t, refDate);
  if (explicit) return explicit;

  // Season anchors — collect every match, then take the LONGEST matched
  // variant. "بعد القيظ" contains "القيظ" as a substring; the longer
  // phrase is the more specific anchor and must win.
  const matches: { anchor: SeasonAnchor; variant: string }[] = [];
  for (const anchor of SEASON_ANCHORS) {
    for (const v of anchor.variants) {
      if (containsTerm(t, v)) matches.push({ anchor, variant: v });
    }
  }
  if (matches.length > 0) {
    matches.sort((a, b) => b.variant.length - a.variant.length);
    const best = matches[0];
    return seasonToPeriod(best.anchor, best.variant, refDate);
  }

  // Hijri month mentions.
  const hijri = matchHijriMonth(t, refDate);
  if (hijri) return hijri;

  return null;
}

/**
 * Convert a season anchor to the most recent {year, quarter} it refers to.
 * "الماضي/اللي راح" forces the last COMPLETED occurrence; otherwise we
 * take the occurrence whose quarter is the most recent one not in the
 * future relative to refDate.
 */
function seasonToPeriod(anchor: SeasonAnchor, matched: string, refDate: Date): PeriodResolution {
  const nowY = refDate.getUTCFullYear();
  const nowM = refDate.getUTCMonth() + 1;
  const nowQ = quarterOfMonth(nowM);

  // For a winter anchor (Dec–Feb), the relevant quarter is Q1 of the
  // following year relative to Dec. We anchor to the quarter the season
  // dominantly occupies: Q1 for الشتاء, Q3 for القيظ, etc.
  let year = nowY;
  // If the anchor's quarter is in the future this year, it refers to last year.
  if (anchor.quarter > nowQ) year -= 1;

  // Cross-year edge (e.g. said "الشتاء" in Jan): winter = Dec–Feb, so the
  // current winter's reporting quarter is THIS year's Q1 — don't step back.
  if (anchor.code === 'SHITA' && nowM <= 2) year = nowY;

  return {
    year,
    quarter: anchor.quarter,
    matched,
    basis: 'SEASON',
    confidence: 'MEDIUM',
    note: anchor.note,
  };
}

/**
 * Explicit Gregorian forms the model might see in mixed speech:
 *   "الربع الثاني", "ربع ثلاثة", "Q2", "في مارس", "2025 Q3", "شهر ٧"
 */
function matchExplicitPeriod(t: string, refDate: Date): PeriodResolution | null {
  const m = t.match(/(?:q|الربع)\s*([1-4١٢٣٤])/i);
  if (m) {
    const q = '١٢٣٤'.indexOf(m[1]) >= 0 ? ('١٢٣٤'.indexOf(m[1]) + 1) as 1 | 2 | 3 | 4 : (Number(m[1]) as 1 | 2 | 3 | 4);
    const year = q <= quarterOfMonth(refDate.getUTCMonth() + 1)
      ? refDate.getUTCFullYear()
      : refDate.getUTCFullYear() - 1;
    return { year, quarter: q, matched: m[0], basis: 'EXPLICIT', confidence: 'HIGH' };
  }
  const gregMonths: [string, number][] = [
    ['يناير', 1], ['فبراير', 2], ['مارس', 3], ['ابريل', 4], ['أبريل', 4],
    ['مايو', 5], ['يونيو', 6], ['يوليو', 7], ['اغسطس', 8], ['أغسطس', 8],
    ['سبتمبر', 9], ['اكتوبر', 10], ['أكتوبر', 10], ['نوفمبر', 11], ['ديسمبر', 12],
  ];
  for (const [name, month] of gregMonths) {
    if (!t.includes(normalizeArabic(name))) continue;
    const year = month <= refDate.getUTCMonth() + 1
      ? refDate.getUTCFullYear()
      : refDate.getUTCFullYear() - 1;
    return {
      year,
      quarter: quarterOfMonth(month),
      matched: name,
      basis: 'EXPLICIT',
      confidence: 'HIGH',
    };
  }
  return null;
}

/**
 * Map a Hijri month mention to Gregorian → quarter via the Umm al-Qura
 * table (1446–1448). Falls back to a mean synodic estimate outside the
 * table range, flagged LOW confidence + APPROX.
 */
function matchHijriMonth(t: string, refDate: Date): PeriodResolution | null {
  for (const hm of HIJRI_MONTHS) {
    for (const v of hm.variants) {
      if (!t.includes(normalizeArabic(v))) continue;

      // Current AH year from the Gregorian date. Rough pivot: AH 1447 began
      // ~26 Jun 2025; each AH year ≈ 354.37 days.
      const approxAH = estimateAHYear(refDate);
      const starts = HIJRI_STARTS[approxAH];
      if (starts?.[hm.index]) {
        const [gY, gM] = starts[hm.index];
        return {
          year: gY,
          quarter: quarterOfMonth(gM),
          matched: v,
          basis: 'HIJRI',
          confidence: 'HIGH',
          note: `${v} ${approxAH}هـ → ~${gY}-${String(gM).padStart(2, '0')} (Umm al-Qura)`,
        };
      }
      // Out-of-table fallback: month-index fraction of the lunar year.
      const frac = (hm.index - 1) / 12;
      const approxStart = refDate.getTime() - frac * 354.37 * 86400_000;
      const d = new Date(approxStart);
      return {
        year: d.getUTCFullYear(),
        quarter: quarterOfMonth(d.getUTCMonth() + 1),
        matched: v,
        basis: 'APPROX',
        confidence: 'LOW',
        note: `${v} resolved by lunar-mean estimate — outside the Umm al-Qura table range; treat as approximate.`,
      };
    }
  }
  return null;
}

/** Rough current AH year for table lookup (good enough for quarter resolution). */
function estimateAHYear(d: Date): number {
  const epoch = Date.UTC(2025, 5, 26); // 1 Muharram 1447 ≈ 26 Jun 2025
  const days = (d.getTime() - epoch) / 86400_000;
  return 1447 + Math.floor(days / 354.37);
}
