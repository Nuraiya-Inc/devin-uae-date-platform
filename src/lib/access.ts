/**
 * Access control — single source of truth for "who can see what".
 *
 * THREE access dimensions (Safa adds a third over the reference architecture):
 *
 *   1. **Role rank** — CEO > MD > AGENT_OWNER > TEAM_MEMBER > CONTRACTOR > VIEWER.
 *      Used for "is this person senior enough" gates.
 *
 *   2. **Reporting line** — each non-exec user belongs to one agent's branch.
 *      Used to scope what tasks/threads they can see.
 *
 *   3. **Entity scope** — each user belongs to one SafaEntity (FZE / INC / GROUP).
 *      CEO + MD + canAccessAllEntities=true bypass; everyone else only sees
 *      data tagged to their entity.
 *
 *   PLUS the **IP-sensitivity** check for documents (separate from access.ts —
 *   see lib/document-tools.ts for read_document ACL).
 */

import type { UserRole, SafaEntity, AgentBranch, IpSensitivity } from '@prisma/client';
import { prisma } from './db';

export type SessionUser = {
  id: string;
  role: UserRole;
  entity: SafaEntity;
  email: string;
  name: string;
};

const ROLE_RANK: Record<UserRole, number> = {
  CEO: 100,
  MD: 80,
  AGENT_OWNER: 60,
  TEAM_MEMBER: 40,
  CONTRACTOR: 20,
  VIEWER: 10,
};

export function hasAtLeast(actual: UserRole, required: UserRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** True for CEO + MD — these roles see everything across all entities. */
export function isExec(role: UserRole): boolean {
  return role === 'CEO' || role === 'MD';
}

/**
 * Financial-model calculator access: exec (CEO/MD) plus the Senior Financial
 * Advisor (Saqib) and Chief Scientific Engineer (Zara), by CEO direction.
 * NOTE: read/explore access to the modelling tool — distinct from authority
 * over financial or strategic decisions, which remains with the CEO.
 */
export const MODEL_ALLOWED_EMAILS = ['saqib@safabioworks.com', 'zara@safabioworks.com'];

export function canModel(role: UserRole, email: string | null | undefined): boolean {
  if (isExec(role)) return true;
  return !!email && MODEL_ALLOWED_EMAILS.includes(email.toLowerCase());
}

/**
 * Resolve the agents a user is allowed to see in detail.
 */
export async function visibleAgentIds(user: SessionUser): Promise<string[] | 'all'> {
  if (isExec(user.role)) return 'all';

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      ownedAgent: true,
      reportsToAgent: true,
    },
  });
  if (!dbUser) return [];

  if (dbUser.canAccessAllAgents) return 'all';

  const ids = new Set<string>();
  if (dbUser.ownedAgent) ids.add(dbUser.ownedAgent.id);
  if (dbUser.reportsToAgent) ids.add(dbUser.reportsToAgent.id);
  for (const id of dbUser.extraAgentIds) ids.add(id);

  // AGENT_OWNER: also add the agents that report into theirs (one hop down).
  if (user.role === 'AGENT_OWNER' && dbUser.ownedAgent) {
    const subordinates = await prisma.agent.findMany({
      where: { reportsToSlug: dbUser.ownedAgent.slug, isActive: true },
      select: { id: true },
    });
    for (const sub of subordinates) ids.add(sub.id);
  }

  return Array.from(ids);
}

/**
 * Can this user chat with this specific agent? Used by the chat route.
 *
 * IMPORTANT: the orchestrator gate runs BEFORE the isExec bypass, because
 * MD-rank users should NOT be able to chat with the MD agent — Layla is
 * the CEO's direct line, and MDs are a peer to her, not her boss. They
 * can still see her profile, files, and briefings; just not chat.
 */
export async function canChatWithAgent(
  user: SessionUser,
  agent: { id: string; slug: string; tier: string; branch: AgentBranch },
): Promise<boolean> {
  // Partner-portal users (linked to a Partner record) talk to Abdullah ONLY.
  const { prisma } = await import('./db');
  const linkedPartner = await prisma.partner.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (linkedPartner) return agent.slug === 'abd-00';

  // Abdullah (orchestrator) — any network exec/staff.
  if (agent.tier === 'ORCHESTRATOR') return isExec(user.role);

  if (isExec(user.role)) return true;

  const allowed = await visibleAgentIds(user);
  if (allowed === 'all') return true;
  return allowed.includes(agent.id);
}

