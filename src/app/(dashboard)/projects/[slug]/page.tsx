import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/utils';
import type { Task, AgentBranch, Phase, Milestone, RaidEntry } from '@prisma/client';

export const dynamic = 'force-dynamic';

const BRANCH_LABEL: Record<string, string> = {
  EXECUTIVE: 'Executive',
  FINANCE: 'Finance',
  TECHNOLOGY: 'Technology',
  COMMERCIAL: 'Commercial',
  MARKETING: 'Marketing & Comms',
  OPERATIONS: 'Operations',
};

const BRANCH_ORDER: AgentBranch[] = ['EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS'];

const VALID_TABS = ['programme', 'workstreams', 'raid', 'activity'] as const;
type Tab = (typeof VALID_TABS)[number];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab: Tab = VALID_TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'programme';

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      ownerAgent: { select: { slug: true, name: true } },
      phases: { orderBy: { ordering: 'asc' } },
    },
  });
  if (!project) notFound();

  return (
    <div className="max-w-5xl">
      <Link href="/projects" className="text-sm text-terra-600 underline mb-2 inline-block">← Back to projects</Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-2xl font-semibold text-forest">{project.name}</h1>
          <StatusChip s={project.status} />
        </div>
        {project.description && <p className="text-sm text-forest-600 max-w-3xl">{project.description}</p>}
        <div className="flex gap-4 mt-3 text-xs text-forest-400">
          <span>Entity: <span className="text-forest-700 font-mono">{project.entity}</span></span>
          {project.budget && <span>Budget: {project.currency} {Number(project.budget).toLocaleString()}</span>}
          {project.ownerAgent && <span>Owner: <span className="font-mono text-forest-700">{project.ownerAgent.slug}</span></span>}
          {project.startDate && project.targetEndDate && (
            <span>Timeline: {fmtDate(project.startDate)} → {fmtDate(project.targetEndDate)}</span>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="border-b border-forest-100 mb-6 flex gap-1">
        {VALID_TABS.map((t) => (
          <TabLink key={t} slug={slug} value={t} current={tab} />
        ))}
      </div>

      {tab === 'programme' && <ProgrammeTab projectId={project.id} phases={project.phases} />}
      {tab === 'workstreams' && <WorkstreamsTab projectId={project.id} />}
      {tab === 'raid' && <RaidTab projectId={project.id} />}
      {tab === 'activity' && <ActivityTab projectId={project.id} />}
    </div>
  );
}

function TabLink({ slug, value, current }: { slug: string; value: Tab; current: Tab }) {
  const label = value.charAt(0).toUpperCase() + value.slice(1);
  const active = current === value;
  return (
    <Link
      href={`/projects/${slug}?tab=${value}`}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-amber text-forest' : 'border-transparent text-forest-500 hover:text-forest-700'
      }`}
    >
      {label}
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────
// Programme tab — phases with their tasks + milestones
// ──────────────────────────────────────────────────────────────

async function ProgrammeTab({ projectId, phases }: { projectId: string; phases: Phase[] }) {
  const [tasks, milestones] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      orderBy: [{ priority: 'asc' }, { lastActivityAt: 'desc' }],
      include: { ownerAgent: { select: { slug: true } }, assignee: { select: { name: true } } },
    }),
    prisma.milestone.findMany({ where: { projectId }, orderBy: { dueDate: 'asc' } }),
  ]);

  const tasksByPhase = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const k = t.phaseId ?? null;
    if (!tasksByPhase.has(k)) tasksByPhase.set(k, []);
    tasksByPhase.get(k)!.push(t);
  }
  const milestonesByPhase = new Map<string | null, Milestone[]>();
  for (const m of milestones) {
    const k = m.phaseId ?? null;
    if (!milestonesByPhase.has(k)) milestonesByPhase.set(k, []);
    milestonesByPhase.get(k)!.push(m);
  }

  return (
    <div className="space-y-4">
      {phases.map((p) => {
        const phaseTasks = tasksByPhase.get(p.id) ?? [];
        const phaseMilestones = milestonesByPhase.get(p.id) ?? [];
        return (
          <div key={p.id} className="bg-white border border-forest-100 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-forest-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-forest-400">Phase {p.ordering}</div>
                <div className="font-medium text-forest">{p.name}</div>
              </div>
              <div className="text-xs text-forest-400 text-right">
                <RagPill rag={p.ragStatus} />
                {p.startDate && p.endDate && (
                  <div className="mt-1">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</div>
                )}
              </div>
            </div>

            {phaseMilestones.length > 0 && (
              <div className="px-4 py-2 bg-cream/40 border-b border-forest-100">
                <div className="text-xs uppercase tracking-wide text-forest-500 mb-1">Milestones ({phaseMilestones.length})</div>
                {phaseMilestones.map((m) => (
                  <div key={m.id} className="text-xs text-forest-700 flex items-center gap-2">
                    {m.isHit ? '✓' : '○'} {m.name} <span className="text-forest-400">· due {fmtDate(m.dueDate)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="divide-y divide-forest-100">
              {phaseTasks.length === 0 ? (
                <div className="px-4 py-3 text-xs text-forest-400">No tasks in this phase yet.</div>
              ) : (
                phaseTasks.map((t) => <TaskRow key={t.id} task={t} />)
              )}
            </div>
          </div>
        );
      })}

      {/* Tasks without a phase */}
      {(tasksByPhase.get(null) ?? []).length > 0 && (
        <div className="bg-white border border-forest-100 rounded-lg">
          <div className="px-4 py-3 border-b border-forest-100 text-xs uppercase tracking-wide text-forest-500">
            Unphased tasks ({(tasksByPhase.get(null) ?? []).length})
          </div>
          <div className="divide-y divide-forest-100">
            {(tasksByPhase.get(null) ?? []).map((t) => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Workstreams tab — tasks grouped by owning agent's branch
// ──────────────────────────────────────────────────────────────

async function WorkstreamsTab({ projectId }: { projectId: string }) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ priority: 'asc' }, { lastActivityAt: 'desc' }],
    include: {
      ownerAgent: { select: { slug: true, branch: true } },
      assignee: { select: { name: true } },
    },
  });

  // Group by branch
  const byBranch = new Map<AgentBranch | 'UNASSIGNED', typeof tasks>();
  for (const t of tasks) {
    const k = t.ownerAgent?.branch ?? ('UNASSIGNED' as const);
    if (!byBranch.has(k)) byBranch.set(k, []);
    byBranch.get(k)!.push(t);
  }

  return (
    <div className="space-y-4">
      {BRANCH_ORDER.map((branch) => {
        const list = byBranch.get(branch);
        if (!list || list.length === 0) return null;
        return (
          <div key={branch} className="bg-white border border-forest-100 rounded-lg">
            <div className="px-4 py-3 border-b border-forest-100">
              <div className="text-xs uppercase tracking-wide text-forest-500">
                {BRANCH_LABEL[branch]} workstream
              </div>
              <div className="text-sm font-medium text-forest">{list.length} task{list.length === 1 ? '' : 's'}</div>
            </div>
            <div className="divide-y divide-forest-100">
              {list.map((t) => <TaskRow key={t.id} task={t} showOwner />)}
            </div>
          </div>
        );
      })}
      {byBranch.get('UNASSIGNED') && (
        <div className="bg-white border border-forest-100 rounded-lg">
          <div className="px-4 py-3 border-b border-forest-100 text-xs uppercase tracking-wide text-forest-500">
            Unassigned ({byBranch.get('UNASSIGNED')!.length})
          </div>
          <div className="divide-y divide-forest-100">
            {byBranch.get('UNASSIGNED')!.map((t) => <TaskRow key={t.id} task={t} showOwner />)}
          </div>
        </div>
      )}
      {tasks.length === 0 && (
        <div className="bg-white border border-forest-100 rounded-lg p-8 text-center text-forest-400 text-sm">
          No tasks yet on this project.
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// RAID tab
// ──────────────────────────────────────────────────────────────

async function RaidTab({ projectId }: { projectId: string }) {
  const entries = await prisma.raidEntry.findMany({
    where: { projectId },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    include: { ownerAgent: { select: { slug: true } } },
  });

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-forest-100 rounded-lg p-8 text-center text-forest-400 text-sm">
        No RAID entries on this project yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((r) => (
        <div key={r.id} className="bg-white border border-forest-100 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <KindChip k={r.kind} />
            <SeverityChip s={r.severity} />
            <RaidStatusChip s={r.status} />
            <span className="ml-auto text-xs text-forest-400 font-mono">owner: {r.ownerAgent?.slug ?? '—'}</span>
          </div>
          <h3 className="font-medium text-forest mb-1">{r.title}</h3>
          {r.description && <p className="text-sm text-forest-600 mb-2">{r.description}</p>}
          {r.mitigation && (
            <div className="text-xs bg-cream/60 border border-amber/30 rounded p-2 mt-2">
              <span className="text-amber-700 font-semibold">Mitigation:</span>{' '}
              <span className="text-forest-700">{r.mitigation}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Activity tab — audit log entries for this project's tasks + RAID
// ──────────────────────────────────────────────────────────────

async function ActivityTab({ projectId }: { projectId: string }) {
  // Get all task + RAID ids for this project, then audit entries on them
  const [tasks, raid] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, select: { id: true } }),
    prisma.raidEntry.findMany({ where: { projectId }, select: { id: true } }),
  ]);
  const entityIds = [...tasks.map((t) => t.id), ...raid.map((r) => r.id)];

  if (entityIds.length === 0) {
    return (
      <div className="bg-white border border-forest-100 rounded-lg p-8 text-center text-forest-400 text-sm">
        No tracked entities on this project yet. Activity will surface once agents create tasks or log RAID.
      </div>
    );
  }

  const entries = await prisma.auditLog.findMany({
    where: { entityId: { in: entityIds } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true } },
      agent: { select: { slug: true } },
    },
  });

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-forest-100 rounded-lg p-8 text-center text-forest-400 text-sm">
        No activity logged yet.
      </div>
    );
  }

  return (
    <div className="bg-white border border-forest-100 rounded-lg divide-y divide-forest-100">
      {entries.map((e) => (
        <div key={e.id} className="px-4 py-2 flex items-center gap-3 text-sm">
          <div className="text-xs text-forest-400 font-mono w-32">
            {e.createdAt.toISOString().replace('T', ' ').slice(0, 16)}
          </div>
          <div className="text-xs font-mono text-forest-600 w-24">
            {e.agent?.slug ?? e.user?.name ?? 'system'}
          </div>
          <div className="text-forest-700 flex-1">{e.summary ?? e.action}</div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Reusable chips and rows
// ──────────────────────────────────────────────────────────────

function TaskRow({ task, showOwner }: { task: Task & { ownerAgent?: { slug: string } | null; assignee?: { name: string } | null }; showOwner?: boolean }) {
  return (
    <Link href={`/tasks/${task.id}`} className="block px-4 py-2 hover:bg-cream/40">
      <div className="flex items-center gap-2 text-sm">
        <PriorityChip p={task.priority} />
        <StatusChip s={task.status} small />
        <span className="text-forest-700 flex-1 truncate">{task.title}</span>
        {showOwner && task.ownerAgent && (
          <span className="text-xs font-mono text-forest-500">{task.ownerAgent.slug}</span>
        )}
        {task.assignee && <span className="text-xs text-forest-500">{task.assignee.name}</span>}
        {task.dueDate && (
          <span className="text-xs text-forest-400">due {fmtDate(task.dueDate)}</span>
        )}
      </div>
    </Link>
  );
}

function PriorityChip({ p }: { p: string }) {
  const colors: Record<string, string> = {
    P0: 'bg-terra text-white',
    P1: 'bg-amber text-white',
    P2: 'bg-forest-100 text-forest-700',
    P3: 'bg-forest-50 text-forest-500',
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${colors[p] ?? colors.P2}`}>{p}</span>;
}

