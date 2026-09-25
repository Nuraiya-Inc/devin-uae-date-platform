/**
 * Arabic-native eval — "proof it works" for the Arabic layer.
 *
 *   npx tsx scripts/eval-arabic.ts              deterministic arm only (no keys needed)
 *   npx tsx scripts/eval-arabic.ts --with-model adds the plain-model baseline arm (ANTHROPIC_API_KEY)
 *
 * Arm A (always): the deterministic resolver (src/lib/arabic) on a corpus
 * of Emirati-farmer utterances — stream classification, tonnage bounds,
 * period resolution, clarify-vs-guess verdict. Scored against ground
 * truth below.
 *
 * Arm B (--with-model): the SAME utterances fed to the plain model with
 * today's pre-build instruction ("speak MSA, mirror the user, extract
 * figures") — showing the silent-guess failure modes the pipeline
 * removes. Prints a side-by-side scorecard.
 *
 * Extend the corpus as real voice notes arrive — the file is data-first.
 */

import { resolveQuantity, playbackLine } from '../src/lib/arabic';
import { normalizeDigits } from '../src/lib/arabic/resolve';

// ── Corpus ─────────────────────────────────────────────────────
// expectedKgLo/Hi define the ACCEPTABLE band for kgMid: pass if
// kgMid falls inside. null expectations mean the field must be null.
// `mustClarify` expected true = resolver must refuse to record.

interface Case {
  id: string;
  utterance: string;
  kind: 'WASTE' | 'PRODUCTION';
  expected: {
    stream?: string | null;
    fate?: string | null;
    variety?: string | null;
    kgLo?: number | null;   // kgMid must be ≥ kgLo
    kgHi?: number | null;   // kgMid must be ≤ kgHi
    quarter?: number | null;
    mustClarify?: boolean;
  };
  note?: string;
}

const CORPUS: Case[] = [
  {
    id: 'waite-jarid-post-ghaith',
    utterance: 'عندي وايت جريد ونص كرب بعد القيظ، رميناه في البر',
    kind: 'WASTE',
    expected: { stream: 'FRONDS', fate: 'DUMPED', kgLo: 300, kgHi: 1500, quarter: 4, mustClarify: true },
    note: 'وايت = ambiguous unit → must ask, not guess. بعد القيظ → Q4.',
  },
  {
    id: 'waite-size-confirmed',
    utterance: 'وايت جريد طن واحد تقريبا',
    kind: 'WASTE',
    expected: { stream: 'FRONDS', kgLo: 800, kgHi: 1200, mustClarify: false },
    note: '"وايت طن واحد" — farmer stated the size (≈1t), so resolving as ~1000kg with the approx band is correct; no clarify needed.',
  },
  {
    id: 'beikat',
    utterance: 'جمعنا ٣ بيكات سكري',
    kind: 'PRODUCTION',
    expected: { variety: 'Sukkari', kgLo: 9, kgHi: 24, mustClarify: false },
    note: '٣ بيكات → 9–24 kg range. The headline failure case from the pitch.',
  },
  {
    id: 'tons-explicit',
    utterance: 'حصدنا حوالي ١٥ طن خلاص السنة هذي',
    kind: 'PRODUCTION',
    expected: { variety: 'Khalas', kgLo: 12000, kgHi: 17500, mustClarify: true },
    note: 'Quantity is clear (≈15t Khalas) but "السنة هذي" is not a quarter — resolver must ask which one.',
  },
  {
    id: 'suhail',
    utterance: 'طلع سهيل ونظفنا المزرعة، عندي حمولة كرب',
    kind: 'WASTE',
    expected: { stream: 'FROND_BASE', quarter: 3, mustClarify: true },
    note: 'سهيل → Q3 (late Aug). حمولة ambiguous → ask.',
  },
  {
    id: 'ramadan',
    utterance: 'في رمضان بعنا النوى لمصنع الأعلاف',
    kind: 'WASTE',
    expected: { stream: 'PITS', fate: 'SOLD', mustClarify: true },
    note: 'Hijri month → quarter via Umm al-Qura. Quantity missing → ask.',
  },
  {
    id: 'feed-fronds',
    utterance: 'السعف كله علف للغنم، شي عشرين كيلو في اليوم',
    kind: 'WASTE',
    expected: { stream: 'FRONDS', fate: 'FEED', kgLo: 15, kgHi: 30, mustClarify: false },
    note: 'Explicit kg — no clarification needed.',
  },
  {
    id: 'burned-karab',
    utterance: 'حرقنا الكرب زمان بس الحين نبي ندوّره',
    kind: 'WASTE',
    expected: { stream: 'FROND_BASE', fate: 'BURNED', mustClarify: true },
    note: 'Past burning acknowledged; no quantity → ask.',
  },
  {
    id: 'compost-leef',
    utterance: 'الليف رح لمصنع التدوير، كيسين كبار',
    kind: 'WASTE',
    expected: { stream: 'FIBER', fate: 'RECYCLED', mustClarify: true },
    note: 'كيس HIGH ambiguity → ask.',
  },
  {
    id: 'bare-number',
    utterance: 'عندي 15 جريد',
    kind: 'WASTE',
    expected: { stream: 'FRONDS', mustClarify: true },
    note: '15 what? tons, kg, loads — must ask.',
  },
  {
    id: 'jalla-pits',
    utterance: 'خمس جلات نوى بعناها',
    kind: 'WASTE',
    expected: { stream: 'PITS', fate: 'SOLD', kgLo: 200, kgHi: 350, mustClarify: false },
    note: 'جلة LOW ambiguity → record the range.',
  },
  {
    id: 'fard-harvest-q2',
    utterance: 'فرد حصدناه في يونيو، ٢ طن ونص',
    kind: 'PRODUCTION',
    expected: { variety: 'Fard', kgLo: 2400, kgHi: 2600, quarter: 2, mustClarify: false },
    note: 'Explicit month → Q2. ونص → ×1.5.',
  },
];