/**
 * Document IP-sensitivity ACL — gates `read_document` tool execution.
 *
 *   PUBLIC               → any agent / any user
 *   INTERNAL             → any active agent (default)
 *   COMMERCIAL_SENSITIVE → COMMERCIAL + EXECUTIVE branches only
 *   IP_CRITICAL          → TECHNOLOGY + EXECUTIVE branches only
 *   INVESTOR_RESTRICTED  → FINANCE + EXECUTIVE branches only
 *
 * Plus: explicit `allowedBranches` always wins (additive whitelist).
 */
export function agentCanReadDocument(
  agentBranch: AgentBranch,
  doc: { ipSensitivity: IpSensitivity; allowedBranches: AgentBranch[] },
): boolean {
  // Explicit allowlist overrides default
  if (doc.allowedBranches.includes(agentBranch)) return true;

  // EXECUTIVE branch sees everything (MD, CFO, CTO, CCO, CMO, COO)
  if (agentBranch === 'EXECUTIVE') return true;

  switch (doc.ipSensitivity) {
    case 'PUBLIC':
    case 'INTERNAL':
      return true;
    case 'COMMERCIAL_SENSITIVE':
      return agentBranch === 'COMMERCIAL';
    case 'IP_CRITICAL':
      return agentBranch === 'TECHNOLOGY';
    case 'INVESTOR_RESTRICTED':
      return agentBranch === 'FINANCE';
    default:
      return false;
  }
}

/**
 * Entity scope check — used when listing tasks, documents, etc.
 * Returns a Prisma `where` fragment to AND into the query.
 */
export async function entityScopeWhere(user: SessionUser): Promise<{ entity?: { in: SafaEntity[] } }> {
  if (isExec(user.role)) return {};

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { entity: true, canAccessAllEntities: true },
  });

  if (!dbUser) return { entity: { in: [] as SafaEntity[] } };
  if (dbUser.canAccessAllEntities) return {};

  // GROUP-tagged rows visible to everyone in either entity
  return { entity: { in: [dbUser.entity, 'GROUP' as SafaEntity] } };
}

/**
 * Document read ACL for a HUMAN user (vs the agent-side check above).
 *
 * Rules:
 *  - CHEMPLAX-tagged documents NEVER appear in Safa context. Period.
 *  - CEO + MD see everything (within entity rule above).
 *  - AGENT_OWNER can see PUBLIC + INTERNAL + any sensitive doc whose
 *    `allowedBranches` includes their owned/reporting agent's branch.
 *  - TEAM_MEMBER + CONTRACTOR: PUBLIC + INTERNAL only.
 *  - VIEWER: PUBLIC only.
 *
 * Plus: explicit allowedBranches on a doc widens (additive whitelist) for
 * users whose reporting agent's branch is in that list.
 */
export function userCanReadDocument(
  user: { role: UserRole; entity: SafaEntity; canAccessAllEntities: boolean },
  reportingAgentBranch: AgentBranch | null,
  doc: { ipSensitivity: IpSensitivity; entity: SafaEntity; allowedBranches: AgentBranch[] },
): boolean {
  // Chemplax wall — never visible in Safa context
  if (doc.entity === 'CHEMPLAX') return false;

  // Entity scope check
  const sameEntity = doc.entity === user.entity || doc.entity === 'GROUP';
  if (!user.canAccessAllEntities && !isExec(user.role) && !sameEntity) return false;

  // Exec bypass
  if (isExec(user.role)) return true;

  // Explicit allowlist check
  if (reportingAgentBranch && doc.allowedBranches.includes(reportingAgentBranch)) return true;

  // Default sensitivity ladder
  switch (doc.ipSensitivity) {
    case 'PUBLIC':
      return true;
    case 'INTERNAL':
      return user.role !== 'VIEWER';
    case 'COMMERCIAL_SENSITIVE':
      return reportingAgentBranch === 'COMMERCIAL' || user.role === 'AGENT_OWNER';
    case 'IP_CRITICAL':
      return reportingAgentBranch === 'TECHNOLOGY';
    case 'INVESTOR_RESTRICTED':
      return reportingAgentBranch === 'FINANCE';
    default:
      return false;
  }
}

export async function requireRole(required: UserRole) {
  const { auth } = await import('./auth');
  const session = await auth();
  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 });
  }
  if (!hasAtLeast(session.user.role, required)) {
    throw new Response('Forbidden', { status: 403 });
  }
  return session.user;
}
