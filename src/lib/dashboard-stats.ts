/**
 * Dashboard stats — data layer for /dashboard.
 *
 * Centralises every Prisma query the dashboard renders, so the page itself
 * stays a thin layout. Bias: surfaces WHAT JUST GOT DONE, not what's pending.
 * Pending work has its own pages (Tasks, RAID, Investors).
 *
 * Stats served:
 *   - thisWeekWins        — counts for the headline strip
 *   - recentWins          — merged stream of recent done events with attribution
 *   - weeklyVelocity      — 8 weeks of completed-task counts (for the SVG bar chart)
 *   - dataRoomProgress    — % complete + breakdown
 *   - topContributors     — agents + humans ranked by recent throughput
 *   - openCounts          — small secondary strip (tasks open, RAID open, etc.)
 */

import { prisma } from './db';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeekUtc(date: Date): Date {
  // Monday as the week boundary, UTC
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

// ─────────────────────────────────────────────────────────────
// This-week win counters
// ─────────────────────────────────────────────────────────────

export async function getThisWeekWins() {
  const sevenDaysAgo = new Date(Date.now() - 7 * ONE_DAY_MS);

  const [tasksDone, raidClosed, documentsAdded, dataRoomShipped] = await Promise.all([
    prisma.task.count({
      where: { status: 'DONE', completedAt: { gte: sevenDaysAgo } },
    }),
    prisma.raidEntry.count({
      where: { status: 'CLOSED', updatedAt: { gte: sevenDaysAgo } },
    }),
    prisma.document.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.dataRoomEntry.count({
      where: { status: 'EXISTS', updatedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return { tasksDone, raidClosed, documentsAdded, dataRoomShipped };
}

// ─────────────────────────────────────────────────────────────
// Recent wins — merged stream
// ─────────────────────────────────────────────────────────────

export type WinKind = 'task' | 'raid' | 'dataroom' | 'document';

export interface WinEntry {
  kind: WinKind;
  title: string;
  /** Short context line under the title — who, what, when. */
  detail: string;
  /** ISO timestamp, used for sorting. */
  at: Date;
  /** Optional href to the source. */
  href?: string;
  /** Display name of the contributor (human or agent). */
  contributor?: string;
}

export async function getRecentWins(limit: number = 12): Promise<WinEntry[]> {
  const [doneTasks, closedRaid, shippedEntries, recentDocs] = await Promise.all([
    prisma.task.findMany({
      where: { status: 'DONE', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        ownerAgent: { select: { slug: true, name: true } },
        assignee: { select: { name: true } },
        project: { select: { slug: true, name: true } },
      },
    }),
    prisma.raidEntry.findMany({
      where: { status: 'CLOSED' },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { ownerAgent: { select: { slug: true, name: true } } },
    }),
    prisma.dataRoomEntry.findMany({
      where: { status: 'EXISTS' },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        addedBy: { select: { name: true } },
        folder: { select: { slug: true, name: true } },
        dataRoom: { select: { slug: true } },
      },
    }),
    prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { uploader: { select: { name: true } } },
    }),
  ]);

  const wins: WinEntry[] = [];

  for (const t of doneTasks) {
    const contributor = t.assignee?.name ?? t.ownerAgent?.name ?? '—';
    wins.push({
      kind: 'task',
      title: t.title,
      detail: `Closed by ${contributor}${t.project ? ` · ${t.project.name}` : ''}`,
      at: t.completedAt!,
      href: `/tasks/${t.id}`,
      contributor,
    });
  }

  for (const r of closedRaid) {
    const contributor = r.ownerAgent?.name ?? '—';
    wins.push({
      kind: 'raid',
      title: `${r.kind === 'RISK' ? 'Risk' : r.kind === 'ISSUE' ? 'Issue' : r.kind === 'ASSUMPTION' ? 'Assumption' : 'Dependency'} closed: ${r.title}`,
      detail: `Retired by ${contributor} · ${r.severity}`,
      at: r.updatedAt,
      href: '/raid',
      contributor,
    });
  }

  for (const d of shippedEntries) {
    const contributor = d.addedBy?.name ?? 'team';
    wins.push({
      kind: 'dataroom',
      title: `Data room ${d.refNumber} · ${d.displayName}`,
      detail: `Shipped by ${contributor} · ${d.folder.name}`,
      at: d.updatedAt,
      href: `/data-room/${d.dataRoom.slug}`,
      contributor,
    });
  }

  for (const doc of recentDocs) {
    const contributor = doc.uploader?.name ?? 'team';
    wins.push({
      kind: 'document',
      title: doc.title,
      detail: `Added by ${contributor}${doc.aiSummary ? ` · ${doc.aiSummary.slice(0, 90)}` : ''}`,
      at: doc.createdAt,
      href: `/documents/${doc.id}`,
      contributor,
    });
  }

  wins.sort((a, b) => b.at.getTime() - a.at.getTime());
  return wins.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// 8-week velocity — bucket completed tasks by ISO week
// ─────────────────────────────────────────────────────────────

export interface VelocityBucket {
  weekStart: Date;
  /** Label like "May 11" or "W19". */
  label: string;
  count: number;
}

export async function getWeeklyVelocity(weeks: number = 8): Promise<VelocityBucket[]> {
  const startBoundary = startOfWeekUtc(new Date(Date.now() - weeks * 7 * ONE_DAY_MS));
  const tasks = await prisma.task.findMany({
    where: { status: 'DONE', completedAt: { gte: startBoundary } },
    select: { completedAt: true },
  });

  // Build the bucket skeleton: N weeks ending with the current week
  const buckets: VelocityBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = startOfWeekUtc(new Date(Date.now() - i * 7 * ONE_DAY_MS));
    buckets.push({
      weekStart: ws,
      label: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      count: 0,
    });
  }

  for (const t of tasks) {
    if (!t.completedAt) continue;
    const ws = startOfWeekUtc(t.completedAt).getTime();
    const idx = buckets.findIndex((b) => b.weekStart.getTime() === ws);
    if (idx >= 0) buckets[idx].count++;
  }

  return buckets;
}

// ─────────────────────────────────────────────────────────────
// Data-room completion meter
// ─────────────────────────────────────────────────────────────

export interface DataRoomProgress {
  totalEntries: number;
  shippedEntries: number;
  inProgressEntries: number;
  pctComplete: number;
  /** Optional: per-folder ribbon (top 5 folders by entry count). */
  folders: Array<{ slug: string; name: string; total: number; shipped: number; pct: number }>;
}

export async function getDataRoomProgress(): Promise<DataRoomProgress> {
  // Default to Series A room if present
  const room = await prisma.dataRoom.findFirst({ where: { slug: 'series-a' } });
  if (!room) {
    return { totalEntries: 0, shippedEntries: 0, inProgressEntries: 0, pctComplete: 0, folders: [] };
  }

  const [total, shipped, inProgress, folders] = await Promise.all([
    prisma.dataRoomEntry.count({ where: { dataRoomId: room.id } }),
    prisma.dataRoomEntry.count({ where: { dataRoomId: room.id, status: 'EXISTS' } }),
    prisma.dataRoomEntry.count({
      where: { dataRoomId: room.id, status: { in: ['IN_PROGRESS', 'VERIFY', 'PARTIAL'] } },
    }),
    prisma.dataRoomFolder.findMany({
      where: { dataRoomId: room.id },
      include: { _count: { select: { entries: true } } },
      orderBy: { id: 'asc' },
    }),
  ]);

  const folderStats = await Promise.all(
    folders.slice(0, 6).map(async (f) => {
      const sh = await prisma.dataRoomEntry.count({
        where: { folderId: f.id, status: 'EXISTS' },
      });
      const tot = f._count.entries;
      return {
        slug: f.slug,
        name: f.name,
        total: tot,
        shipped: sh,
        pct: tot > 0 ? Math.round((sh / tot) * 100) : 0,
      };
    }),
  );

  const pctComplete = total > 0 ? Math.round((shipped / total) * 100) : 0;
  return { totalEntries: total, shippedEntries: shipped, inProgressEntries: inProgress, pctComplete, folders: folderStats };
}

// ─────────────────────────────────────────────────────────────
// Top contributors — last 14 days, humans + agents
// ─────────────────────────────────────────────────────────────

export interface Contributor {
  /** Display name. */
  name: string;
  /** "human" or "agent". */
  kind: 'human' | 'agent';
  /** Optional sub-line (role / agent slug). */
  sub?: string;
  /** Combined throughput score: tasks closed + RAID retired + docs added. */
  score: number;
  /** Breakdown. */
  tasks: number;
  raid: number;
  docs: number;
}

export async function getTopContributors(limit: number = 6): Promise<Contributor[]> {
  const since = new Date(Date.now() - 14 * ONE_DAY_MS);

  const [doneTasks, closedRaid, recentDocs, allAgents, allUsers] = await Promise.all([
    prisma.task.findMany({
      where: { status: 'DONE', completedAt: { gte: since } },
      select: { ownerAgentId: true, assigneeUserId: true },
    }),
    prisma.raidEntry.findMany({
      where: { status: 'CLOSED', updatedAt: { gte: since } },
      select: { ownerAgentId: true },
    }),
    prisma.document.findMany({
      where: { createdAt: { gte: since } },
      select: { uploaderId: true },
    }),
    prisma.agent.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, title: true, tier: true },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true },
    }),
  ]);

  const byKey = new Map<string, Contributor>();
  const agentById = new Map(allAgents.map((a) => [a.id, a]));
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  function bumpAgent(agentId: string | null, field: 'tasks' | 'raid' | 'docs') {
    if (!agentId) return;
    const agent = agentById.get(agentId);
    if (!agent) return;
    const key = `agent:${agentId}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name: agent.name,
        kind: 'agent',
        sub: agent.title,
        score: 0,
        tasks: 0,
        raid: 0,
        docs: 0,
      });
    }
    const c = byKey.get(key)!;
    c[field]++;
    c.score++;
  }
  function bumpUser(userId: string | null, field: 'tasks' | 'raid' | 'docs') {
    if (!userId) return;
    const u = userById.get(userId);
    if (!u) return;
    const key = `user:${userId}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        name: u.name,
        kind: 'human',
        sub: u.role,
        score: 0,
        tasks: 0,
        raid: 0,
        docs: 0,
      });
    }
    const c = byKey.get(key)!;
    c[field]++;
    c.score++;
  }

  for (const t of doneTasks) {
    bumpAgent(t.ownerAgentId, 'tasks');
    bumpUser(t.assigneeUserId, 'tasks');
  }
  for (const r of closedRaid) {
    bumpAgent(r.ownerAgentId, 'raid');
  }
  for (const d of recentDocs) {
    bumpUser(d.uploaderId, 'docs');
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Open counts (kept for the small secondary strip)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Latest morning briefing (if one exists for today)
// ─────────────────────────────────────────────────────────────

export interface TodaysBriefing {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
}

export async function getTodaysBriefing(): Promise<TodaysBriefing | null> {
  const today = new Date();
  const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const doc = await prisma.document.findFirst({
    where: {
      tags: { has: 'morning-briefing' },
      createdAt: { gte: startOfDay },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!doc || !doc.storagePath) return null;

  // Read the briefing text
  try {
    const { readStoredFile } = await import('./storage');
    const buffer = await readStoredFile(doc.storagePath);
    const content = buffer.toString('utf-8');
    return { id: doc.id, title: doc.title, content, createdAt: doc.createdAt };
  } catch {
    return null;
  }
}

export async function getOpenCounts() {
  const [agents, projects, openTasks, openRaid, activeInvestors] = await Promise.all([
    prisma.agent.count({ where: { isActive: true } }),
    prisma.project.count(),
    prisma.task.count({ where: { status: { notIn: ['DONE', 'CANCELLED'] } } }),
    prisma.raidEntry.count({ where: { status: 'OPEN' } }),
    prisma.investor.count({ where: { isActive: true } }),
  ]);
  return { agents, projects, openTasks, openRaid, activeInvestors };
}

// ─────────────────────────────────────────────────────────────
// Celebration triggers — surface moments worth a confetti burst
// ─────────────────────────────────────────────────────────────

/**
 * Reasons to celebrate, derived from the same data the dashboard already
 * shows. Each trigger is null/false when not active. The client component
 * uses these to decide whether to fire a confetti burst and what banner
 * copy to render.
 *
 * Idempotency note: the client de-dupes on (triggerKey + ISO date) via
 * localStorage so the same celebration doesn't fire on every page load.
 */
export interface CelebrationTriggers {
  /** "Best week in the last 8" — total wins this week beats all prior weeks. */
  isPersonalBestWeek: boolean;
  /** Last data-room milestone CROSSED (25/50/75/100), or null if none recent. */
  dataRoomMilestone: 25 | 50 | 75 | 100 | null;
  /** This week's total win count — used for the headline number on the banner. */
  thisWeekTotal: number;
  /** Number of consecutive weeks (ending this one) where wins increased. */
  growthStreakWeeks: number;
  /** A stable key so the client can de-dupe per (trigger, week) in localStorage. */
  triggerKey: string;
}

export async function getCelebrationTriggers(): Promise<CelebrationTriggers> {
  const [thisWeek, velocity, dataRoom] = await Promise.all([
    getThisWeekWins(),
    getWeeklyVelocity(8),
    getDataRoomProgress(),
  ]);

  const thisWeekTotal =
    thisWeek.tasksDone + thisWeek.raidClosed + thisWeek.documentsAdded + thisWeek.dataRoomShipped;

  // Personal best: latest bucket strictly greater than every prior bucket.
  // We use velocity (tasks/week) as the proxy since it's the longest series.
  const latest = velocity[velocity.length - 1]?.count ?? 0;
  const prior = velocity.slice(0, -1).map((b) => b.count);
  const isPersonalBestWeek = latest > 0 && prior.every((c) => latest > c);

  // Growth streak: count weeks where each is strictly greater than the previous.
  let streak = 0;
  for (let i = velocity.length - 1; i > 0; i--) {
    if ((velocity[i]?.count ?? 0) > (velocity[i - 1]?.count ?? 0)) streak++;
    else break;
  }

  // Data-room milestone: report the HIGHEST threshold the current pct has
  // reached. Client de-dupes so it only celebrates once per crossing.
  let dataRoomMilestone: 25 | 50 | 75 | 100 | null = null;
  const pct = dataRoom.pctComplete;
  if (pct >= 100) dataRoomMilestone = 100;
  else if (pct >= 75) dataRoomMilestone = 75;
  else if (pct >= 50) dataRoomMilestone = 50;
  else if (pct >= 25) dataRoomMilestone = 25;

  // Trigger key — combines all the celebratable conditions + an ISO week stamp
  // so the client knows whether to re-fire confetti.
  const week = startOfWeekUtc(new Date()).toISOString().slice(0, 10);
  const triggerKey = [
    week,
    isPersonalBestWeek ? 'best' : '',
    dataRoomMilestone ? `dr${dataRoomMilestone}` : '',
    streak >= 3 ? `streak${streak}` : '',
  ]
    .filter(Boolean)
    .join('-');

  return {
    isPersonalBestWeek,
    dataRoomMilestone,
    thisWeekTotal,
    growthStreakWeeks: streak,
    triggerKey,
  };
}
