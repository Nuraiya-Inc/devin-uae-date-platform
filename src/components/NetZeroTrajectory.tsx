/**
 * NetZeroTrajectory — cumulative indicative avoided emissions per year vs
 * the UAE Net Zero 2050 horizon. One axis, draw-in animation, crosshair
 * tooltip via native <title>. Server-rendered SVG — no client JS needed.
 *
 * Palette job: magnitude → single sequential hue (palm green ramp);
 * the 2050 horizon is a neutral dashed guide, not a second series color.
 */

interface Props {
  /** perYear series from NetZeroContext: { year, avoidedTCO2e } */
  perYear: Array<{ year: number; avoidedTCO2e: number }>;
  targetYear: number;
  currentYear: number;
}

const W = 640;
const H = 220;
const PAD = { t: 18, r: 16, b: 30, l: 52 };

export default function NetZeroTrajectory({ perYear, targetYear, currentYear }: Props) {
  const x0 = PAD.l;
  const x1 = W - PAD.r;
  const y0 = PAD.t;
  const y1 = H - PAD.b;

  // Cumulative measured series.
  const cumulative: Array<{ year: number; cum: number }> = [];
  let acc = 0;
  for (const p of perYear) {
    acc += p.avoidedTCO2e;
    cumulative.push({ year: p.year, cum: Math.round(acc * 10) / 10 });
  }

  // X domain: first data year (or currentYear) through the 2050 horizon.
  const firstYear = cumulative[0]?.year ?? currentYear;
  const yearSpan = Math.max(1, targetYear - firstYear);
  const maxY = Math.max(1, ...cumulative.map((c) => c.cum)) * 1.12;

  const px = (year: number) => x0 + ((year - firstYear) / yearSpan) * (x1 - x0);
  const py = (v: number) => y1 - (v / maxY) * (y1 - y0);

  const points = cumulative.map((c) => `${px(c.year).toFixed(1)},${py(c.cum).toFixed(1)}`).join(' ');
  const area =
    cumulative.length > 0
      ? `${x0},${y1} ${points} ${px(cumulative[cumulative.length - 1].year).toFixed(1)},${y1}`
      : '';

  // Y ticks: 0, ½, max.
  const ticks = [0, maxY / 2, maxY];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Cumulative indicative avoided emissions reaching ${acc.toFixed(0)} tCO₂e toward Net Zero ${targetYear}`}>
      {/* horizon guide */}
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="#E6E1D6" strokeDasharray="4 5" />
      <line x1={x0} y1={y0 + (y1 - y0) / 2} x2={x1} y2={y0 + (y1 - y0) / 2} stroke="#E6E1D6" strokeDasharray="4 5" opacity={0.6} />

      {/* 2050 horizon marker */}
      <line x1={x1} y1={y0} x2={x1} y2={y1} stroke="#B08A3E" strokeWidth={1.5} strokeDasharray="3 4" />
      <text x={x1 - 4} y={y0 + 12} textAnchor="end" fontSize={10} fill="#B08A3E" fontWeight={600}>
        Net Zero {targetYear}
      </text>

      {/* Y axis ticks */}
      {ticks.map((v, i) => (
        <g key={i}>
          <text x={x0 - 8} y={py(v) + 3.5} textAnchor="end" fontSize={9.5} fill="#6E7A78">
            {v >= 1000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v)}
          </text>
          {i > 0 && <line x1={x0} y1={py(v)} x2={x1} y2={py(v)} stroke="#F4F1EA" />}
        </g>
      ))}
      <text x={x0 - 8} y={y0 - 4} textAnchor="end" fontSize={9} fill="#6E7A78">tCO₂e</text>

      {/* area fill under the cumulative line */}
      {cumulative.length > 0 && (
        <polygon points={area} fill="#2E9E7E" opacity={0.10} />
      )}

      {/* the line — draw-in via CSS animation on stroke-dashoffset */}
      {cumulative.length > 1 && (
        <polyline
          className="draw-in"
          pathLength={1}
          points={points}
          fill="none"
          stroke="#1E6B55"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* data points + hover targets */}
      {cumulative.map((c) => (
        <g key={c.year}>
          <circle cx={px(c.year)} cy={py(c.cum)} r={10} fill="transparent">
            <title>{c.year}: {c.cum.toLocaleString('en-US')} tCO₂e cumulative (indicative)</title>
          </circle>
          <circle cx={px(c.year)} cy={py(c.cum)} r={4} fill="#1E6B55" stroke="#fff" strokeWidth={1.5} />
          <text x={px(c.year)} y={y1 + 14} textAnchor="middle" fontSize={9.5} fill="#6E7A78">
            {c.year}
          </text>
        </g>
      ))}

      {/* single-point fallback: still label the year */}
      {cumulative.length === 1 && (
        <text x={px(cumulative[0].year)} y={y1 + 14} textAnchor="middle" fontSize={9.5} fill="#6E7A78">
          {cumulative[0].year}
        </text>
      )}

      {/* 2050 x-label */}
      <text x={x1} y={y1 + 14} textAnchor="end" fontSize={9.5} fill="#B08A3E">{targetYear}</text>
    </svg>
  );
}
