/**
 * RegionBars — horizontal bar chart of the emirates (baseline magnitude)
 * with the measured (approved-report) share overlaid in mint.
 *
 * Server component; pure HTML/CSS. Marks: 12px bars, 4px rounded data-end,
 * square baseline; hover tooltip per mark (CSS-only); recessive axis text.
 */

interface Row {
  code: string;
  nameEn: string;
  nameAr: string;
  baseline: number; // production tons (modeled)
  measured: number; // approved-report tons
  partners: number;
}

export default function RegionBars({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => r.baseline));

  return (
    <div className="space-y-[7px]">
      {rows.map((r, i) => {
        const w = Math.max(0.6, (r.baseline / max) * 100);
        const mw = r.measured > 0 ? Math.max(0.6, (r.measured / max) * 100) : 0;
        return (
          <div key={r.code} className="group relative flex items-center gap-3">
            {/* axis label */}
            <div className="w-24 shrink-0 text-right text-[11px] leading-tight text-muted">
              {r.nameEn}
            </div>

            {/* plot band */}
            <div className="relative h-[12px] flex-1">
              {/* baseline bar */}
              <div
                className="viz-grow absolute inset-y-0 left-0 rounded-r-[4px] bg-brand-600/85 group-hover:bg-brand-600"
                style={{ width: `${w}%`, animationDelay: `${i * 45}ms` }}
              />
              {/* measured overlay */}
              {mw > 0 && (
                <div
                  className="viz-grow absolute inset-y-[3px] left-0 rounded-r-[3px] bg-mint-500"
                  style={{ width: `${mw}%`, animationDelay: `${i * 45 + 250}ms` }}
                />
              )}
              {/* value label at the tip — top three regions only (selective) */}
              {i < 3 && (
                <span
                  className="absolute top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-muted"
                  style={{ left: `calc(${w}% + 8px)` }}
                >
                  {Math.round(r.baseline / 1000).toLocaleString('en-US')}K t
                </span>
              )}

              {/* hover tooltip */}
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-white px-3 py-2 text-xs opacity-0 shadow-card-hover transition-opacity duration-100 group-hover:opacity-100">
                <div className="font-medium text-ink">
                  {r.nameEn} · {r.nameAr}
                </div>
                <div className="mt-0.5 text-muted">
                  <span className="mr-3 inline-flex items-center gap-1.5">
                    <i className="inline-block h-2 w-2 rounded-full bg-brand-600" />
                    Baseline {r.baseline.toLocaleString('en-US')} t
                  </span>
                  <span className="mr-3 inline-flex items-center gap-1.5">
                    <i className="inline-block h-2 w-2 rounded-full bg-mint-500" />
                    Measured {r.measured > 0 ? r.measured.toLocaleString('en-US') : '0'} t
                  </span>
                  <span>{r.partners} partner{r.partners === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* legend — two series, always present */}
      <div className="mt-3 flex items-center gap-5 pl-[108px] text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-brand-600/85" />
          Baseline production (modeled)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-mint-500" />
          Measured (approved reports)
        </span>
      </div>
    </div>
  );
}
