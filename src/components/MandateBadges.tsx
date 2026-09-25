/**
 * <MandateBadges /> — the row of national mandates the platform's numbers
 * feed. Each pill carries a tooltip naming the commitment; the row appears
 * on the login hero, the national cockpit, and the public showcase so the
 * through-line never breaks: measured tons → real national mandates.
 */

const MANDATES: Array<{ en: string; ar: string; tip: string }> = [
  {
    en: 'Net Zero by 2050',
    ar: 'الحياد الصفري 2050',
    tip: 'UAE Net Zero by 2050 strategic initiative — measured diversion contributes to the national pathway.',
  },
  {
    en: 'COP28 Sustainable Agriculture',
    ar: 'إعلان COP28 للزراعة المستدامة',
    tip: 'COP28 UAE Declaration on Sustainable Agriculture, Resilient Food Systems, and Climate Action.',
  },
  {
    en: 'Circular Economy 2021–2031',
    ar: 'الاقتصاد الدائري 2021–2031',
    tip: 'UAE Circular Economy Policy 2021–2031 — residue diverted to productive fates is the measured contribution.',
  },
  {
    en: 'Plant the Emirates',
    ar: 'ازرعوا الإمارات',
    tip: 'Plant the Emirates national programme for expanding agriculture and green cover.',
  },
  {
    en: 'Food Security 2051',
    ar: 'الأمن الغذائي 2051',
    tip: 'UAE National Food Security Strategy 2051 — the network is the sector’s data layer.',
  },
  {
    en: 'Al Ain & Liwa (FAO GIAHS)',
    ar: 'واحات العين و ليوا',
    tip: 'Al Ain and Liwa oases are FAO Globally Important Agricultural Heritage Systems.',
  },
];

export default function MandateBadges({
  tone = 'light',
  className = '',
}: {
  /** 'light' for white surfaces, 'dark' for hero/dark bands. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const cls =
    tone === 'dark'
      ? 'border-white/25 bg-white/10 text-white/85 hover:bg-white/15'
      : 'border-line bg-white text-brand-700 hover:border-gold-300 hover:bg-gold-50';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {MANDATES.map((m) => (
        <span
          key={m.en}
          title={m.tip}
          className={`inline-flex cursor-default items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${cls}`}
        >
          <span dir="rtl" lang="ar">{m.ar}</span>
          <span aria-hidden className="opacity-50">·</span>
          <span>{m.en}</span>
        </span>
      ))}
    </div>
  );
}
