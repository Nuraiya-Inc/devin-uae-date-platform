/**
 * Emirati palm lexicon — the vocabulary data Abdullah used to rely on
 * the model "just knowing."
 *
 * Every term maps a canonical Arabic label + dialect/transliteration
 * variants to a canonical concept: a waste stream, a waste fate, or a
 * date variety. This is DATA, not prompt prose — the resolver, the
 * speech-to-text priming, and INT-01's normalization all read from the
 * same table so there is exactly one spelling authority.
 *
 * Variant lists are deliberately generous (common misspellings, dialect
 * forms, Latin transliterations from untuned ASR output). Matching is
 * done by the resolver after numeral/diacritic normalization.
 *
 * NOTE on honesty: this lexicon encodes domain conventions; it does not
 * by itself prove a figure. The resolver only maps vocabulary — the
 * partner's stated number (plus our indicative unit ranges) is what
 * produces a quantity.
 */

export type WasteStreamCode = 'DATES' | 'PITS' | 'FRONDS' | 'FROND_BASE' | 'FIBER' | 'OTHER';
export type WasteFateCode = 'FEED' | 'SOLD' | 'RECYCLED' | 'BURNED' | 'BURIED' | 'DUMPED' | 'UNKNOWN';

export interface StreamTerm {
  stream: WasteStreamCode;
  /** Canonical MSA label as used in the official taxonomy (src/facts). */
  canonicalAr: string;
  /** Emirati/Gulf dialect forms, plurals, transliterations, ASR artifacts. */
  variants: string[];
}

export interface FateTerm {
  fate: WasteFateCode;
  canonicalAr: string;
  variants: string[];
}

export interface VarietyTerm {
  /** Canonical Latin spelling used in reports. */
  canonicalEn: string;
  canonicalAr: string;
  variants: string[];
}

// ── Waste streams ──────────────────────────────────────────────

export const STREAM_TERMS: StreamTerm[] = [
  {
    stream: 'DATES',
    canonicalAr: 'فاقد التمور',
    variants: [
      'فاقد', 'تمور', 'تمر', 'رطب', 'خلال', 'تمر ردي', 'تمر ردئ',
      'dates', 'ratab', 'rutab', 'loose dates',
    ],
  },
  {
    stream: 'PITS',
    canonicalAr: 'نوى التمور',
    variants: ['نوى', 'نواة', 'نوى التمر', 'بذور', 'pits', 'seeds', 'nawa'],
  },
  {
    stream: 'FRONDS',
    canonicalAr: 'سعف',
    variants: [
      'سعف', 'جريد', 'الجريد', 'جريده', 'جرايد', 'سعف النخيل', 'خوص',
      'قرط', 'جريد النخيل',
      'jarid', 'jareed', 'saaf', 'fronds', 'frond', 'leaves',
    ],
  },
  {
    stream: 'FROND_BASE',
    canonicalAr: 'كرب',
    variants: [
      'كرب', 'الكرب', 'كرب النخلة', 'عذق', 'العذق', 'كرب سعف',
      'karab', 'karb', 'frond base', 'frond bases', 'pruning waste',
    ],
  },
  {
    stream: 'FIBER',
    canonicalAr: 'ليف',
    variants: ['ليف', 'الليف', 'ليف النخلة', 'لييف', 'leef', 'liff', 'fiber', 'fibre'],
  },
  {
    stream: 'OTHER',
    canonicalAr: 'نواتج أخرى',
    variants: ['نواتج', 'مخلفات أخرى', 'غيره', 'شغل ثاني', 'other', 'other byproducts'],
  },
];

// ── Waste fates ────────────────────────────────────────────────

export const FATE_TERMS: FateTerm[] = [
  {
    fate: 'FEED',
    canonicalAr: 'علف',
    variants: ['علف', 'للمواشي', 'للغنم', 'للحيوانات', 'للبقر', 'علف حيواني', 'feed', 'animal feed', 'for livestock'],
  },
  {
    fate: 'SOLD',
    canonicalAr: 'مبيع',
    variants: ['بعنا', 'انباع', 'بيع', 'مبيع', 'رح على مصنع', 'بعه', 'sold', 'sale'],
  },
  {
    fate: 'RECYCLED',
    canonicalAr: 'إعادة تدوير',
    variants: [
      'تدوير', 'اعادة تدوير', 'إعادة تدوير', 'كمبوست', 'سماد', 'بايوشار', 'فحم حيوي',
      'مفروم', 'فرم', 'recycled', 'recycling', 'compost', 'biochar', 'mulch',
    ],
  },
  {
    fate: 'BURNED',
    canonicalAr: 'محروق',
    variants: ['حرق', 'احترق', 'نحرق', 'شبب', 'حرقنا', 'burned', 'burnt', 'burning'],
  },
  {
    fate: 'BURIED',
    canonicalAr: 'مدفون',
    variants: ['دفن', 'دفنا', 'مدفون', 'ندفن', 'طمر', 'buried', 'burial', 'landfilled on-farm'],
  },
  {
    fate: 'DUMPED',
    canonicalAr: 'مرمي',
    variants: ['رمى', 'رمينا', 'مرمي', 'رجم', 'في البر', 'في الخرابة', 'dumped', 'thrown'],
  },
];

