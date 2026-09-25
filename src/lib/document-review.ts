/**
 * Document review — the gate between "agent-generated doc" and "doc visible
 * to investors in the data room." Distinct from ApprovalRequest (which gates
 * agent ACTIONS like external email sends or partner-language drafts).
 *
 * Two gate modes:
 *   - BLOCK: promotion is held. The DataRoomEntry is NOT updated until a
 *     reviewer approves. Used for high-stakes kinds (financial, legal,
 *     technical IP, infrastructure) + any IP-sensitive doc + any doc that
 *     tripped a fact-check warning.
 *   - ANNOTATE: promotion happens immediately, but a review row is still
 *     created (status=PENDING, gate=ANNOTATE) so reviewers can revoke or
 *     downgrade after the fact. Used for low-stakes (GENERAL, POLICY).
 *
 * Routing:
 *   - Reviewers are Users where `reviewerForBranches` contains the creator
 *     agent's branch.
 *   - CEO + MD see ALL reviews regardless (handled in queue query, not
 *     here).
 *
 * Public surface:
 *   - decideGate(doc) → ReviewGate
 *   - routeReviewers(agent) → User[]  (excluding execs; execs see-all elsewhere)
 *   - createReviewRequest(args) → DocumentReview row
 *   - decideReview(args) → applies decision (incl. deferred promotion on APPROVE)
 */

import { prisma } from './db';
import {
  DocumentKind,
  IpSensitivity,
  ReviewGate,
  ReviewStatus,
  AgentBranch,
  type Document,
  type User,
  type Agent,
  type DocumentReview,
} from '@prisma/client';
/** Minimal shape retained from the removed divergence scanner. */
export interface DivergenceFinding {
  ruleId: string;
  severity: string;
  message: string;
  excerpt?: string;
}

// ─────────────────────────────────────────────────────────────
// Gate decision: BLOCK vs ANNOTATE
// ─────────────────────────────────────────────────────────────

/**
 * High-stakes document kinds that BLOCK promotion until a reviewer signs off.
 * Per Nima: Technical / Financial / Legal / Infrastructure docs all block.
 *
 * To loosen later, move kinds from this set to ANNOTATE behavior.
 */
const BLOCKING_KINDS: ReadonlySet<DocumentKind> = new Set<DocumentKind>([
  // Financial
  DocumentKind.FINANCIAL_MODEL,
  DocumentKind.TERM_SHEET,
  DocumentKind.INVESTOR_UPDATE,
  DocumentKind.BOARD_PACK,
  // Legal
  DocumentKind.CONTRACT,
  DocumentKind.LOI,
  DocumentKind.NDA,
  DocumentKind.LEGAL_OPINION,
  // Technical / IP
  DocumentKind.SCIENTIFIC_MEMO,
  DocumentKind.SOP,
  DocumentKind.REGULATORY_DOSSIER,
  DocumentKind.HSE_REPORT,
  // External-facing strategy
  DocumentKind.BUSINESS_PLAN,
  DocumentKind.PITCH_DECK,
]);

/**
 * IP-sensitivity levels that BLOCK regardless of kind. (e.g. a GENERAL doc
 * tagged IP_CRITICAL — strain method etc. — still needs review.)
 */
const BLOCKING_SENSITIVITY: ReadonlySet<IpSensitivity> = new Set<IpSensitivity>([
  IpSensitivity.IP_CRITICAL,
  IpSensitivity.INVESTOR_RESTRICTED,
  IpSensitivity.COMMERCIAL_SENSITIVE,
]);

/**
 * Decide whether a promotion should BLOCK (queue and hold) or ANNOTATE
 * (promote immediately with after-the-fact review).
 *
 * Rules (any one triggers BLOCK):
 *   1. Document kind is in BLOCKING_KINDS
 *   2. Document ipSensitivity is in BLOCKING_SENSITIVITY
 *   3. There are any non-empty fact-check warnings (CRITICAL or HIGH)
 *
 * Everything else (GENERAL, POLICY without IP flag, no warnings) ANNOTATEs.
 */