// ── Scoring ────────────────────────────────────────────────────

interface ArmResult {
  id: string;
  pass: boolean;
  detail: string;
}

function scoreResolver(): ArmResult[] {
  return CORPUS.map((c) => {
    const r = resolveQuantity(normalizeDigits(c.utterance), c.kind);
    const fails: string[] = [];
    const e = c.expected;

    if (e.stream !== undefined && r.stream !== e.stream)
      fails.push(`stream: got ${r.stream}, want ${e.stream}`);
    if (e.fate !== undefined && r.fate !== e.fate)
      fails.push(`fate: got ${r.fate}, want ${e.fate}`);
    if (e.variety !== undefined && r.variety !== e.variety)
      fails.push(`variety: got ${r.variety}, want ${e.variety}`);
    if (e.quarter !== undefined && r.period?.quarter !== e.quarter)
      fails.push(`quarter: got ${r.period?.quarter ?? '∅'}, want ${e.quarter}`);
    if (e.kgLo != null && (r.kgMid === null || r.kgMid < e.kgLo))
      fails.push(`kgMid ${r.kgMid} < ${e.kgLo}`);
    if (e.kgHi != null && (r.kgMid === null || r.kgMid > e.kgHi))
      fails.push(`kgMid ${r.kgMid} > ${e.kgHi}`);
    if (e.mustClarify !== undefined && r.mustClarify !== e.mustClarify)
      fails.push(`mustClarify: got ${r.mustClarify}, want ${e.mustClarify}`);

    return {
      id: c.id,
      pass: fails.length === 0,
      detail: fails.length
        ? `FAIL — ${fails.join('; ')}`
        : `OK — ${playbackLine(r)}${r.mustClarify ? ` | asks: ${r.clarifyQuestion}` : ''}`,
    };
  });
}

// ── Optional: plain-model baseline arm ─────────────────────────

async function scorePlainModel(): Promise<ArmResult[]> {
  const { getAnthropicClient } = await import('../src/lib/anthropic');
  const client = getAnthropicClient();
  const out: ArmResult[] = [];

  for (const c of CORPUS) {
    const resp = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 300,
      temperature: 0,
      system:
        'You are a bilingual farm-report assistant. The partner writes in Emirati Arabic. ' +
        'Extract the reported quantity and categorize it. Reply ONLY with compact JSON: ' +
        '{"stream": "DATES|PITS|FRONDS|FROND_BASE|FIBER|OTHER|null", "fate": "FEED|SOLD|RECYCLED|BURNED|BURIED|DUMPED|UNKNOWN|null", "variety": "canonical-en|null", "tons": number|null, "quarter": 1|2|3|4|null, "would_ask_clarification": boolean}. No prose.',
      messages: [{ role: 'user', content: c.utterance }],
    });
    const text = resp.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      out.push({ id: c.id, pass: false, detail: `FAIL — non-JSON reply: ${text.slice(0, 80)}` });
      continue;
    }
    if (!parsed) {
      out.push({ id: c.id, pass: false, detail: 'FAIL — empty parse' });
      continue;
    }
    const e = c.expected;
    const fails: string[] = [];
    if (e.stream !== undefined && parsed.stream !== e.stream)
      fails.push(`stream: got ${parsed.stream}, want ${e.stream}`);
    if (e.fate !== undefined && parsed.fate !== e.fate)
      fails.push(`fate: got ${parsed.fate}, want ${e.fate}`);
    if (e.kgLo != null) {
      const kg = typeof parsed.tons === 'number' ? parsed.tons * 1000 : null;
      if (kg === null || kg < e.kgLo) fails.push(`tons→kg ${kg} < ${e.kgLo}`);
    }
    if (e.kgHi != null) {
      const kg = typeof parsed.tons === 'number' ? parsed.tons * 1000 : null;
      if (kg === null || kg > e.kgHi) fails.push(`tons→kg ${kg} > ${e.kgHi}`);
    }
    if (e.mustClarify === true && parsed.would_ask_clarification !== true)
      fails.push('model recorded instead of asking');
    out.push({
      id: c.id,
      pass: fails.length === 0,
      detail: fails.length ? `FAIL — ${fails.join('; ')}` : `OK — ${JSON.stringify(parsed)}`,
    });
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(70));
  console.log('ARM A — deterministic Arabic resolver (src/lib/arabic)');
  console.log('═'.repeat(70));
  const a = scoreResolver();
  for (const r of a) console.log(`${r.pass ? '✅' : '❌'} ${r.id.padEnd(26)} ${r.detail}`);
  const aPass = a.filter((r) => r.pass).length;
  console.log(`\nResolver: ${aPass}/${a.length} passed (${Math.round((aPass / a.length) * 100)}%)`);

  if (process.argv.includes('--with-model')) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('\n--with-model requires ANTHROPIC_API_KEY; skipping Arm B.');
      return;
    }
    console.log('\n' + '═'.repeat(70));
    console.log('ARM B — plain model, no resolver (baseline for comparison)');
    console.log('═'.repeat(70));
    const b = await scorePlainModel();
    for (const r of b) console.log(`${r.pass ? '✅' : '❌'} ${r.id.padEnd(26)} ${r.detail}`);
    const bPass = b.filter((r) => r.pass).length;
    console.log(`\nPlain model: ${bPass}/${b.length} passed (${Math.round((bPass / b.length) * 100)}%)`);
    console.log(`\nDelta: ${aPass - bPass >= 0 ? '+' : ''}${aPass - bPass} cases — the pipeline advantage.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
