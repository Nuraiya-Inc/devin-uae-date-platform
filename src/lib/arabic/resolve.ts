/**
 * The Arabic resolver — runs BEFORE Abdullah records anything.
 *
 * Input: a raw farmer utterance (typed or voice-note transcript).
 * Output: a structured, auditable resolution — kg low/high range,
 * waste stream, fate, variety, reporting period — plus a verdict:
 *   - resolved (record it), or
 *   - mustClarify (ask exactly one targeted dialect question).
 *
 * Design rules (from the standing rules):
 *   - Never invent a number. An unresolved quantity returns
 *     mustClarify + a dialect-phrased question — it does not guess.
 *   - Local units resolve to RANGES flagged INDICATIVE, consistent with
 *     UPN-7/ESG honesty.
 *   - Latin numerals in output (UPN Arabic-first rule) — Arabic-Indic
 *     numerals (٠١٢٣٤٥٦٧٨٩) are normalized on input.
 *
 * Everything here is pure + deterministic — unit-testable without a
 * model call, and stable across model upgrades.
 */

import {
  normalizeArabic,
  containsTerm,
  findStream,
  findFate,
  findVariety,
  type WasteStreamCode,
  type WasteFateCode,
} from './lexicon';
import {
  findUnit,
  NUMBER_WORDS,
  UNIT_MODIFIERS,
  APPROX_MARKERS,
} from './units';
import { resolvePeriod, type PeriodResolution } from './calendar';

export type ResolutionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ResolutionKind = 'WASTE' | 'PRODUCTION' | 'AUTO';

export interface QuantityResolution {
  /** The farmer's original words — verbatim, for the audit trail. */
  rawText: string;
  /** Digits normalized to Latin, diacritics stripped — what we parsed. */
  normalized: string;

  /** Quantity resolved to kg bounds (count × unit range). */
  kgLow: number | null;
  kgHigh: number | null;
  /** Working midpoint — used only where a single number is unavoidable. */
  kgMid: number | null;
  /** Number of units counted (٣ بيكات → 3). */
  count: number | null;
  unitCode: string | null;
  /** Range flagged INDICATIVE (local unit estimate) vs exact (kg/ton). */
  quantityIndicative: boolean;

  stream: WasteStreamCode | null;
  streamMatched: string | null;
  fate: WasteFateCode | null;
  fateMatched: string | null;
  variety: string | null;
  period: PeriodResolution | null;

  /** Was the utterance approximate ("حوالي"…)? Ranges already account for it. */
  approximate: boolean;

  confidence: ResolutionConfidence;
  mustClarify: boolean;
  /** ONE question in Emirati dialect, ready to relay verbatim — only
   * present when mustClarify is true and the answer changes the number. */
  clarifyQuestion: string | null;
  /** English-gloss version of the question for staff/debug transparency. */
  clarifyQuestionEn: string | null;

  notes: string[];
}

// ── Numeral + count extraction ─────────────────────────────────

const AR_INDIC: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => AR_INDIC[ch] ?? ch);
}

/** Extract the first numeric count from text: digits or number words. */
function extractCount(normalized: string): { count: number; matched: string } | null {
  // Arabic-Indic already normalized to Latin digits by caller.
  const d = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (d) return { count: parseFloat(d[1].replace(',', '.')), matched: d[0] };
  for (const w of NUMBER_WORDS) {
    const re = new RegExp(`(^|[^\\p{L}])${normalizeArabic(w.ar)}([^\\p{L}]|$)`, 'u');
    if (re.test(normalized)) return { count: w.value, matched: w.ar };
  }
  return null;
}

/** Find a fraction modifier applying to the unit. Longest matched
 * variant wins — "ونص" must not be swallowed by the "نص" inside it;
 * impliesWhole marks و-variants that carry a whole unit. */
