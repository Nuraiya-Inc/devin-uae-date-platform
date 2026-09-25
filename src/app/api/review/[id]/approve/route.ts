/**
 * POST /api/review/[id]/approve
 *
 * Mark a DocumentReview as APPROVED.
 *   - gate=BLOCK   → execute the deferred promotion (write DataRoomEntry).
 *   - gate=ANNOTATE → already promoted; just lifts the "pending" badge.
 *
 * Authorization:
 *   - Exec (CEO/MD) can decide anything.
 *   - Branch reviewers can decide only items whose `allowedBranches`
 *     intersects their `reviewerForBranches`.
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

  // Body may be empty — treat that gracefully.
  let notes: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.notes === 'string') notes = body.notes;
  } catch {
    // empty body — fine
  }

  // Authorize: exec or branch reviewer.
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

  const result = await decideReview({
    reviewId: review.id,
    decidedById: viewer.id,
    decision: 'APPROVED',
    notes: notes ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Decision failed' }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      userId: viewer.id,
      agentId: review.requesterAgent?.id,
      action: 'document_review.approve',
      entityType: 'DocumentReview',
      entityId: review.id,
      summary: `${viewer.name} approved "${review.document.title}" (${review.gate}) by ${review.requesterAgent?.slug ?? 'agent'}`,
      metadata: {
        reviewId: review.id,
        gate: review.gate,
        docId: review.documentId,
        promotionApplied: result.promotionApplied ?? null,
        notes: notes ?? null,
      },
    },
  });

  // Activity feed — visible decision so the team can see it land.
  await recordActivity({
    kind: 'APPROVAL_DECIDED',
    severity: 'NOTABLE',
    actorUser: { id: viewer.id },
    entityType: 'DocumentReview',
    entityId: review.id,
    title: `${viewer.name} approved: ${review.document.title}`,
    summary: result.promotionApplied
      ? `Promoted to ${review.targetRoomSlug}/${review.targetRefNumber} (${result.promotionApplied.status})`
      : `Lifted pending-review badge on ${review.targetRoomSlug}/${review.targetRefNumber}`,
    payload: {
      reviewId: review.id,
      docId: review.documentId,
      docTitle: review.document.title,
      gate: review.gate,
      decision: 'APPROVED',
      promotionApplied: result.promotionApplied ?? undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    review: result.review,
    promotionApplied: result.promotionApplied ?? null,
  });
}
