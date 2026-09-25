/**
 * Skeleton — animated grey placeholder for loading states.
 *
 * Drop this into a `loading.tsx` (Next.js route segment loader) to show
 * a shaped placeholder while server components fetch. Pulses subtly using
 * a CSS animation defined in globals.css for a calm "this is loading" feel
 * — no spinners, no progress bars.
 */

interface Props {
  className?: string;
  /** Tailwind width (e.g. 'w-24', 'w-full'). */
  w?: string;
  /** Tailwind height (e.g. 'h-4', 'h-24'). */
  h?: string;
  /** Tailwind rounding (defaults to rounded-md). */
  rounded?: string;
}

export default function Skeleton({
  className = '',
  w = 'w-full',
  h = 'h-4',
  rounded = 'rounded-md',
}: Props) {
  return (
    <div
      className={`${w} ${h} ${rounded} bg-line/60 animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
