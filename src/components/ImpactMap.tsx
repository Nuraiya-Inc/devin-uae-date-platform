/**
 * ImpactMap — a schematic map of the seven emirates, coloured by network
 * participation. Deliberately stylised (not a survey-grade boundary map);
 * arrangement mirrors UAE geography so it reads at a glance. Server
 * component: pass in aggregated EmirateImpact rows.
 */

import type { EmirateImpact } from '@/lib/impact-map';

// Schematic positions (viewBox 0 0 560 380). Rough geographic arrangement.
const SHAPES: Record<string, { x: number; y: number; w: number; h: number; lx: number; ly: number }> = {
  ABU_DHABI:      { x: 20,  y: 180, w: 250, h: 175, lx: 145, ly: 275 },
  DUBAI:          { x: 278, y: 208, w: 92,  h: 62,  lx: 324, ly: 242 },
  SHARJAH:        { x: 278, y: 150, w: 120, h: 52,  lx: 338, ly: 178 },
  AJMAN:          { x: 330, y: 126, w: 60,  h: 20,  lx: 360, ly: 140 },
  UMM_AL_QUWAIN:  { x: 350, y: 92,  w: 74,  h: 28,  lx: 387, ly: 110 },
  RAS_AL_KHAIMAH: { x: 400, y: 28,  w: 130, h: 58,  lx: 465, ly: 60 },
  FUJAIRAH:       { x: 452, y: 118, w: 74,  h: 120, lx: 489, ly: 180 },
};

/** Participation → fill. null (no data / suppressed) = neutral sand. */
function fillFor(pct: number | null): string {
  if (pct === null) return '#E7E2D6';
  if (pct >= 75) return '#1E6B55';
  if (pct >= 50) return '#2E9E7E';
  if (pct >= 25) return '#5BC0A2';
  return '#A7DBCB';
}

export default function ImpactMap({ emirates }: { emirates: EmirateImpact[] }) {
  const byCode = new Map(emirates.map((e) => [e.code, e]));

  return (
    <div className="w-full">
      <svg viewBox="0 0 560 380" className="h-auto w-full" role="img" aria-label="UAE participation map by emirate">
        {Object.entries(SHAPES).map(([code, s]) => {
          const e = byCode.get(code);
          const pct = e?.participationPct ?? null;
          return (
            <g key={code}>
              <rect
                x={s.x} y={s.y} width={s.w} height={s.h} rx="10"
                fill={fillFor(pct)} stroke="#ffffff" strokeWidth="2"
              >
                <title>
                  {e ? `${e.nameEn} — ${e.partners} partner${e.partners === 1 ? '' : 's'}${pct !== null ? `, ${pct}% reporting` : ''}` : code}
                </title>
              </rect>
              <text x={s.lx} y={s.ly} textAnchor="middle" fontSize="12" fontWeight="600"
                fill={pct !== null && pct >= 50 ? '#ffffff' : '#0B1F26'}>
                {e?.nameEn ?? code}
              </text>
              {e && (
                <text x={s.lx} y={s.ly + 15} textAnchor="middle" fontSize="10"
                  fill={pct !== null && pct >= 50 ? 'rgba(255,255,255,0.85)' : '#6E7A78'}>
                  {e.partners > 0 ? `${e.partners} partner${e.partners === 1 ? '' : 's'}` : 'building'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="font-medium text-ink">Participation:</span>
        {[
          { c: '#A7DBCB', l: '<25%' },
          { c: '#5BC0A2', l: '25–49%' },
          { c: '#2E9E7E', l: '50–74%' },
          { c: '#1E6B55', l: '75%+' },
          { c: '#E7E2D6', l: 'building / <3 partners' },
        ].map((k) => (
          <span key={k.l} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: k.c }} />
            {k.l}
          </span>
        ))}
      </div>
    </div>
  );
}
