import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';

export const dynamic = 'force-dynamic';

const VALID_ACTORS = ['all', 'agents', 'users'] as const;
type ActorFilter = (typeof VALID_ACTORS)[number];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!isExec(session.user.role)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-forest mb-2">Access restricted</h1>
        <p className="text-sm text-forest-600">
          The activity log is visible to CEO and MD-tier users only.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const actor: ActorFilter = VALID_ACTORS.includes(sp.actor as ActorFilter) ? (sp.actor as ActorFilter) : 'all';
  const actionFilter = sp.action ?? '';

  const where: Record<string, unknown> = {};
  if (actor === 'agents') where.agentId = { not: null };
  else if (actor === 'users') where.userId = { not: null };
  if (actionFilter) where.action = { contains: actionFilter };

  // Pull summary counts (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [entries, totalCount, sevenDayCounts, topAgents] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { name: true } },
        agent: { select: { slug: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { action: true },
    }),
    prisma.auditLog.groupBy({
      by: ['agentId'],
      where: { createdAt: { gte: sevenDaysAgo }, agentId: { not: null } },
      _count: { agentId: true },
      orderBy: { _count: { agentId: 'desc' } },
      take: 5,
    }),
  ]);

  // Resolve top agents
  const topAgentIds = topAgents.map((a) => a.agentId!).filter(Boolean);
  const agentMap = new Map<string, { slug: string; name: string }>();
  if (topAgentIds.length > 0) {
    const agentRows = await prisma.agent.findMany({
      where: { id: { in: topAgentIds } },
      select: { id: true, slug: true, name: true },
    });
    for (const a of agentRows) agentMap.set(a.id, { slug: a.slug, name: a.name });
  }

  const countByAction = new Map(sevenDayCounts.map((c) => [c.action, c._count.action]));
  const messagesThisWeek = countByAction.get('agent.message') ?? 0;
  const tasksCreated = countByAction.get('task.create') ?? 0;
  const raidLogged = countByAction.get('raid.create') ?? 0;
  const userActions = (countByAction.get('user.create') ?? 0) + (countByAction.get('user.update') ?? 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">Activity</h1>
      <p className="text-sm text-forest-500 mb-6">
        Platform-wide audit log. Every meaningful action — chat, task, RAID, user mgmt — lives here.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Agent messages" value={messagesThisWeek} hint="last 7 days" />
        <StatCard label="Tasks created" value={tasksCreated} hint="last 7 days" />
        <StatCard label="RAID logged" value={raidLogged} hint="last 7 days" />
        <StatCard label="Team changes" value={userActions} hint="last 7 days" />
      </div>

      {topAgents.length > 0 && (
        <div className="bg-white border border-forest-100 rounded-lg p-4 mb-6">
          <div className="text-xs uppercase tracking-wide text-forest-500 mb-2">Most active agents (7d)</div>
          <div className="space-y-1">
            {topAgents.map((a) => {
              const meta = agentMap.get(a.agentId!);
              return (
                <div key={a.agentId} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-forest-500 w-20">{meta?.slug ?? '—'}</span>
                  <span className="text-forest-700 flex-1">{meta?.name ?? '—'}</span>
                  <span className="text-xs text-forest-500">{a._count.agentId} actions</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 text-xs">
        <span className="text-forest-500 self-center">Actor:</span>
        <FilterLink label="All" param="actor" value="" current={actor} />
        <FilterLink label="Agents" param="actor" value="agents" current={actor} />
        <FilterLink label="Users" param="actor" value="users" current={actor} />
      </div>

      <div className="bg-white border border-forest-100 rounded-lg divide-y divide-forest-100">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-forest-400 text-sm">No activity matches these filters yet.</div>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="px-4 py-2 flex items-center gap-3 text-sm">
              <div className="text-xs text-forest-400 font-mono w-36 flex-shrink-0">
                {e.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
              </div>
              <div className="text-xs font-mono text-forest-600 w-24 truncate flex-shrink-0">
                {e.agent?.slug ?? e.user?.name ?? 'system'}
              </div>
              <div className="text-xs text-forest-400 font-mono w-28 truncate flex-shrink-0">
                {e.action}
              </div>
              <div className="text-forest-700 flex-1">{e.summary ?? e.action}</div>
              {e.entityType && e.entityId && (
                <EntityLink type={e.entityType} id={e.entityId} />
              )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-forest-400 mt-3">
        Showing {entries.length} of {totalCount}. Pagination + charts ship next session.
      </p>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-white border border-forest-100 rounded-lg p-3">
      <div className="text-xs text-forest-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-forest mt-1">{value}</div>
      <div className="text-xs text-forest-500 mt-0.5">{hint}</div>
    </div>
  );
}

function FilterLink({ label, param, value, current }: { label: string; param: string; value: string; current: string }) {
  const active = (current === value) || (value === '' && current === 'all');
  const href = value ? `/activity?${param}=${encodeURIComponent(value)}` : '/activity';
  return (
    <a
      href={href}
      className={`px-2 py-1 rounded ${active ? 'bg-forest text-white' : 'bg-cream text-forest-600 hover:bg-forest-100'}`}
    >
      {label}
    </a>
  );
}

function EntityLink({ type, id }: { type: string; id: string }) {
  let href = '';
  if (type === 'Task') href = `/tasks/${id}`;
  else if (type === 'User') href = `/team/${id}`;
  // RAID and Agent — no detail page yet
  if (!href) return null;
  return (
    <Link href={href} className="text-[10px] text-terra-600 hover:underline flex-shrink-0">
      view →
    </Link>
  );
}