function StatusChip({ s, small }: { s: string; small?: boolean }) {
  const colors: Record<string, string> = {
    PLANNING: 'bg-forest-50 text-forest-600',
    IN_FLIGHT: 'bg-amber/20 text-amber-700',
    AT_RISK: 'bg-terra/20 text-terra-700',
    BLOCKED: 'bg-terra text-white',
    COMPLETE: 'bg-green-100 text-green-800',
    ON_HOLD: 'bg-forest-100 text-forest-500',
    TODO: 'bg-forest-50 text-forest-600',
    IN_PROGRESS: 'bg-amber/20 text-amber-700',
    IN_REVIEW: 'bg-forest-100 text-forest-700',
    DONE: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-forest-50 text-forest-400 line-through',
  };
  const size = small ? 'text-[10px] px-1.5' : 'text-xs px-2';
  return <span className={`${size} py-0.5 rounded ${colors[s] ?? 'bg-forest-50'}`}>{s.replace('_', ' ')}</span>;
}

function RagPill({ rag }: { rag: string }) {
  const colors: Record<string, string> = {
    GREEN: 'bg-green-100 text-green-800',
    AMBER: 'bg-amber/20 text-amber-700',
    RED: 'bg-terra text-white',
    UNSET: 'bg-forest-50 text-forest-400',
  };
  return <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${colors[rag] ?? colors.UNSET}`}>{rag}</span>;
}

function KindChip({ k }: { k: string }) {
  return <span className="text-xs px-2 py-0.5 rounded bg-forest-100 text-forest-700 font-mono">{k}</span>;
}

function SeverityChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-terra text-white',
    HIGH: 'bg-amber text-white',
    MEDIUM: 'bg-forest-100 text-forest-700',
    LOW: 'bg-forest-50 text-forest-500',
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${colors[s] ?? colors.MEDIUM}`}>{s}</span>;
}

function RaidStatusChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    OPEN: 'bg-terra/20 text-terra-700',
    MITIGATING: 'bg-amber/20 text-amber-700',
    CLOSED: 'bg-green-50 text-green-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${colors[s] ?? 'bg-forest-50'}`}>{s}</span>;
}