export function decideGate(
  doc: Pick<Document, 'kind' | 'ipSensitivity'>,
  factCheckWarnings: DivergenceFinding[] = [],
): ReviewGate {
  if (BLOCKING_KINDS.has(doc.kind)) return ReviewGate.BLOCK;
  if (BLOCKING_SENSITIVITY.has(doc.ipSensitivity)) return ReviewGate.BLOCK;
  if (factCheckWarnings.length > 0) return ReviewGate.BLOCK;
  return ReviewGate.ANNOTATE;
}

// ─────────────────────────────────────────────────────────────
// Routing: which users can decide a review for a given agent?
// ─────────────────────────────────────────────────────────────

/**
 * Returns the branches whose reviewers can decide work from this agent.
 * Right now this is just [agent.branch] — a single-branch list — but the
 * shape allows future expansion (e.g. cross-branch reviewers, holding
 * companies).
 */
export function allowedBranchesForAgent(agent: Pick<Agent, 'branch'>): AgentBranch[] {
  return [agent.branch];
}

/**
 * Find users authorized to review documents from a given agent.
 *
 * Returned set:
 *   - All users where reviewerForBranches contains agent.branch
 *   - EXCLUDES execs (CEO/MD) — those are see-all and handled separately
 *     in the queue query so we don't notify them on every single review.
 *     (Exec dashboard surfaces the full queue; targeted reviewers also
 *     get email pings.)
 *   - Only active users.
 */