function extractModifier(
  normalized: string,
): { factor: number; matched: string; impliesWhole: boolean } | null {
  let best: { factor: number; matched: string; impliesWhole: boolean } | null = null;
  for (const m of UNIT_MODIFIERS) {
    for (const v of m.variants) {
      if (!normalized.includes(normalizeArabic(v))) continue;
      if (!best || v.length > best.matched.length || (v.length === best.matched.length && m.impliesWhole)) {
        best = { factor: m.factor, matched: v, impliesWhole: !!m.impliesWhole };
      }
    }
  }
  return best;
}

function isApprox(normalized: string): boolean {
  return APPROX_MARKERS.some((m) => normalized.includes(normalizeArabic(m)));
}

// ── Confidence + clarify policy ────────────────────────────────

function defaultClarifier(kind: ResolutionKind): { ar: string; en: string } {
  return kind === 'PRODUCTION'
    ? { ar: 'الكمية كم تقريبًا — بالكيلو ولا بالطن؟', en: 'Roughly how much — in kilos or tons?' }
    : { ar: 'الكمية قد إيش تقريبًا — بالكيلو ولا بالطن؟', en: 'Roughly how much is it — in kilos or tons?' };
}

// ── Main entry ─────────────────────────────────────────────────

export function resolveQuantity(rawText: string, kind: ResolutionKind = 'AUTO'): QuantityResolution {
  const normalized = normalizeArabic(normalizeDigits(rawText));
  const notes: string[] = [];

  const count = extractCount(normalized);
  const modifier = extractModifier(normalized);
  const unit = findUnit(rawText);
  const stream = kind === 'PRODUCTION' ? null : findStream(rawText);
  const fate = kind === 'PRODUCTION' ? null : findFate(rawText);
  const variety = findVariety(rawText);
  const period = resolvePeriod(rawText);
  const approx = isApprox(normalized);

  let kgLow: number | null = null;
  let kgHigh: number | null = null;
  let kgMid: number | null = null;
  let mustClarify = false;
  let clarifyQuestion: string | null = null;
  let clarifyQuestionEn: string | null = null;
  let confidence: ResolutionConfidence = 'LOW';
  let quantityIndicative = false;

  // Total units = count + fraction-of-one-unit (additive, not
  // multiplicative): "٢ طن ونص" = 2 + 0.5 = 2.5t. A و-variant implies
  // a whole unit when no count was spoken: "طن ونص" = 1.5t. A unit
  // alone ("وايت جريد") means one by convention.
  const totalUnits =
    unit && (count || modifier)
      ? (count?.count ?? (modifier?.impliesWhole ? 1 : 0)) + (modifier?.factor ?? (count ? 0 : 1))
      : unit ? (count?.count ?? 1) : null;
  if (count && unit) notes.push(`count "${count.matched}" × unit "${unit.canonicalAr}"`);
  if (modifier) notes.push(`fraction "${modifier.matched}" → +${modifier.factor} of a ${unit?.canonicalAr ?? 'unit'}${modifier.impliesWhole ? ' (implies a whole too)' : ''}`);

  if (unit && totalUnits !== null) {
    kgLow = round1(unit.kgLow * totalUnits);
    kgHigh = round1(unit.kgHigh * totalUnits);
    kgMid = round1(unit.kgTypical * totalUnits);
    quantityIndicative = unit.ambiguity !== 'NONE';
    if (approx && unit.ambiguity === 'NONE') {
      // "حوالي ١٥ طن" — widen an exact unit by ±15% rather than pretend precision.
      kgLow = round1(kgLow * 0.85);
      kgHigh = round1(kgHigh * 1.15);
      notes.push('approximation marker → widened ±15%');
    }
    notes.push(unit.caveat);
  } else if (!unit && count) {
    // A bare number with no unit — the classic "٣ بيكات" failure is
    // covered; a bare "15" must still be clarified: 15 what?
    mustClarify = true;
    const q = defaultClarifier(kind);
    clarifyQuestion = q.ar;
    clarifyQuestionEn = q.en;
    notes.push(`bare number "${count.matched}" with no unit — cannot pick tons vs kg vs baskets`);
  } else {
    // Neither number nor unit.
    mustClarify = true;
    const q = defaultClarifier(kind);
    clarifyQuestion = q.ar;
    clarifyQuestionEn = q.en;
    notes.push('no quantity or unit found in the utterance');
  }

  // Unit ambiguity escalates to clarification only when it changes the
  // number materially — HIGH-ambiguity units always ask; LOW units record
  // the range and note it (the farmer confirms at playback).
  if (!mustClarify && unit && unit.ambiguity === 'HIGH' && unit.clarifier) {
    mustClarify = true;
    clarifyQuestion = unit.clarifier;
    clarifyQuestionEn = `Unit "${unit.code}" has a wide local range (${unit.kgLow}–${unit.kgHigh} kg); confirming size before recording.`;
  }

  // Year mentioned but no quarter — "السنة هذي" does not mean Q3 or Q4 by
  // itself. Don't let the agent (or an open report) silently pick a quarter.
  const yearReference = period === null && [
    'السنة', 'السنه', 'هذي السنة', 'هذي السنه', 'هذه السنة', 'هذه السنه',
    'العام', 'هذا العام', 'this year',
  ].find((v) => containsTerm(normalized, v));
  if (yearReference) {
    notes.push(`year reference "${yearReference}" with no quarter — must ask which quarter`);
    if (!mustClarify) {
      mustClarify = true;
      clarifyQuestion = 'أي ربع من السنة هذي؟ (ربع ١، ٢، ٣، ولا ٤؟)';
      clarifyQuestionEn = 'Which quarter of this year? (Q1, Q2, Q3, or Q4?)';
    } else {
      clarifyQuestion = `${clarifyQuestion} وأيضًا: أي ربع من السنة؟`;
      clarifyQuestionEn = `${clarifyQuestionEn}. Also, which quarter of this year?`;
    }
  }

  // Confidence grading.
  if (unit) {
    confidence =
      unit.ambiguity === 'NONE' && !approx ? 'HIGH'
      : unit.ambiguity === 'LOW' ? 'MEDIUM'
      : 'LOW';
  }
  if (stream && !fate) {
    notes.push('stream identified but fate unknown — ask where it went if not already stated');
  }
  if (period) notes.push(`period: ${period.matched} → ${period.year} Q${period.quarter} (${period.basis}, ${period.confidence})`);

  return {
    rawText,
    normalized,
    kgLow,
    kgHigh,
    kgMid,
    count: totalUnits,
    unitCode: unit?.code ?? null,
    quantityIndicative,
    stream: stream?.stream ?? null,
    streamMatched: stream?.matched ?? null,
    fate: fate?.fate ?? null,
    fateMatched: fate?.matched ?? null,
    variety: variety?.variety ?? null,
    period,
    approximate: approx,
    confidence,
    mustClarify,
    clarifyQuestion,
    clarifyQuestionEn,
    notes,
  };
}

/** Total units counted (exported for tests/eval inspection). */
export function unitsCounted(r: QuantityResolution): number | null {
  return r.count;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pretty Arabic playback line for confirmations (Latin numerals). */
export function playbackLine(r: QuantityResolution): string {
  const parts: string[] = [];
  if (r.kgMid !== null) {
    parts.push(
      r.quantityIndicative
        ? `≈ ${r.kgMid} كغ (${r.kgLow}–${r.kgHigh})`
        : `${r.kgMid} كغ`,
    );
  }
  if (r.stream) parts.push(streamLabelAr(r.stream));
  if (r.fate) parts.push(`→ ${r.fate}`);
  if (r.variety) parts.push(r.variety);
  if (r.period) parts.push(`${r.period.year} Q${r.period.quarter}`);
  return parts.join(' · ') || r.rawText;
}

function streamLabelAr(s: WasteStreamCode): string {
  return {
    DATES: 'فاقد تمور', PITS: 'نوى', FRONDS: 'جريد/سعف',
    FROND_BASE: 'كرب', FIBER: 'ليف', OTHER: 'نواتج أخرى',
  }[s];
}
