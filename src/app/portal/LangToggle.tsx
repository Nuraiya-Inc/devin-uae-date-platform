'use client';

import { useRouter } from 'next/navigation';

/** Arabic/English switch — writes the upn-lang cookie and re-renders the portal. */
export default function LangToggle({ lang }: { lang: 'ar' | 'en' }) {
  const router = useRouter();

  function setLang(next: 'ar' | 'en') {
    document.cookie = `upn-lang=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div dir="ltr" className="flex items-center overflow-hidden rounded-full border border-line bg-white text-xs font-semibold">
      <button
        onClick={() => setLang('ar')}
        className={`px-3 py-1.5 transition ${lang === 'ar' ? 'bg-brand-700 text-white' : 'text-muted hover:text-ink'}`}
        aria-pressed={lang === 'ar'}
      >
        عربي
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1.5 transition ${lang === 'en' ? 'bg-brand-700 text-white' : 'text-muted hover:text-ink'}`}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  );
}
