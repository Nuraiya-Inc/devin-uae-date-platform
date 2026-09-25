/**
 * Local UAE units → kg, with honest low–high ranges.
 *
 * A farmer never says "340 kg". He says "وايت نص" or "٣ بيكات". Each
 * entry carries a RANGE, not a point value — per the ESG-honesty and
 * baseline-honesty rules, ranges marked INDICATIVE are estimates to be
 * calibrated against real partner data, never presented as measured.
 *
 * `ambiguity` controls the resolver's clarify-or-guess policy:
 *   NONE — universally understood (kg, ton) → record directly
 *   LOW  — reasonably consistent local meaning → record the range, note it
 *   HIGH — varies wildly by farm/material → MUST trigger a clarifying
 *           question (`clarifier`, phrased in dialect, ready to send)
 */

import { containsTerm } from './lexicon';

export type UnitAmbiguity = 'NONE' | 'LOW' | 'HIGH';

export interface LocalUnit {
  code: string;
  canonicalAr: string;
  variants: string[];
  /** kg bounds for ONE unit (e.g. one بيكة, one وايت load). */
  kgLow: number;
  kgHigh: number;
  /** Working midpoint used only when a single number is unavoidable. */
  kgTypical: number;
  ambiguity: UnitAmbiguity;
  /** One targeted question in Emirati dialect — asked ONLY when the
   *  answer changes the number. */
  clarifier?: string;
  caveat: string;
}

export const LOCAL_UNITS: LocalUnit[] = [
  {
    code: 'TON',
    canonicalAr: 'طن',
    variants: ['طن', 'اطنان', 'أطنان', 'طنن', 'طن واحد', 'ton', 'tons', 'tonne'],
    kgLow: 1000, kgHigh: 1000, kgTypical: 1000,
    ambiguity: 'NONE',
    caveat: 'Metric ton = 1000 kg.',
  },
  {
    code: 'KG',
    canonicalAr: 'كيلو',
    variants: ['كيلو', 'كج', 'كغم', 'كيلوغرام', 'كيلوجرام', 'كيلوهات', 'kg', 'kilo', 'kilos'],
    kgLow: 1, kgHigh: 1, kgTypical: 1,
    ambiguity: 'NONE',
    caveat: 'Kilogram.',
  },
  {
    code: 'WAITE',
    canonicalAr: 'وايت',
    variants: ['وايت', 'وايت مويه', 'وايت ميه', 'وايت ماء', 'وايته', 'وايتات', 'وايتين', 'waite', 'waaet', 'tanker', 'water tanker'],
    kgLow: 400, kgHigh: 1500, kgTypical: 800,
    ambiguity: 'HIGH',
    clarifier: 'الوايت طن ولا نص تقريبًا؟ (400–1500 كغ على قد المويه/السعف)',
    caveat: 'INDICATIVE. "وايت" is a small water-tanker or a heaped pickup load depending on the farm — the spread is real, not noise. Ask unless the farmer gives a count AND a size.',
  },
  {
    code: 'BEIKA',
    canonicalAr: 'بيكة',
    variants: ['بيكة', 'بيكه', 'بيكات', 'بيكتين', 'بيكة بامبو', 'بيكة بلاستيك', 'beika', 'beeka', 'beyka', 'baika', 'basket of dates'],
    kgLow: 3, kgHigh: 8, kgTypical: 5,
    ambiguity: 'LOW',
    clarifier: 'البيكة عندكم كم كيلو تقريبًا؟ (غالبًا ٤–٦ كغ)',
    caveat: 'INDICATIVE. بيكة is a harvested-dates container (bamboo/plastic), commonly ~4–6 kg, bigger for family packing. Reasonable to record with the range and confirm.',
  },
  {
    code: 'SALLA',
    canonicalAr: 'سلّة',
    variants: ['سلة', 'سله', 'سلال', 'سلّات', 'سلتين', 'salla', 'salah', 'basket'],
    kgLow: 5, kgHigh: 15, kgTypical: 9,
    ambiguity: 'HIGH',
    clarifier: 'السلة الصغيرة ولا الكبيرة؟ كم كيلو تاخذ عندكم؟',
    caveat: 'INDICATIVE. سلة sizes vary (shopping basket to picking basket); range is wide. Ask if the total matters.',
  },
  {
    code: 'JALLA',
    canonicalAr: 'جلّة',
    variants: ['جلة', 'جلات', 'جلّات', 'مقول', 'مقوله', 'كيس خيش', 'جوال', 'jalla', 'jallah', 'gallah', 'sack'],
    kgLow: 40, kgHigh: 70, kgTypical: 50,
    ambiguity: 'LOW',
    clarifier: 'الجلة الخيشة الكبيرة (٥٠ كغ) ولا أصغر؟',
    caveat: 'INDICATIVE. A jute feed sack ≈ 50 kg is the common convention for pits/dates; smaller sacks exist.',
  },
  {
    code: 'HAMOULA',
    canonicalAr: 'حمولة',
    variants: ['حمولة', 'حموله', 'لود', 'لودين', 'شحنة', 'شحنتين', 'حمولة بيك اب', 'load', 'pickup load', 'truckload', 'hamoula', 'hamla'],
    kgLow: 300, kgHigh: 900, kgTypical: 550,
    ambiguity: 'HIGH',
    clarifier: 'حمولة بيك اب صغير ولا قلاب؟ كم طن تقريبًا فيها؟',
    caveat: 'INDICATIVE. A pickup-load of fronds/karab depends on stacking; ranges from a small half-ton pickup to a 1-ton tipper. Ask when it matters.',
  },
  {
    code: 'SANDUQ',
    canonicalAr: 'صندوق',
    variants: ['صندوق', 'كرتون', 'كراتين', 'صناديق', 'box', 'carton', 'sanduq', 'sandoog'],
    kgLow: 10, kgHigh: 25, kgTypical: 15,
    ambiguity: 'HIGH',
    clarifier: 'الصندوق الصغير (١٠ كغ) ولا الكبير؟',
    caveat: 'INDICATIVE. Retail packing boxes vs field crates differ a lot.',
  },
  {
    code: 'KEES',
    canonicalAr: 'كيس',
    variants: ['كيس', 'أكياس', 'كيسين', 'bag', 'bags', 'kees'],
    kgLow: 20, kgHigh: 50, kgTypical: 30,
    ambiguity: 'HIGH',
    clarifier: 'الكيس كم كيلو ياخذ عندكم؟ (من ٢٠ إلى ٥٠ كغ)',
    caveat: 'INDICATIVE. Bags range from feed bags to heavy jute sacks — ask before recording if it changes the number.',
  },
];

