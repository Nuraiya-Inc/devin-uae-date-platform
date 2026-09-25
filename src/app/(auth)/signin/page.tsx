import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import Logo from '@/components/brand/Logo';

/**
 * Sign-in page.
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
      {/* Left side — brand panel */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-2/5 flex-col justify-between p-12 text-white"
        style={{ background: 'linear-gradient(150deg, #07272D 0%, #0C3B43 45%, #124E57 100%)' }}
      >
        <div>
          <Logo variant="light" width={200} priority />
        </div>
        <div>
          <div className="text-4xl font-semibold leading-tight mb-2 tracking-tight">
            The national home of<br />the date palm economy
          </div>
          <div className="text-xl text-white/90 mb-4" dir="rtl" lang="ar">
            شبكة نخيل الإمارات
          </div>
          <p className="text-white/75 max-w-md leading-relaxed">
            One membership. One report a quarter. Certification, benchmarks, and recognition for every farm,
            factory, and recycler building the Emirates&apos; food-security map.
          </p>
        </div>
        <div className="text-xs text-white/50">
          UAE Palm Network · United Arab Emirates
        </div>
      </div>

      {/* Right side — sign-in form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 flex justify-center">
            <Logo variant="dark" width={180} priority />
          </div>
          <h1 className="text-2xl font-semibold text-brand mb-1 tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted mb-8">Sign in to the UAE Palm Network.</p>

          <form action={authenticate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="you@safabioworks.com"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-line rounded-md text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-lime/20 bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-brand mb-1.5 uppercase tracking-wide">
                Password
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
                Invalid email or password.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-md text-white text-sm font-medium transition-all hover:shadow-card-hover"
              style={{ background: '#004923' }}
            >
              Sign in
            </button>
          </form>

          <p className="mt-10 text-xs text-muted text-center">
            Access by invitation only.{' '}
            <span className="text-brand/70">Contact your administrator if you need credentials.</span>
          </p>
        </div>
      </div>
    </main>
  );
}
