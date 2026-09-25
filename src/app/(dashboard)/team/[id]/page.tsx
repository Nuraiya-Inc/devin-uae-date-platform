import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import { fmtDate } from '@/lib/utils';
import EditUserForm from '../EditUserForm';
import UserAdminActions from '../UserAdminActions';

export const dynamic = 'force-dynamic';

export default async function TeamMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!hasAtLeast(session.user.role, 'MD')) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-forest mb-2">Access restricted</h1>
        <p className="text-sm text-forest-600">Only CEO and MD-tier users can manage team members.</p>
        <Link href="/team" className="text-sm text-terra-600 underline mt-4 inline-block">← Back to team</Link>
      </div>
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const wasCreated = sp.created === '1';

  const user = await prisma.user.findUnique({
    where: { id },
    include: { reportsToAgent: true },
  });
  if (!user) notFound();

  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    orderBy: [{ tier: 'asc' }, { branch: 'asc' }, { slug: 'asc' }],
    select: { id: true, slug: true, name: true, tier: true, branch: true },
  });

  const isSelf = session.user.id === user.id;

  return (
    <div className="max-w-2xl">
      <Link href="/team" className="text-sm text-terra-600 underline mb-2 inline-block">← Back to team</Link>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-forest">{user.name}</h1>
        <span className={`text-xs px-2 py-1 rounded ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-forest-100 text-forest-500'}`}>
          {user.isActive ? 'Active' : 'Deactivated'}
        </span>
      </div>
      <p className="text-sm text-forest-500 mb-1">{user.email}</p>
      {user.title && <p className="text-xs text-forest-400 mb-4">{user.title}</p>}
      <p className="text-xs text-forest-400 mb-6">
        Created: {fmtDate(user.createdAt)} · Last login: {user.lastLoginAt ? fmtDate(user.lastLoginAt) : 'never'}
      </p>

      {wasCreated && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
          ✓ Team member created. Share their initial password securely.
        </div>
      )}

      <h2 className="text-sm font-semibold text-forest uppercase tracking-wide mb-3">Profile</h2>
      <EditUserForm
        userId={user.id}
        agents={agents}
        initial={{
          name: user.name,
          email: user.email,
          title: user.title ?? '',
          role: user.role,
          entity: user.entity,
          reportsToAgentId: user.reportsToAgentId ?? '',
          canAccessAllAgents: user.canAccessAllAgents,
          canAccessAllEntities: user.canAccessAllEntities,
          extraAgentIds: user.extraAgentIds,
        }}
      />

      <div className="mt-8 pt-6 border-t border-forest-100">
        <h2 className="text-sm font-semibold text-forest uppercase tracking-wide mb-3">Admin actions</h2>
        <UserAdminActions
          userId={user.id}
          userName={user.name}
          isActive={user.isActive}
          isSelf={isSelf}
          isCEO={user.role === 'CEO'}
        />
      </div>
    </div>
  );
}
