/**
 * Unit tests for the M6 climate engine — pure-math coverage, no DB needed.
 *
 * Covers (pack acceptance):
 *   1. Fate math — diverted (FEED/SOLD/RECYCLED) counted; harmful
 *      (BURNED/BURIED/DUMPED) surfaced as opportunity; UNKNOWN neither.
 *   2. Indicative flag — every estimate carries indicative: true.
 *   3. Aggregation floor — MIN_AGGREGATE is 3 (≥3-partner rule, UPN-3).
 *
 * Run: npx tsx scripts/test-esg-engine.ts
 */
import assert from 'node:assert/strict';
import {
  summarize,
  climateNarrative,
  INDICATIVE_FACTOR_TCO2E_PER_TON,
  DIVERTED_FATES,
  HARMFUL_FATES,
} from '../src/lib/esg';
import { MIN_AGGREGATE } from '../src/lib/sector-report';

console.log('🧪 M6 climate-engine tests');

// ── Fate math ─────────────────────────────────────────────────────
const est = summarize(2025, [
  { stream: 'FRONDS', fate: 'FEED', tons: 10 },
  { stream: 'FRONDS', fate: 'SOLD', tons: 5 },
  { stream: 'PITS', fate: 'RECYCLED', tons: 3 },
  { stream: 'FRONDS', fate: 'BURNED', tons: 8 },
  { stream: 'FROND_BASE', fate: 'BURIED', tons: 4 },
  { stream: 'OTHER', fate: 'DUMPED', tons: 2 },
  { stream: 'FIBER', fate: 'UNKNOWN', tons: 6 },
]);

assert.equal(est.divertedTons, 18, 'diverted = FEED+SOLD+RECYCLED');
assert.equal(est.harmfulTons, 14, 'harmful = BURNED+BURIED+DUMPED');
assert.equal(est.totalWasteTons, 38, 'total includes UNKNOWN');
assert.equal(est.estAvoidedTCO2e, Math.round(18 * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10, 'avoided = diverted × factor');
assert.equal(est.opportunityTCO2e, Math.round(14 * INDICATIVE_FACTOR_TCO2E_PER_TON * 10) / 10, 'opportunity = harmful × factor');
assert.equal(est.diversionRatePct, Math.round((18 / 38) * 100), 'diversion rate over all recorded tons');
assert.equal(est.indicative, true, 'estimate carries indicative flag');
assert.equal(est.byStream.length, 2, 'byStream groups diverted streams only');

// Diverted and harmful sets are disjoint and match the WasteFate enum.
for (const f of DIVERTED_FATES) assert.ok(!(HARMFUL_FATES as readonly string[]).includes(f));
assert.deepEqual([...DIVERTED_FATES].sort(), ['FEED', 'RECYCLED', 'SOLD']);
assert.deepEqual([...HARMFUL_FATES].sort(), ['BURIED', 'BURNED', 'DUMPED']);

// ── Narrative helper ──────────────────────────────────────────────
const n = climateNarrative(est);
assert.equal(n.avoidedTCO2e, est.estAvoidedTCO2e);
assert.equal(n.opportunityTCO2e, est.opportunityTCO2e);
assert.equal(n.indicative, true);
assert.match(n.headlineEn, /indicative/i, 'EN headline says indicative');
assert.match(n.detailEn, /methane/i, 'detail frames methane avoidance');
assert.ok(n.headlineAr.length > 0, 'AR headline present');

// ── Edge cases ────────────────────────────────────────────────────
const empty = summarize(2025, []);
assert.equal(empty.divertedTons, 0);
assert.equal(empty.diversionRatePct, null, 'no division by zero');
assert.equal(empty.opportunityTCO2e, 0);
assert.equal(empty.indicative, true);

const allBurned = summarize(2025, [{ stream: 'FRONDS', fate: 'BURNED', tons: 10 }]);
assert.equal(allBurned.divertedTons, 0);
assert.equal(allBurned.harmfulTons, 10);
assert.equal(allBurned.estAvoidedTCO2e, 0, 'burned tons earn nothing');
assert.equal(allBurned.opportunityTCO2e, 12, 'all 10 tons are the opportunity');

// ── ≥3 aggregation floor (UPN-3) ──────────────────────────────────
assert.equal(MIN_AGGREGATE, 3, 'aggregation floor is 3 partners');
// The floor is enforced where aggregates are built (sector-report /
// impact-map null out sub-3 emirates) — verified live in parity-check.

console.log('   ✔ fate math: diverted / harmful / opportunity');
console.log('   ✔ indicative flag on every output');
console.log('   ✔ narrative frames methane + CO₂ avoidance');
console.log('   ✔ MIN_AGGREGATE = 3 (UPN-3 floor)');
console.log('✅ All M6 engine tests pass');
