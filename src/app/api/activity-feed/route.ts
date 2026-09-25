/**
 * GET /api/activity-feed
 *
 * Server-side read API for the live ActivityEvent stream. Powers the
 * /feed page, the NotificationBell unread count, and the in-app toast.
 *
 * Auth: requires a NextAuth session. All authenticated users can read the
 * feed; per-user filtering (watched branches, muted agents) is applied
 * server-side via UserNotificationPreference.
 *
 * Query params (all optional):
 *   - branch          AgentBranch — single branch filter
 *   - agentSlug       string      — single actor agent slug filter
 *   - severity        comma-list  — INFO,NOTABLE,WARNING,CRITICAL allowlist
 *   - kind            comma-list  — ActivityEventKind allowlist
 *   - since           ISO date    — only events strictly after this timestamp
 *   - cursor          string      — id of last event from previous page (for "load more")
 *   - limit           1..100      — default 50
 *   - respectPrefs    "1"         — apply the caller's UserNotificationPreference filters
 *
 * Response shape:
 *   { events: ActivityEventDTO[], nextCursor: string | null, lastSeenAt: string | null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type {
  ActivityEventKind,
  ActivityEventSeverity,
  AgentBranch,
  Prisma,
} from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SEVERITIES: ActivityEventSeverity[] = ['INFO', 'NOTABLE', 'WARNING', 'CRITICAL'];
const VALID_BRANCHES: AgentBranch[] = [
  'EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS',
];

export interface ActivityEventDTO {
  id: string;
  kind: ActivityEventKind;
  severity: ActivityEventSeverity;
  branch: AgentBranch | null;
  actorAgent: { slug: string; name: string; branch: AgentBranch } | null;
  actorUser: { id: string; name: string } | null;
  entityType: string | null;
  entityId: string | null;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  createdAt: string; // ISO
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // ── Parse filters ──
  const branchParam = searchParams.get('branch');
  const branch =
    branchParam && (VALID_BRANCHES as string[]).includes(branchParam)
      ? (branchParam as AgentBranch)
      : null;

  const agentSlug = searchParams.get('agentSlug')?.trim() || null;

  const severityParam = searchParams.get('severity');
  const severities = severityParam
    ? severityParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is ActivityEventSeverity => (VALID_SEVERITIES as string[]).includes(s))
    : null;

  const kindParam = searchParams.get('kind');
  const kinds = kindParam
    ? kindParam.split(',').map((s) => s.trim()).filter(Boolean) as ActivityEventKind[]
    : null;

  const sinceParam = searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : null;
  const validSince = since && !Number.isNaN(since.getTime()) ? since : null;

  const cursor = searchParams.get('cursor');
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') ?? '50') || 50));

  const respectPrefs = searchParams.get('respectPrefs') === '1';

  // ── Resolve actor agent id from slug (if filtering by agent) ──
  let actorAgentId: string | null = null;
  if (agentSlug) {
    const a = await prisma.agent.findUnique({ where: { slug: agentSlug }, select: { id: true } });
    if (!a) return NextResponse.json({ events: [], nextCursor: null, lastSeenAt: null });
    actorAgentId = a.id;
  }

  // ── Pull notification prefs (single round trip when respectPrefs is set) ──
  let prefs: {
    watchedBranches: AgentBranch[];
    mutedAgentSlugs: string[];
    mutedKinds: ActivityEventKind[];
    lastSeenAt: Date | null;
  } | null = null;
  if (respectPrefs) {
    prefs = await prisma.userNotificationPreference.findUnique({
      where: { userId: session.user.id },
      select: {
        watchedBranches: true,
        mutedAgentSlugs: true,
        mutedKinds: true,
        lastSeenAt: true,
      },
    });
  } else {
    // Even when not filtering, fetch lastSeenAt so the caller can compute unread.
    const lite = await prisma.userNotificationPreference.findUnique({
      where: { userId: session.user.id },
      select: { lastSeenAt: true },
    });
    if (lite) prefs = { watchedBranches: [], mutedAgentSlugs: [], mutedKinds: [], lastSeenAt: lite.lastSeenAt };
  }

  // ── Compose where clause ──
  const where: Prisma.ActivityEventWhereInput = {};
  if (branch) where.branch = branch;
  if (actorAgentId) where.actorAgentId = actorAgentId;
  if (severities && severities.length > 0) where.severity = { in: severities };
  if (kinds && kinds.length > 0) where.kind = { in: kinds };
  if (validSince) where.createdAt = { gt: validSince };

  // Apply prefs allowlist / blocklist
  if (respectPrefs && prefs) {
    if (prefs.watchedBranches.length > 0) {
      // Intersect with any explicit branch filter
      if (where.branch) {
        if (!prefs.watchedBranches.includes(where.branch as AgentBranch)) {
          return NextResponse.json({
            events: [],
            nextCursor: null,
            lastSeenAt: prefs.lastSeenAt?.toISOString() ?? null,
          });
        }
      } else {
        where.branch = { in: prefs.watchedBranches };
      }
    }
    if (prefs.mutedKinds.length > 0) {
      // exclude muted kinds (additive to any kind allowlist)
      where.kind = where.kind
        ? { in: (where.kind as { in: ActivityEventKind[] }).in.filter((k) => !prefs!.mutedKinds.includes(k)) }
        : { notIn: prefs.mutedKinds };
    }
    if (prefs.mutedAgentSlugs.length > 0) {
      const mutedAgents = await prisma.agent.findMany({
        where: { slug: { in: prefs.mutedAgentSlugs } },
        select: { id: true },
      });
      const mutedIds = mutedAgents.map((a) => a.id);
      if (mutedIds.length > 0) {
        where.actorAgentId = where.actorAgentId
          ? where.actorAgentId
          : { notIn: mutedIds };
      }
    }
  }

  // ── Query ──
  const rows = await prisma.activityEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // +1 to detect next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      actorAgent: { select: { slug: true, name: true, branch: true } },
      actorUser: { select: { id: true, name: true } },
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1].id : null;

  const events: ActivityEventDTO[] = slice.map((e) => ({
    id: e.id,
    kind: e.kind,
    severity: e.severity,
    branch: e.branch,
    actorAgent: e.actorAgent
      ? { slug: e.actorAgent.slug, name: e.actorAgent.name, branch: e.actorAgent.branch }
      : null,
    actorUser: e.actorUser
      ? { id: e.actorUser.id, name: e.actorUser.name }
      : null,
    entityType: e.entityType,
    entityId: e.entityId,
    title: e.title,
    summary: e.summary,
    payload: (e.payload as Record<string, unknown>) ?? {},
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({
    events,
    nextCursor,
    lastSeenAt: prefs?.lastSeenAt?.toISOString() ?? null,
  });
}
