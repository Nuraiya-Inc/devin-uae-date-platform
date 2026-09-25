/**
 * /account — the signed-in user's account page.
 *
 * Currently a single section: change your password. As we add more
 * self-serve settings (notification prefs, language, etc.) they'll
 * slot in below.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ChangePasswordForm from './ChangePasswordForm';
import SignOutButton from '@/components/SignOutButton';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      reviewerForBranches: true,
      lastLoginAt: true,
    },
  });
  if (!user) redirect('/signin');

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand tracking-tight mb-1">Account</h1>
        <p className="text-sm text-muted">
          Your profile and security settings.
        </p>
      </div>

      <section className="bg-white border border-line rounded-xl p-5 mb-6 shadow-card">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Profile
        </h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd className="text-ink">{user.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="text-ink font-mono text-xs">{user.email}</dd>
          {user.title && (
            <>
              <dt className="text-muted">Title</dt>
              <dd className="text-ink">{user.title}</dd>
            </>
          )}
          <dt className="text-muted">Role</dt>
          <dd className="text-ink">{user.role}</dd>
          {user.reviewerForBranches.length > 0 && (
            <>
              <dt className="text-muted">Reviewer for</dt>
              <dd className="text-ink">
                {user.reviewerForBranches.map((b) => b.toLowerCase()).join(', ')}
              </dd>
            </>
          )}
          {user.lastLoginAt && (
            <>
              <dt className="text-muted">Last sign-in</dt>
              <dd className="text-ink text-xs">
                {new Date(user.lastLoginAt).toLocaleString()}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="bg-white border border-line rounded-xl p-5 shadow-card">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Change password
        </h2>
        <p className="text-xs text-muted mb-4">
          Use at least 8 characters. Pick something you don&apos;t reuse on other
          sites — a password manager helps.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="bg-white border border-line rounded-xl p-5 mt-6 shadow-card">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Session
        </h2>
        <SignOutButton variant="block" />
      </section>
    </div>
  );
}
