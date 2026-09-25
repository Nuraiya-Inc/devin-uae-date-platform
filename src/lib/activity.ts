/**
 * ActivityEvent recorder — single helper used by every tool handler and
 * the agent-run executor to write the user-facing event stream.
 *
 * Design rules:
 *   - Best-effort. Failures here MUST NOT break the calling tool. We log
 *     and swallow.
 *   - Branch is denormalized from the actor agent at write time so
 *     dashboard queries don't need a join.
 *   - `coalesceKey` groups events into one Layla "react mode" trigger
 *     (Phase B). For autonomous-run ships: `agent-run:<runId>`. For
 *     ad-hoc actions: leave null.
 *
 * Distinct from AuditLog (broad / automatic / compliance). ActivityEvent
 * is narrow / semantic / human-readable. Both can coexist on the same
 * action — they serve different consumers.
 */

import { prisma } from './db';
import type {
  Agent,
  User,
  AgentBranch,
  ActivityEventKind,
  ActivityEventSeverity,
  Prisma,
} from '@prisma/client';

export interface RecordActivityInput {
  kind: ActivityEventKind;
  severity?: ActivityEventSeverity;

  /** Agent that fired the event. Usually set. */
  actorAgent?: Pick<Agent, 'id' | 'branch' | 'slug'> | null;
  /** User that fired the event (when human-initiated outside chat). */
  actorUser?: Pick<User, 'id'> | null;

  /** Override the branch derived from actorAgent. Rare; useful for
   *  cross-branch events. */
  branchOverride?: AgentBranch | null;

  /** Loose FK — name of the model the event is about. */
  entityType?: string;
  entityId?: string;

  /** Feed-ready, single-line title. */
  title: string;
  /** Optional longer body for hover/expand. */
  summary?: string;

  /** Structured payload — shape varies per kind. Documented per call site. */
  payload?: Record<string, unknown>;

  /** Coalesce key for Phase B agent re-trigger batching. */
  coalesceKey?: string;
}

/**
 * Insert one row into ActivityEvent. Never throws.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    const branch =
      input.branchOverride !== undefined
        ? input.branchOverride
        : input.actorAgent?.branch ?? null;

    await prisma.activityEvent.create({
      data: {
        kind: input.kind,
        severity: input.severity ?? 'INFO',
        actorAgentId: input.actorAgent?.id ?? null,
        actorUserId: input.actorUser?.id ?? null,
        branch,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        title: input.title,
        summary: input.summary ?? null,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        coalesceKey: input.coalesceKey ?? null,
      },
    });
  } catch (err) {
    // Activity feed must never break the caller. Log + swallow.
    // eslint-disable-next-line no-console
    console.error(
      '[recordActivity] failed:',
      err instanceof Error ? err.message : err,
      'input.kind:',
      input.kind,
      'input.title:',
      input.title,
    );
  }
}

/**
 * Build the coalesce key for an autonomous-run-initiated event. Returns
 * undefined when not inside a run (so the event fires Layla immediately
 * rather than waiting for batching).
 */
export function coalesceKeyForRun(agentRunId?: string | null): string | undefined {
  if (!agentRunId) return undefined;
  return `agent-run:${agentRunId}`;
}