/** Fraction modifiers around a unit: "طن ونص" = 1.5t, "نص طن" = 0.5t.
 *
 * Semantics: every modifier adds `factor` of ONE unit. `impliesWhole`
 * marks the و-variants ("و نص", "وربع") that carry an implied whole unit
 * — "طن ونص" = 1 + 0.5. Bare fractions ("نص طن") add only the fraction.
 * The resolver picks the LONGEST matched variant so "ونص" beats the
 * "نص" nested inside it. */
export const UNIT_MODIFIERS: { variants: string[]; factor: number; impliesWhole?: boolean }[] = [
  { variants: ['و نص', 'ونص', 'وزيد نص', 'زايد نص'], factor: 0.5, impliesWhole: true },
  { variants: ['و ربع', 'وربع'], factor: 0.25, impliesWhole: true },
  { variants: ['و ثلث', 'وثلث'], factor: 1 / 3, impliesWhole: true },
  { variants: ['نص', 'نصف', 'نص واحد'], factor: 0.5 },
  { variants: ['ربع', 'ربعة'], factor: 0.25 },
  { variants: ['ثلث'], factor: 1 / 3 },
];

/** Approximation markers — widen the resulting range. */
export const APPROX_MARKERS = [
  'حوالي', 'تقريبا', 'تقريبًا', 'شي', 'زي', 'زيه', 'قريب', 'بحدود', 'بنحو',
  'اللي هو', 'يعني', 'قريب من', 'في حدود', 'ميش', 'about', 'around', 'roughly', 'approx',
];

// ── Number words (1–10, common in speech) ──────────────────────

export const NUMBER_WORDS: { ar: string; value: number }[] = [
  { ar: 'واحد', value: 1 }, { ar: 'واحدة', value: 1 }, { ar: 'حبة', value: 1 },
  { ar: 'اثنين', value: 2 }, { ar: 'ثنين', value: 2 }, { ar: 'زوج', value: 2 },
  { ar: 'عشرين', value: 20 }, { ar: 'ثلاثين', value: 30 },
  { ar: 'أربعين', value: 40 }, { ar: 'اربعين', value: 40 },
  { ar: 'خمسين', value: 50 }, { ar: 'ستين', value: 60 },
  { ar: 'سبعين', value: 70 }, { ar: 'ثمانين', value: 80 },
  { ar: 'تسعين', value: 90 },
  { ar: 'مئة', value: 100 }, { ar: 'ميه', value: 100 }, { ar: 'مية', value: 100 },
  { ar: 'مئتين', value: 200 }, { ar: 'ميتين', value: 200 },
  { ar: 'ألف', value: 1000 }, { ar: 'الف', value: 1000 },
  { ar: 'ثلاثة', value: 3 }, { ar: 'ثلاث', value: 3 },
  { ar: 'أربعة', value: 4 }, { ar: 'اربعة', value: 4 }, { ar: 'اربع', value: 4 },
  { ar: 'خمسة', value: 5 }, { ar: 'خمس', value: 5 },
  { ar: 'ستة', value: 6 }, { ar: 'ست', value: 6 },
  { ar: 'سبعة', value: 7 }, { ar: 'سبع', value: 7 },
  { ar: 'ثمانية', value: 8 }, { ar: 'ثماني', value: 8 },
  { ar: 'تسعة', value: 9 }, { ar: 'تسع', value: 9 },
  { ar: 'عشرة', value: 10 }, { ar: 'عشر', value: 10 },
];

// ── Matching helpers ───────────────────────────────────────────

export function findUnit(text: string): LocalUnit | null {
  for (const u of LOCAL_UNITS) {
    for (const v of [u.canonicalAr, ...u.variants]) {
      if (containsTerm(text, v)) return u;
    }
  }
  return null;
}