export async function routeReviewers(
  agent: Pick<Agent, 'branch'>,
): Promise<Pick<User, 'id' | 'name' | 'email' | 'role'>[]> {
  return prisma.user.findMany({
    where: {
      isActive: true,
      reviewerForBranches: { has: agent.branch },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
}

// ─────────────────────────────────────────────────────────────
// Create a review request
// ─────────────────────────────────────────────────────────────

export interface CreateReviewRequestArgs {
  documentId: string;
  requesterAgentId: string | null;
  requesterUserId: string | null;
  targetRoomSlug: string;
  targetRefNumber: string;
  targetEntryId: string | null;
  targetStatus: string;
  targetVersion: string | null;
  gate: ReviewGate;
  allowedBranches: AgentBranch[];
  summary: string;
  factCheckWarnings: DivergenceFinding[];
}

/**
 * Persist a review request. Caller is responsible for any post-write
 * side effects (notifying reviewers, recording an activity event, etc.).
 *
 * Idempotency note: this does NOT dedupe against an existing PENDING
 * review for the same doc/entry. A revised re-promotion creates a fresh
 * review row; the queue UI shows both with timestamps so reviewers see
 * the history.
 */
export async function createReviewRequest(
  args: CreateReviewRequestArgs,
): Promise<DocumentReview> {
  return prisma.documentReview.create({
    data: {
      documentId: args.documentId,
      requesterAgentId: args.requesterAgentId,
      requesterUserId: args.requesterUserId,
      targetRoomSlug: args.targetRoomSlug,
      targetRefNumber: args.targetRefNumber,
      targetEntryId: args.targetEntryId,
      targetStatus: args.targetStatus,
      targetVersion: args.targetVersion,
      gate: args.gate,
      status: ReviewStatus.PENDING,
      allowedBranches: args.allowedBranches,
      summary: args.summary.slice(0, 2000),
      factCheckWarnings: args.factCheckWarnings.length
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (args.factCheckWarnings as any)
        : undefined,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Decide a review (approve / reject / revoke)
// ─────────────────────────────────────────────────────────────

export interface DecideReviewArgs {
  reviewId: string;
  decidedById: string;
  decision: 'APPROVED' | 'REJECTED' | 'REVOKED';
  notes?: string | null;
}

export interface DecideReviewResult {
  ok: boolean;
  review?: DocumentReview;
  promotionApplied?: {
    entryId: string;
    refNumber: string;
    status: string;
  };
  error?: string;
}

/**
 * Apply a review decision. For APPROVED + gate=BLOCK, this executes the
 * deferred promotion (writes the DataRoomEntry). For APPROVED + gate=
 * ANNOTATE, the promotion already happened at create time, so this just
 * lifts the "pending" badge. For REJECTED, the doc stays out of the room
 * (or, if gate=ANNOTATE, the doc is downgraded — handled by the caller's
 * subsequent revoke flow). For REVOKED (only valid when gate=ANNOTATE),
 * the DataRoomEntry's document link is cleared.
 *
 * Returns the updated review + (if applicable) the resulting promotion
 * details. Caller writes audit + activity events using these.
 */
export async function decideReview(args: DecideReviewArgs): Promise<DecideReviewResult> {
  const existing = await prisma.documentReview.findUnique({
    where: { id: args.reviewId },
    include: {
      document: { select: { id: true, title: true } },
    },
  });
  if (!existing) return { ok: false, error: 'Review not found.' };
  if (existing.status !== ReviewStatus.PENDING && args.decision !== 'REVOKED') {
    return { ok: false, error: `Review already ${existing.status.toLowerCase()}.` };
  }
  if (args.decision === 'REVOKED' && existing.gate !== ReviewGate.ANNOTATE) {
    return {
      ok: false,
      error: 'Can only revoke an annotated promotion (gate=ANNOTATE).',
    };
  }

  // ── APPROVED + BLOCK: execute the deferred promotion ──
  let promotionApplied: DecideReviewResult['promotionApplied'];
  if (args.decision === 'APPROVED' && existing.gate === ReviewGate.BLOCK) {
    const room = await prisma.dataRoom.findUnique({
      where: { slug: existing.targetRoomSlug },
    });
    if (!room) return { ok: false, error: `Data room "${existing.targetRoomSlug}" not found.` };

    const entry = await prisma.dataRoomEntry.findUnique({
      where: {
        dataRoomId_refNumber: {
          dataRoomId: room.id,
          refNumber: existing.targetRefNumber,
        },
      },
    });
    if (!entry) {
      return {
        ok: false,
        error: `Data room entry "${existing.targetRefNumber}" not found.`,
      };
    }

    const updated = await prisma.dataRoomEntry.update({
      where: { id: entry.id },
      data: {
        documentId: existing.documentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: existing.targetStatus as any,
        version: existing.targetVersion ?? undefined,
        addedById: args.decidedById,
      },
    });

    promotionApplied = {
      entryId: updated.id,
      refNumber: updated.refNumber,
      status: existing.targetStatus,
    };
  }

  // ── REVOKED (ANNOTATE only): clear the entry's primary doc link ──
  // Revert status to IN_PROGRESS — the doc is gone, but the entry is
  // still actively being worked on (the agent will likely re-ship a
  // revised version). DataRoomEntryStatus has no plain "PENDING";
  // IN_PROGRESS is the closest "needs another pass" semantic.
  if (args.decision === 'REVOKED' && existing.targetEntryId) {
    await prisma.dataRoomEntry.update({
      where: { id: existing.targetEntryId },
      data: { documentId: null, status: 'IN_PROGRESS' },
    });
  }

  const updatedReview = await prisma.documentReview.update({
    where: { id: existing.id },
    data: {
      status: ReviewStatus[args.decision],
      decidedById: args.decidedById,
      decidedAt: new Date(),
      decisionNotes: args.notes ?? null,
    },
  });

  return { ok: true, review: updatedReview, promotionApplied };
}

// ─────────────────────────────────────────────────────────────
// Queue accessor — used by /review page + email digest builders
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the pending review queue VISIBLE to a given viewer. Execs
 * (CEO/MD) see everything. Branch reviewers see only items in their
 * allowedBranches.
 */
export async function pendingReviewsForViewer(viewer: {
  id: string;
  role: string;
  reviewerForBranches: AgentBranch[];
}) {
  const isExecViewer = viewer.role === 'CEO' || viewer.role === 'MD';

  return prisma.documentReview.findMany({
    where: {
      status: ReviewStatus.PENDING,
      ...(isExecViewer
        ? {}
        : viewer.reviewerForBranches.length
          ? { allowedBranches: { hasSome: viewer.reviewerForBranches } }
          : { id: '__never__' /* not a reviewer + not exec → empty queue */ }),
    },
    include: {
      document: {
        select: { id: true, title: true, kind: true, ipSensitivity: true, mimeType: true, sizeBytes: true },
      },
      requesterAgent: { select: { slug: true, name: true, branch: true } },
    },
    orderBy: [{ gate: 'asc' }, { createdAt: 'asc' }], // BLOCK before ANNOTATE
  });
}
