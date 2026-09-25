/**
 * UAE Palm Network — provisional brand lockup (inline SVG, no asset files).
 *
 * A seven-frond palm mark (one frond per emirate) over a bilingual wordmark.
 * Variants:
 *   - `dark` (default): teal ink for light backgrounds
 *   - `light`: warm-white for dark backgrounds (sidebar, sign-in panel)
 *   - markOnly: the palm mark alone (collapsed sidebar, favicons)
 *
 * NOTE: provisional white-label identity. Replace with the client's official
 * brand files (vector + usage guide) when an operating brand is adopted.
 */

interface LogoProps {
  variant?: 'dark' | 'light';
  /** Width in pixels (height auto-derived from the source aspect ratio) */
  width?: number;
  alt?: string;
  className?: string;
  /** Show only the palm mark (no wordmark). */
  markOnly?: boolean;
  priority?: boolean;
}

const LOCKUP_ASPECT = 523 / 144; // kept from the previous lockup so layouts don't shift
const MARK_ASPECT = 168 / 144;

/** Seven fronds — one per emirate — over a gold trunk and ground line. */
function PalmMark({ ink, gold }: { ink: string; gold: string }) {
  return (
    <g>
      {/* fronds */}
      <g stroke={ink} strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M84 62 C 84 40, 84 30, 84 18" />
        <path d="M84 62 C 74 44, 66 34, 52 24" />
        <path d="M84 62 C 94 44, 102 34, 116 24" />
        <path d="M84 62 C 66 50, 50 44, 32 42" />
        <path d="M84 62 C 102 50, 118 44, 136 42" />
        <path d="M84 62 C 64 60, 46 62, 30 70" />
        <path d="M84 62 C 104 60, 122 62, 138 70" />
      </g>
      {/* trunk */}
      <path d="M84 62 C 82 86, 86 102, 84 122" stroke={gold} strokeWidth="9" strokeLinecap="round" fill="none" />
      {/* ground */}
      <path d="M58 128 H 110" stroke={gold} strokeWidth="6" strokeLinecap="round" />
    </g>
  );
}

export default function Logo({
  variant = 'dark',
  width = 160,
  alt = 'UAE Palm Network — شبكة نخيل الإمارات',
  className,
  markOnly = false,
  priority: _priority = false,
}: LogoProps) {
  const ink = variant === 'light' ? '#F7F3EA' : '#0C3B43';
  const gold = variant === 'light' ? '#D5B672' : '#B08A3E';
  const sub = variant === 'light' ? 'rgba(247,243,234,0.75)' : '#6E7A78';

  const aspectRatio = markOnly ? MARK_ASPECT : LOCKUP_ASPECT;
  const height = Math.round(width / aspectRatio);

  if (markOnly) {
    return (
      <svg
        viewBox="0 0 168 144"
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label={alt}
      >
        <PalmMark ink={ink} gold={gold} />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 523 144"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={alt}
    >
      <PalmMark ink={ink} gold={gold} />
      {/* Wordmark */}
      <text
        x="168"
        y="66"
        fill={ink}
        fontFamily="Inter, 'Segoe UI', sans-serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="1"
      >
        UAE PALM NETWORK
      </text>
      <text
        x="168"
        y="108"
        fill={sub}
        fontFamily="'Noto Naskh Arabic', 'Segoe UI', sans-serif"
        fontSize="30"
      >
        شبكة نخيل الإمارات
      </text>
    </svg>
  );
}
