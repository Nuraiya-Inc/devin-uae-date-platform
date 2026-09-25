import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status;
  const priorityFilter = sp.priority;

  const where: Record<string, unknown> = {};
  if (statusFilter === 'open') where.status = { notIn: ['DONE', 'CANCELLED'] };
  else if (statusFilter) where.status = statusFilter;
  if (priorityFilter) where.priority = priorityFilter;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { lastActivityAt: 'desc' }],
    include: {
      ownerAgent: { select: { slug: true, name: true } },
      authorAgent: { select: { slug: true } },
      assignee: { select: { name: true, email: true } },
    },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">Tasks</h1>
      <p className="text-sm text-forest-500 mb-6">
        Live workstream — created by you, by agents, or seeded from the platform.
      </p>

      <FilterBar status={statusFilter} priority={priorityFilter} />

      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-forest-100 p-12 text-center text-forest-400 text-sm">
          No tasks match these filters. Chat with an agent and ask them to create one.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-forest-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-forest-50 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Priority</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Title</th>
                <th className="text-left px-4 py-2 font-medium">Owner agent</th>
                <th className="text-left px-4 py-2 font-medium">Assignee</th>
                <th className="text-left px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const isOpen = t.status !== 'DONE' && t.status !== 'CANCELLED';
                return (
                  <tr key={t.id} className="border-t border-forest-100 hover:bg-cream/50">
                    <td className="px-4 py-2"><PriorityChip p={t.priority} /></td>
                    <td className="px-4 py-2"><StatusChip s={t.status} /></td>
                    <td className="px-4 py-2">
                      <Link href={`/tasks/${t.id}`} className="text-forest-700 hover:text-terra-600 hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-forest-500 font-mono text-xs">{t.ownerAgent?.slug ?? '—'}</td>
                    <td className="px-4 py-2 text-forest-500">{t.assignee?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-forest-500 text-xs">{fmtDate(t.dueDate)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {isOpen && t.ownerAgent && (
                        <Link
                          href={`/agents/${t.ownerAgent.slug}/chat?taskId=${t.id}`}
                          className="text-xs text-terra-600 hover:underline"
                          title={`Continue in chat with ${t.ownerAgent.slug}`}
                        >
                          chat ↗
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-forest-400 mt-4">
        Showing up to 200. Detail views ship next session.
      </p>
    </div>
  );
}

function FilterBar({ status, priority }: { status?: string; priority?: string }) {
  return (
    <div className="flex gap-2 mb-4 text-xs">
      <span className="text-forest-500 self-center">Status:</span>
      <FilterLink label="All" param="status" value="" current={status} />
      <FilterLink label="Open" param="status" value="open" current={status} />
      <FilterLink label="In Progress" param="status" value="IN_PROGRESS" current={status} />
      <FilterLink label="Done" param="status" value="DONE" current={status} />
      <span className="text-forest-500 self-center ml-3">Priority:</span>
      <FilterLink label="All" param="priority" value="" current={priority} />
      <FilterLink label="P0" param="priority" value="P0" current={priority} />
      <FilterLink label="P1" param="priority" value="P1" current={priority} />
      <FilterLink label="P2" param="priority" value="P2" current={priority} />
    </div>
  );
}

function FilterLink({ label, param, value, current }: { label: string; param: string; value: string; current?: string }) {
  const active = (current ?? '') === value;
  const href = value ? `/tasks?${param}=${encodeURIComponent(value)}` : '/tasks';
  return (
    <a
      href={href}
      className={`px-2 py-1 rounded ${active ? 'bg-forest text-white' : 'bg-cream text-forest-600 hover:bg-forest-100'}`}
    >
      {label}
    </a>
  );
}

function PriorityChip({ p }: { p: string }) {
  const colors: Record<string, string> = {
    P0: 'bg-terra text-white',
    P1: 'bg-amber text-white',
    P2: 'bg-forest-100 text-forest-700',
    P3: 'bg-forest-50 text-forest-500',
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${colors[p] ?? colors.P2}`}>{p}</span>;
}

function StatusChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    TODO: 'bg-forest-50 text-forest-600',
    IN_PROGRESS: 'bg-amber/20 text-amber-700',
    BLOCKED: 'bg-terra/20 text-terra-700',
    IN_REVIEW: 'bg-forest-100 text-forest-700',
    DONE: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-forest-50 text-forest-400 line-through',
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${colors[s] ?? 'bg-forest-50'}`}>{s.replace('_', ' ')}</span>;
}
