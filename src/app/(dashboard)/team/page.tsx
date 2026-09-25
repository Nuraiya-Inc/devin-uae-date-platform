import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import { fmtDate } from '@/lib/utils';
import { userAvatar, userAvatarUrl } from '@/lib/avatar';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const canManage = hasAtLeast(session.user.role, 'MD');

  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    include: {
      reportsToAgent: { select: { slug: true, name: true } },
    },
  });

  const active = users.filter((u) => u.isActive);
  const inactive = users.filter((u) => !u.isActive);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-forest mb-1">Team</h1>
          <p className="text-sm text-forest-500">
            People who can sign in to the platform. Reporting line + agent ACL controls what they see.
          </p>
        </div>
        {canManage && (
          <Link
            href="/team/new"
            className="px-4 py-2 rounded text-white text-sm font-medium"
            style={{ background: '#0F2E2E' }}
          >
            + Add member
          </Link>
        )}
      </div>

      {!canManage && (
        <div className="mb-4 p-3 bg-amber/10 border border-amber/30 rounded text-xs text-forest-700">
          You can view team members but only CEO and MD-tier users can add or edit them.
        </div>
      )}

      <h2 className="text-xs font-semibold text-forest uppercase tracking-wide mb-2">
        Active ({active.length})
      </h2>
      <UserTable users={active} canManage={canManage} />

      {inactive.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-forest uppercase tracking-wide mb-2 mt-8">
            Deactivated ({inactive.length})
          </h2>
          <UserTable users={inactive} canManage={canManage} dimmed />
        </>
      )}
    </div>
  );
}

interface UserTableUser {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: string;
  entity: string;
  avatarUrl: string | null;
  reportsToAgent: { slug: string; name: string } | null;
  canAccessAllAgents: boolean;
  extraAgentIds: string[];
  lastLoginAt: Date | null;
  isActive: boolean;
}

function UserTable({ users, canManage, dimmed }: { users: UserTableUser[]; canManage: boolean; dimmed?: boolean }) {
  if (users.length === 0) {
    return <div className="bg-white rounded-lg border border-forest-100 p-8 text-center text-forest-400 text-sm">None.</div>;
  }
  return (
    <div className={`bg-white rounded-lg border border-forest-100 overflow-hidden ${dimmed ? 'opacity-60' : ''}`}>
      <table className="w-full text-sm">
        <thead className="bg-forest-50 text-forest-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Role</th>
            <th className="text-left px-4 py-2 font-medium">Entity</th>
            <th className="text-left px-4 py-2 font-medium">Reports to</th>
            <th className="text-left px-4 py-2 font-medium">Agent access</th>
            <th className="text-left px-4 py-2 font-medium">Last login</th>
            {canManage && <th className="px-4 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-forest-100 hover:bg-cream/50">
              <td className="px-4 py-2">
                <UserCell user={u} />
              </td>
              <td className="px-4 py-2">
                <RoleChip role={u.role} />
              </td>
              <td className="px-4 py-2 text-xs font-mono text-forest-500">{u.entity}</td>
              <td className="px-4 py-2 text-xs">
                {u.reportsToAgent ? (
                  <span className="font-mono text-forest-600">{u.reportsToAgent.slug}</span>
                ) : (
                  <span className="text-forest-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs">
                {u.canAccessAllAgents ? (
                  <span className="text-amber-700">all agents</span>
                ) : (
                  <span className="text-forest-500">
                    {u.extraAgentIds.length > 0 ? `${u.extraAgentIds.length} extra` : 'reporting line only'}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-xs text-forest-500">
                {u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'never'}
              </td>
              {canManage && (
                <td className="px-4 py-2 text-right">
                  <Link href={`/team/${u.id}`} className="text-xs text-terra-600 hover:underline">
                    Edit
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserCell({ user: u }: { user: { name: string; email: string; title: string | null; avatarUrl: string | null } }) {
  const photo = userAvatarUrl(u);
  const av = userAvatar({ name: u.name, email: u.email });
  return (
    <div className="flex items-center gap-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={u.name}
          className="w-9 h-9 rounded-full border border-line bg-cream flex-shrink-0 object-cover"
        />
      ) : (
        <span
          className="w-9 h-9 rounded-full inline-flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
          style={{ background: av.color, letterSpacing: '-0.02em' }}
          aria-label={u.name}
        >
          {av.initials}
        </span>
      )}
      <div className="min-w-0">
        <div className="font-medium text-brand truncate">{u.name}</div>
        <div className="text-xs text-muted truncate">{u.email}</div>
        {u.title && <div className="text-xs text-muted mt-0.5 truncate">{u.title}</div>}
      </div>
    </div>
  );
}

function RoleChip({ role }: { role: string }) {
  const colors: Record<string, string> = {
    CEO: 'bg-forest text-white',
    MD: 'bg-amber text-white',
    AGENT_OWNER: 'bg-forest-100 text-forest-700',
    TEAM_MEMBER: 'bg-forest-50 text-forest-600',
    CONTRACTOR: 'bg-cream text-forest-500',
    VIEWER: 'bg-forest-50 text-forest-400',
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${colors[role] ?? 'bg-forest-50'}`}>{role}</span>;
}
