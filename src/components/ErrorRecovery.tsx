'use client';

import { useEffect } from 'react';

/**
 * Shared body for error.tsx / global-error.tsx.
 *
 * After a deploy, a tab opened on the previous build still holds that build's
 * server-action ids and chunk hashes. The next form submit or navigation then
 * fails with UnrecognizedActionError / ChunkLoadError. A reload fetches the
 * current build and the action works — so for those errors we reload once
 * automatically (guarded, to avoid loops) instead of showing a dead screen.
 */

const RELOAD_FLAG = 'upn-stale-reload-at';

function isStaleDeployError(error: Error): boolean {
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  return /UnrecognizedActionError|Server Action .* was not found|failed-to-find-server-action|ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(text);
}

export default function ErrorRecovery({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleDeployError(error);

  useEffect(() => {
    if (!stale) return;
    try {
      const last = Number(window.sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      if (Date.now() - last < 30_000) return; // already reloaded just now — show the screen instead
      window.sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch {
      /* sessionStorage unavailable — still reload once */
    }
    window.location.reload();
  }, [stale]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" style={{ background: '#F4F1EA' }}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold text-brand-800">
          {stale ? 'Updating to the latest version…' : 'Something went wrong'}
        </h1>
        <p className="mt-1 text-sm text-brand-700" dir="rtl" lang="ar">
          {stale ? 'جارٍ التحديث إلى أحدث إصدار…' : 'حدث خطأ غير متوقع'}
        </p>
        <p className="mt-3 text-sm text-muted">
          {stale
            ? 'The platform was just updated. Reloading the page picks up the new version.'
            : 'Please try again. If it keeps happening, sign out and back in.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => (stale ? window.location.reload() : reset())}
            className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {stale ? 'Reload · إعادة التحميل' : 'Try again · حاول مجددًا'}
          </button>
          <a
            href="/signin"
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-mist"
          >
            Sign in · الدخول
          </a>
        </div>
        {error?.digest && <p className="mt-4 text-[10px] text-muted">ref: {error.digest}</p>}
      </div>
    </div>
  );
}
