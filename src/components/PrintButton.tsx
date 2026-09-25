'use client';

/** Print / Save-as-PDF trigger. Uses the browser's native print-to-PDF —
 *  no server chromium dependency. The page carries print styles. */
export default function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
    >
      {label}
    </button>
  );
}
