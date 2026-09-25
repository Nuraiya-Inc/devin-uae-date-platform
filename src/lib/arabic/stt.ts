/**
 * Speech-to-text priming — builds Whisper's `prompt` hint from the SAME
 * lexicon the resolver uses, so ASR and resolution can never drift apart.
 *
 * Today's transcribe route hardcodes a Latin-script hint ("Khalas, Lulu,
 * Fard…"), which nudges Whisper toward transliterating dialect speech
 * into Latin — exactly what we DON'T want for an Arabic-native pipeline.
 * An Arabic-script hint preserves dialect spellings the resolver's
 * variant tables are built to catch (جريد, وايت, بيكات, كرب).
 *
 * Whisper's prompt param is soft-capped (~224 tokens); keep the hint
 * compact: canonical dialect forms + a sentence establishing the domain
 * register, not every variant.
 */

import { STREAM_TERMS, VARIETY_TERMS, FATE_TERMS } from './lexicon';
import { LOCAL_UNITS } from './units';

/** Compose the Whisper `prompt` hint — Arabic-script, domain-primed. */
export function buildSttPrompt(): string {
  const streams = STREAM_TERMS.map((t) => t.variants[0] ?? t.canonicalAr).join('، ');
  const units = LOCAL_UNITS.map((u) => u.canonicalAr).join('، ');
  const varieties = VARIETY_TERMS.map((v) => v.canonicalAr).join('، ');
  const fates = FATE_TERMS.map((f) => f.canonicalAr).join('، ');
  const seasons = ['القيظ', 'سهيل', 'رمضان', 'الشتاء', 'الحصاد', 'الربيع'].join('، ');

  return [
    'تقرير موسمي لمزرعة نخيل في الإمارات، باللهجة الإماراتية.',
    `النواتج: ${streams}.`,
    `الوحدات: ${units}.`,
    `الأصناف: ${varieties}.`,
    `الوجهة: ${fates}.`,
    `المواسم: ${seasons}.`,
    'الأرقام قد تكون بالعربية أو اللاتينية.',
  ].join(' ');
}