// ── Date varieties (canonical spellings — replaces the inline list
// in int-01's prompt) ───────────────────────────────────────────

export const VARIETY_TERMS: VarietyTerm[] = [
  { canonicalEn: 'Khalas',   canonicalAr: 'خلاص',   variants: ['خلاص', 'خالص', 'khalas', 'khlas'] },
  { canonicalEn: 'Barhi',    canonicalAr: 'برحي',   variants: ['برحي', 'برهي', 'barhi', 'berhi'] },
  { canonicalEn: 'Sukkari',  canonicalAr: 'سكري',   variants: ['سكري', 'سكّري', 'سكر', 'sukkari', 'sukari'] },
  { canonicalEn: 'Ajwa',     canonicalAr: 'عجوة',   variants: ['عجوة', 'عجوه', 'عجوة المدينة', 'ajwa'] },
  { canonicalEn: 'Saqie',    canonicalAr: 'صقعي',   variants: ['صقعي', 'صقعية', 'saqie', 'saqai'] },
  { canonicalEn: 'Medjool',  canonicalAr: 'مجدول',  variants: ['مجدول', 'مجدهول', 'medjool', 'medjoul', 'majdool'] },
  { canonicalEn: 'Fard',     canonicalAr: 'فرد',    variants: ['فرد', 'فارد', 'fard', 'fardh'] },
  { canonicalEn: 'Khenaizi', canonicalAr: 'خنيزي',  variants: ['خنيزي', 'خنيزية', 'khenaizi', 'khanezi', 'khunaizi'] },
  { canonicalEn: 'Lulu',     canonicalAr: 'لؤلؤ',   variants: ['لؤلؤ', 'لولو', 'lulu', 'loulou'] },
  { canonicalEn: 'Dabbas',   canonicalAr: 'دباس',   variants: ['دباس', 'دبّاس', 'dabbas'] },
  { canonicalEn: 'Shishi',   canonicalAr: 'شيشي',   variants: ['شيشي', 'شيش', 'shishi', 'sheeshi'] },
  { canonicalEn: 'Jabri',    canonicalAr: 'جبري',   variants: ['جبري', 'jabri', 'jebri'] },
  { canonicalEn: 'Boumaan',  canonicalAr: 'بومعان', variants: ['بومعان', 'بومعن', 'boumaan', 'bomaan'] },
  { canonicalEn: 'Hilali',   canonicalAr: 'هلالي',  variants: ['هلالي', 'hilali', 'helali'] },
  { canonicalEn: 'Naghal',   canonicalAr: 'نغال',   variants: ['نغال', 'نغال النخيل', 'naghal', 'nghal'] },
  { canonicalEn: 'Zamli',    canonicalAr: 'زملي',   variants: ['زملي', 'زملي', 'zamli'] },
];

// ── Lookup helpers ─────────────────────────────────────────────

/** Strip Arabic diacritics + tatweel, unify alef/taa marbuta for matching. */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

/** True if `text` contains `term` (normalized, word-boundary-ish for Latin). */
export function containsTerm(text: string, term: string): boolean {
  const nText = normalizeArabic(text);
  const nTerm = normalizeArabic(term);
  if (!nTerm) return false;
  // Arabic matches: substring is fine (morphology is messy anyway).
  // Latin matches: require non-alphanumeric boundaries to avoid "saaf" inside "saafra".
  if (/^[a-z\s]+$/i.test(nTerm)) {
    const re = new RegExp(`(^|[^a-z])${nTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    return re.test(nText);
  }
  return nText.includes(nTerm);
}

export function findStream(text: string): { stream: WasteStreamCode; matched: string } | null {
  for (const t of STREAM_TERMS) {
    for (const v of [t.canonicalAr, ...t.variants]) {
      if (containsTerm(text, v)) return { stream: t.stream, matched: v };
    }
  }
  return null;
}

export function findFate(text: string): { fate: WasteFateCode; matched: string } | null {
  for (const t of FATE_TERMS) {
    for (const v of [t.canonicalAr, ...t.variants]) {
      if (containsTerm(text, v)) return { fate: t.fate, matched: v };
    }
  }
  return null;
}

export function findVariety(text: string): { variety: string; matched: string } | null {
  for (const t of VARIETY_TERMS) {
    for (const v of [t.canonicalAr, ...t.variants]) {
      if (containsTerm(text, v)) return { variety: t.canonicalEn, matched: v };
    }
  }
  return null;
}
