import { UPN_FACTS, REGION_BASELINE, TIER_LADDER, validateFacts } from '@/facts';

export const dynamic = 'force-dynamic';

export default function FactsPage() {
  const validation = validateFacts();
  const totals = UPN_FACTS.baseline.nationalTotals;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Fact Graph</h1>
        <p className="text-sm text-muted">
          Source of truth for taxonomy, tiers, and the emirate baseline (public sources + indicative allocations — see caveats).
          Validation: {validation.ok ? '✓ consistent' : `✗ ${validation.errors.length} issue(s)`}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">National baseline</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Palms (national, approx.)" value={`~${totals.palmTreesApprox.toLocaleString('en-US')}`} />
          <Stat label="Date production (t/yr, FAO 2022)" value={`~${totals.dateProductionTons.toLocaleString('en-US')}`} />
          <Stat label="Surveyed farm palms (Abu Dhabi)" value={totals.farmPalmsSurveyed.toLocaleString('en-US')} />
          <Stat label="Surveyed farms (Abu Dhabi)" value={totals.farmsSurveyed.toLocaleString('en-US')} />
          <Stat label="Global production rank" value={`#${totals.globalRank}`} />
          <Stat label="Date varieties" value={`${totals.dateVarieties}+`} />
          <Stat label="Est. byproducts (t/yr, working set)" value={totals.palmByproductsTons.toLocaleString('en-US')} />
          <Stat label="Est. farm date waste (t/yr)" value={totals.farmDateWasteTons.toLocaleString('en-US')} />
        </div>
        <p className="mt-2 text-xs text-muted">{UPN_FACTS.baseline.caveats.join(' ')}</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Tier ladder</h2>
        <div className="space-y-2">
          {TIER_LADDER.map((t) => (
            <div key={t.code} className="rounded-lg border border-line bg-white p-3">
              <div className="font-medium">{t.order}. {t.nameEn} · {t.nameAr}</div>
              <div className="text-sm text-muted">Earned by: {t.earnedBy}</div>
              <div className="text-sm text-muted">Unlocks: {t.unlocks}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Regional baseline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="p-2">Region</th>
                <th className="p-2 text-right">Palm trees</th>
                <th className="p-2 text-right">Production (t)</th>
                <th className="p-2 text-right">Byproducts (t)</th>
                <th className="p-2 text-right">Factories</th>
                <th className="p-2 text-right">Recyclers</th>
              </tr>
            </thead>
            <tbody>
              {REGION_BASELINE.map((r) => (
                <tr key={r.code} className="border-t border-line/70">
                  <td className="p-2">{r.nameEn} · {r.nameAr}</td>
                  <td className="p-2 text-right">{r.palmTrees.toLocaleString('en-US')}</td>
                  <td className="p-2 text-right">{r.dateProductionTons.toLocaleString('en-US')}</td>
                  <td className="p-2 text-right">{r.palmByproductsTons.toLocaleString('en-US')}</td>
                  <td className="p-2 text-right">{r.dateFactories ?? '—'}</td>
                  <td className="p-2 text-right">{r.recyclingPlants ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Hard rules</h2>
        <div className="space-y-1 text-sm">
          {UPN_FACTS.hardRules.map((r) => (
            <div key={r.id} className="rounded border border-line bg-white p-2">
              <span className="font-mono text-xs text-muted">[{r.id} · {r.severity}]</span> {r.rule}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
