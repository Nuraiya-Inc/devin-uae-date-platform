/**
 * <IndicativeChip /> — the honesty guardrail rendered as UI.
 *
 * MUST sit on every carbon/impact figure that is not survey-measured
 * (guardrail F.1). Reads «تقديري · Indicative» — small, unmissable,
 * never a footnote. Server-renderable: no client hooks.
 */
export default function IndicativeChip({
  tone = 'light',
  className = '',
}: {
  /** 'light' for white surfaces, 'dark' for hero/dark bands. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const cls =
    tone === 'dark'
      ? 'border-white/35 bg-white/10 text-white/85'
      : 'border-gold-300 bg-gold-50 text-gold-700';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight ${cls} ${className}`}
      title="Indicative estimate — a conservative factor applied to measured tonnage, not verified carbon accounting. تقدير استرشادي — ليس قياسًا معتمدًا."
      dir="ltr"
    >
      <span dir="rtl" lang="ar">تقديري</span>
      <span aria-hidden>·</span>
      <span>Indicative</span>
    </span>
  );
}
