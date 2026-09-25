import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { slug: true, name: true } },
      phase: { select: { name: true, ordering: true } },
      ownerAgent: { select: { slug: true, name: true } },
      authorAgent: { select: { slug: true, name: true } },
      author: { select: { name: true, email: true } },
      assignee: { select: { name: true, email: true } },
    },
  });
  if (!task) notFound();

  // Build the activity timeline — merge TaskComment + AuditLog entries for this task
  const [comments, auditEntries] = await Promise.all([
    prisma.taskComment.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: 'asc' },
      include: {
        authorUser: { select: { name: true } },
        authorAgent: { select: { slug: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: 'Task', entityId: task.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true } },
        agent: { select: { slug: true, name: true } },
      },
    }),
  ]);

  // Merge into a single timeline
  type TimelineItem = {
    at: Date;
    kind: 'comment' | 'audit';
    icon: string;
    actor: string;
    body: string;
  };

  const timeline: TimelineItem[] = [
    ...comments.map((c) => ({
      at: c.createdAt,
      kind: 'comment' as const,
      icon: c.kind === 'status_change' ? '↻' : '💬',
      actor: c.authorAgent ? `${c.authorAgent.slug}` : c.authorUser?.name ?? 'system',
      body: c.body,
    })),
    ...auditEntries.map((a) => ({
      at: a.createdAt,
      kind: 'audit' as const,
      icon: actionIcon(a.action),
      actor: a.agent?.slug ?? a.user?.name ?? 'system',
      body: a.summary ?? a.action,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div className="max-w-3xl">
      <Link href="/tasks" className="text-sm text-terra-600 underline mb-2 inline-block">← Back to tasks</Link>

      <div className="bg-white border border-forest-100 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <PriorityChip p={task.priority} />
              <StatusChip s={task.status} />
              {task.project && (
                <Link href={`/projects/${task.project.slug}`} className="text-xs text-forest-500 hover:underline">
                  {task.project.name}
                </Link>
              )}
              {task.phase && (
                <span className="text-xs text-forest-400">· Phase {task.phase.ordering}: {task.phase.name}</span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-forest mb-1">{task.title}</h1>
            {task.description && (
              <p className="text-sm text-forest-700 whitespace-pre-wrap mt-2">{task.description}</p>
            )}
          </div>
          {task.ownerAgent && task.status !== 'DONE' && task.status !== 'CANCELLED' && (
            <Link
              href={`/agents/${task.ownerAgent.slug}/chat?taskId=${task.id}`}
              className="px-4 py-2 rounded text-white text-sm font-medium whitespace-nowrap flex-shrink-0"
              style={{ background: '#004923' }}
              title={`Open chat with ${task.ownerAgent.slug} to update this task`}
            >
              Continue in chat ↗
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-4 border-t border-forest-100">
          <MetaItem label="Owner agent" value={task.ownerAgent?.slug ?? '—'} mono />
          <MetaItem label="Assignee" value={task.assignee?.name ?? '—'} />
          <MetaItem label="Due" value={fmtDate(task.dueDate)} />
          <MetaItem label="Created by" value={task.authorAgent?.slug ?? task.author?.name ?? '—'} />
          <MetaItem label="Created" value={fmtDate(task.createdAt)} />
          <MetaItem label="Last activity" value={fmtDate(task.lastActivityAt)} />
          {task.completedAt && <MetaItem label="Completed" value={fmtDate(task.completedAt)} />}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-forest uppercase tracking-wide mb-3">
          Progress timeline ({timeline.length})
        </h2>
        {timeline.length === 0 ? (
          <div className="bg-white border border-forest-100 rounded-lg p-8 text-center text-forest-400 text-sm">
            No activity yet. As the task evolves, status changes and comments will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-3 bg-white border border-forest-100 rounded-lg p-4">
                <div className="text-xl">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-xs text-forest-400 mb-1">
                    <span className="font-mono">{item.actor}</span>
                    <span> · </span>
                    <span>{item.at.toISOString().replace('T', ' ').slice(0, 16)}</span>
                  </div>
                  <div className="text-sm text-forest-700 whitespace-pre-wrap">{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-forest-400 mt-3">
          Comment composer + manual status changes ship next session. For now, ask the owner agent to update status via chat.
        </p>
      </section>
    </div>
  );
}

function actionIcon(action: string): string {
  if (action.includes('create')) return '✚';
  if (action.includes('update') || action.includes('status')) return '↻';
  if (action.includes('delete') || action.includes('cancel')) return '✖';
  if (action.includes('consult')) return '↪';
  if (action.includes('message')) return '💬';
  return '•';
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-forest-400 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-forest-700 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
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
