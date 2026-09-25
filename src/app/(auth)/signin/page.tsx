import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import Logo from '@/components/brand/Logo';
import MandateBadges from '@/components/MandateBadges';
import IndicativeChip from '@/components/IndicativeChip';
import CountUp from '@/components/viz/CountUp';
import { nationalEsgEstimate } from '@/lib/esg';

export const dynamic = 'force-dynamic';

/**
 * Sign-in / landing — the climate story leads (M1).
 *
 * RTL Arabic hero by default: «من النخلة إلى بيانات مناخية موثوقة» —
 * from the palm to trusted climate data — with a LIVE national headline
 * stat (approved-report diversion, indicative tCO₂e) and the mandate
 * badge row. The sign-in form is a clean secondary entry.
 *
 * Uses Auth.js v5 server action via form `action={...}` — this bypasses the
 * client-side `signIn()` from `next-auth/react` which has CSRF issues in v5
 * beta. Server actions have their own CSRF protection baked into Next.js, so
 * the form posts cleanly and Auth.js validates the credentials server-side.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorParam = params?.error;

  // Live headline stat — never hardcoded (acceptance: pulled from real data).
  const year = new Date().getUTCFullYear();
  const esg = await nationalEsgEstimate(year).catch(() => null);

  async function authenticate(formData: FormData) {
    'use server';
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirectTo: '/dashboard',
      });
    } catch (error) {
      // Next.js redirect throws — let it propagate to perform the redirect.
      if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
      // Auth.js errors — redirect back to /signin with an error flag.
      if (error instanceof AuthError) {
        redirect(`/signin?error=${error.type}`);
      }
      throw error;
    }
  }

  return (
    <main className="min-h-screen flex" style={{ background: '#F4F1EA' }}>
      {/* Left side — climate hero (RTL Arabic primary) */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col justify-between p-12 text-white"
        style={{ background: 'linear-gradient(150deg, #07272D 0%, #0C3B43 45%, #124E57 100%)' }}
      >
        <div>
          <Logo variant="light" width={200} priority />
        </div>

        <div>
          {/* Bilingual tagline — Arabic leads */}
          <div className="mb-2 text-sm text-gold-300" dir="ltr">
            UAE Palm Network · شبكة نخيل الإمارات
          </div>
          <div className="text-4xl font-semibold leading-snug mb-2 font-serif" dir="rtl" lang="ar">
            من النخلة إلى بيانات مناخية موثوقة
          </div>
          <div className="text-lg text-white/85 mb-5 tracking-tight">
            Measure. Verify. Contribute to Net Zero 2050.
          </div>
          <p className="text-white/70 max-w-md leading-relaxed text-sm">
            The national MRV layer for date-palm residue — turning what thousands of farms
            burn or dump into measured, verifiable climate contribution.
          </p>

          {/* Live headline stat */}
          {esg && esg.totalWasteTons > 0 && (
            <div className="mt-7 inline-flex items-baseline gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
              <span className="text-3xl font-semibold tabular-nums">
                <CountUp value={esg.divertedTons} decimals={0} />
              </span>
              <span className="text-sm text-white/80">
                tons diverted this year · <CountUp value={esg.estAvoidedTCO2e} decimals={1} /> tCO₂e avoided
              </span>
              <IndicativeChip tone="dark" />
            </div>
          )}

          {/* Mandate badge row */}
          <div className="mt-6">
            <MandateBadges tone="dark" />
          </div>
        </div>

        {/* Measure · Verify · Contribute tiles */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { ar: 'نقيس', en: 'Measure', d: 'Farm-level residue, reported quarterly' },
            { ar: 'نُدقق', en: 'Verify', d: 'Validated, approved, audit-trailed' },
            { ar: 'نُسهم', en: 'Contribute', d: 'Rolled up to Net Zero 2050' },
          ].map((tile) => (
            <div key={tile.en} className="rounded-xl border border-white/15 bg-white/5 p-3">
              <div className="text-base font-medium" dir="rtl" lang="ar">{tile.ar}</div>
              <div className="text-xs font-semibold text-gold-300 mt-0.5">{tile.en}</div>
              <div className="mt-1 text-[11px] leading-snug text-white/60">{tile.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side — sign-in form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 flex justify-center">
            <Logo variant="dark" width={180} priority />
          </div>
          {/* Mobile-only condensed hero */}
          <div className="md:hidden mb-6 text-center">
            <div className="text-xl font-semibold font-serif text-brand-800" dir="rtl" lang="ar">
              من النخلة إلى بيانات مناخية موثوقة
            </div>
            <div className="mt-1 text-xs text-muted">Measure · Verify · Net Zero 2050</div>
          </div>

          <h1 className="text-2xl font-semibold text-brand mb-1 tracking-tight">
            Sign in <span className="font-normal text-muted text-lg" dir="rtl" lang="ar">تسجيل الدخول</span>
          </h1>
          <p className="text-sm text-muted mb-8">
            Partners and network officials use the same credentials — the network knows who you are.
          </p>

          <form action={authenticate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand mb-1.5 uppercase tracking-wide">
                Email <span className="normal-case text-muted" dir="rtl" lang="ar">البريد الإلكتروني</span>
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.ae"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-line rounded-md text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-lime/20 bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand mb-1.5 uppercase tracking-wide">
                Password <span className="normal-case text-muted" dir="rtl" lang="ar">كلمة المرور</span>
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 border border-line rounded-md text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-lime/20 bg-white transition-colors"
              />
            </div>

            {errorParam && (
              <div className="text-sm text-brand-700 bg-lime/15 border border-lime/30 px-3 py-2 rounded-md">
                Invalid email or password. <span dir="rtl" lang="ar">البريد أو كلمة المرور غير صحيحة.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-md text-white text-sm font-medium transition-all hover:shadow-card-hover"
              style={{ background: '#124E57' }}
            >
              Sign in · دخول
            </button>
          </form>

          {/* UAE PASS — visual placeholder (integration pending) */}
          <button
            type="button"
            disabled
            title="UAE PASS sign-in — coming soon"
            className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-md border border-line bg-white py-2.5 text-sm font-semibold text-ink/90 transition-colors hover:border-brand-300 disabled:cursor-not-allowed"
          >
            <FingerprintIcon />
            <span>Login with <span className="font-bold">UAE PASS</span></span>
            <span className="rounded bg-gold-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold-700">Soon</span>
          </button>

          <p className="mt-10 text-xs text-muted text-center">
            Access by invitation only.{' '}
            <span className="text-brand/70">Contact your administrator if you need credentials.</span>
          </p>
          <p className="mt-3 text-center text-[11px] text-muted/70">
            Indicative figures are estimates from measured tonnage — not carbon credits.
          </p>
        </div>
      </div>
    </main>
  );
}

/** UAE PASS-style fingerprint mark (teal/red arcs, like the official logo). */
function FingerprintIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M10 4.8a12 12 0 0 1 12 0" stroke="#0B6E4F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6.5 9.5a12 12 0 0 0-2 6.5c0 2 .4 4 1.2 5.8" stroke="#0B6E4F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M25.5 9.5a12 12 0 0 1 2 6.5c0 1.6-.26 3.2-.75 4.6" stroke="#0B6E4F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 10.8a6.5 6.5 0 0 1 10 0" stroke="#0B6E4F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 15.5v2.8c0 2.7 1.4 5.4 3.6 6.9" stroke="#0B6E4F" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21 15.5v1.9c0 3.6-2 6.9-5.1 8.6" stroke="#C8102E" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
