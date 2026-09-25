/**
 * Cross-thread awareness — what the agent sees about itself & the team
 * before responding to a user message.
 *
 * This is injected into the dynamic suffix of the system prompt so each
 * turn the agent has fresh context about:
 *   - Tasks it owns
 *   - Open RAID entries
 *   - Recent activity by the team
 *
 * Phase 2 will extend this with: mentions across channels (with channel-
 * membership privacy scoping), document uploads relevant to the agent,
 * pending approvals, etc.
 */

import { prisma } from './db';
import type { Agent } from '@prisma/client';

const RECENT_HOURS = 72;

export async function buildCrossThreadContext(agent: Agent): Promise<string> {
  const since = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);

  const [ownedTasksOpen, ownedRaidOpen, recentTeamActivity] = await Promise.all([
    prisma.task.findMany({
      where: {
        ownerAgentId: agent.id,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 10,
      include: { assignee: { select: { name: true, email: true } } },
    }),
    prisma.raidEntry.findMany({
      where: {
        OR: [{ ownerAgentId: agent.id }, { raisedByAgentId: agent.id }],
        status: { not: 'CLOSED' },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        // Exclude the agent's OWN activity — it's already in their thread
        // history and just bloats the context window without adding signal.
        // Without this filter, an active orchestrator (e.g. Layla MD) sees
        // her own messages echoed back to her every turn, growing input
        // tokens until the model's output budget collapses.
        NOT: { agentId: agent.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        user: { select: { name: true } },
        agent: { select: { slug: true } },
      },
    }),
  ]);

  const blocks: string[] = [];

  if (ownedTasksOpen.length > 0) {
    blocks.push(
      `## Open tasks you own (${ownedTasksOpen.length})`,
      ...ownedTasksOpen.map((t) => {
        const due = t.dueDate ? ` due=${t.dueDate.toISOString().slice(0, 10)}` : '';
        const who = t.assignee?.name ?? '(unassigned)';
        return `- [${t.priority}] ${t.status} | ${t.title} | assignee=${who}${due}`;
      }),
    );
  }

  if (ownedRaidOpen.length > 0) {
    blocks.push(
      '',
      `## Open RAID items you own or raised (${ownedRaidOpen.length})`,
      ...ownedRaidOpen.map((r) => `- [${r.kind}/${r.severity}] ${r.status} | ${r.title}`),
    );
  }

  if (recentTeamActivity.length > 0) {
    blocks.push(
      '',
      `## Team activity in the last ${RECENT_HOURS}h (most recent first)`,
      ...recentTeamActivity.slice(0, 10).map((a) => {
        const actor = a.agent?.slug ?? a.user?.name ?? 'system';
        return `- ${a.createdAt.toISOString().slice(0, 16).replace('T', ' ')} — ${actor} — ${a.summary ?? a.action}`;
      }),
    );
  }

  if (blocks.length === 0) return '';

  return [
    '# Cross-thread awareness',
    '_(Auto-injected per turn. Read this BEFORE replying — cite anything relevant.)_',
    '',
    ...blocks,
  ].join('\n');
}
