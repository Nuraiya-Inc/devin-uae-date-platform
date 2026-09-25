/**
 * POST /api/review/[id]/reject
 *
 * Mark a DocumentReview as REJECTED (gate=BLOCK) or REVOKED (gate=ANNOTATE).
 *
 *   - gate=BLOCK   → set status=REJECTED. The DataRoomEntry was never
 *                    touched, so no rollback needed; the agent sees the
 *                    rejection notes on its next run and can revise.
 *   - gate=ANNOTATE → set status=REVOKED. Clears the DataRoomEntry's
 *                    primary document link so the room shows "missing"
 *                    again, awaiting either re-promotion or a different
 *                    doc.
 *
 * Body (optional): { notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import { decideReview } from '@/lib/document-review';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let notes: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.notes === 'string') notes = body.notes;
  } catch {
    // empty body — fine
  }

  const viewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, reviewerForBranches: true },
  });
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const review = await prisma.documentReview.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, title: true } },
      requesterAgent: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

  const isExecViewer = isExec(viewer.role);
  const canDecide =
    isExecViewer ||
    viewer.reviewerForBranches.some((b) => review.allowedBranches.includes(b));
  if (!canDecide) {
    return NextResponse.json(
      { error: 'You are not authorized to decide this review.' },
      { status: 403 },
    );
  }

  const decision = review.gate === 'ANNOTATE' ? 'REVOKED' : 'REJECTED';

  const result = await decideReview({
    reviewId: review.id,
    decidedById: viewer.id,
    decision,
    notes: notes ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Decision failed' }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      userId: viewer.id,
      agentId: review.requesterAgent?.id,
      action: decision === 'REVOKED' ? 'document_review.revoke' : 'document_review.reject',
      entityType: 'DocumentReview',
      entityId: review.id,
      summary: `${viewer.name} ${decision.toLowerCase()} "${review.document.title}" (${review.gate}) by ${review.requesterAgent?.slug ?? 'agent'}`,
      metadata: {
        reviewId: review.id,
        gate: review.gate,
        decision,
        docId: review.documentId,
        notes: notes ?? null,
      },
    },
  });

  await recordActivity({
    kind: 'APPROVAL_DECIDED',
    severity: 'WARNING',
    actorUser: { id: viewer.id },
    entityType: 'DocumentReview',
    entityId: review.id,
    title: `${viewer.name} ${decision === 'REVOKED' ? 'revoked' : 'rejected'}: ${review.document.title}`,
    summary:
      decision === 'REVOKED'
        ? `Pulled from ${review.targetRoomSlug}/${review.targetRefNumber}${notes ? ` — ${notes}` : ''}`
        : `Held back from ${review.targetRoomSlug}/${review.targetRefNumber}${notes ? ` — ${notes}` : ''}`,
    payload: {
      reviewId: review.id,
      docId: review.documentId,
      docTitle: review.document.title,
      gate: review.gate,
      decision,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ ok: true, review: result.review });
}
