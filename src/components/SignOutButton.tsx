'use client';

import { LogOut } from 'lucide-react';
import { signOutAction } from '@/app/actions/sign-out';

/**
 * Sign-out button — three variants share the same server action.
 *   'icon'  → square icon button (sidebar footer, dark surface)
 *   'text'  → text button (portal top bar, light surface)
 *   'block' → full-width bordered button (account page)
 */
export default function SignOutButton({
  variant = 'text',
  label = 'Sign out',
  labelAr = 'تسجيل الخروج',
}: {
  variant?: 'icon' | 'text' | 'block';
  label?: string;
  labelAr?: string;
}) {
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={() => signOutAction()}
        title={`${label} · ${labelAr}`}
        aria-label={`${label} · ${labelAr}`}
        className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    );
  }

  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={() => signOutAction()}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-red-300 hover:text-red-700"
      >
        <LogOut className="h-4 w-4" />
        {label} <span dir="rtl" lang="ar" className="text-muted">· {labelAr}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signOutAction()}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand-300 hover:text-brand-700"
    >
      <LogOut className="h-3.5 w-3.5" />
      {labelAr}
    </button>
  );
}
