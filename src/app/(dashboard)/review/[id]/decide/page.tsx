/**
 * /review/[id]/decide?token=...&choice=approve|reject
 *
 * Deep-link landing page from reviewer notification emails.
 *
 * Flow on click:
 *   1. If not signed in → /signin?returnTo=<this url> (Nima taps once, signs
 *      in if needed; then he's back here automatically).
 *   2. Validate the token matches review.decisionToken (defense in depth —
 *      stops URL-guessing and accidental link rot).
 *   3. Verify the signed-in user is authorized to decide this review
 *      (exec OR reviewerForBranches intersects allowedBranches).
 *   4. Render a one-tap confirmation card (doc title + agent + an
 *      optional notes field) — NOT auto-decide-on-load (that would let
 *      email-preview crawlers approve things by prefetching links).
 *   5. Confirm posts to /api/review/[id]/(approve|reject).
 *
 * Why a confirmation step: Apple Mail, Gmail webview, link previewers,
 * and various inboxes prefetch URLs to render previews. Auto-deciding
 * on GET would let those prefetches act on the review — terrible.
 * One-tap confirm prevents this while keeping the phone UX fast.
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import DecideConfirm from './DecideConfirm';

export const dynamic = 'force-dynamic';

export default async function DecidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; choice?: string }>;
}) {
  const { id } = await params;
  const { token, choice } = await searchParams;

  if (!token || !choice || (choice !== 'approve' && choice !== 'reject')) {
    return (
      <div className="max-w-xl mx-auto text-sm text-muted py-12">
        Malformed link — try opening the queue at <a href="/review" className="text-brand underline">/review</a>.
      </div>
    );
  }

  // Sign-in gate — preserve the full URL so they come back here after auth.
  const session = await auth();
  if (!session?.user) {
    const returnTo = encodeURIComponent(`/review/${id}/decide?token=${token}&choice=${choice}`);
    redirect(`/signin?returnTo=${returnTo}`);
  }

  // Load review + verify token + authz.
  const review = await prisma.documentReview.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, title: true, kind: true, ipSensitivity: true } },
      requesterAgent: { select: { slug: true, name: true, branch: true } },
      decidedBy: { select: { name: true } },
    },
  });
  if (!review) notFound();
  if (review.decisionToken !== token) {
    return (
      <div className="max-w-xl mx-auto text-sm text-muted py-12">
        This link is no longer valid. Open the queue at{' '}
        <a href="/review" className="text-brand underline">/review</a>.
      </div>
    );
  }

  if (review.status !== 'PENDING') {
    return (
      <div className="max-w-xl mx-auto py-12">
        <h1 className="text-xl font-semibold text-brand mb-2">Already decided</h1>
        <p className="text-sm text-muted mb-4">
          This review is <strong>{review.status.toLowerCase()}</strong>
          {review.decidedBy ? ` by ${review.decidedBy.name}` : ''}
          {review.decidedAt ? ` on ${new Date(review.decidedAt).toLocaleString()}` : ''}.
        </p>
        <a href="/review" className="text-sm text-brand underline">
          Back to queue
        </a>
      </div>
    );
  }

  const viewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, reviewerForBranches: true },
  });
  if (!viewer) redirect('/signin');

  const isExecViewer = isExec(viewer.role);
  const canDecide =
    isExecViewer ||
    viewer.reviewerForBranches.some((b) => review.allowedBranches.includes(b));
  if (!canDecide) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <h1 className="text-xl font-semibold text-brand mb-2">Not authorized</h1>
        <p className="text-sm text-muted">
          You aren&apos;t configured to decide reviews for this branch (
          {review.allowedBranches.join(', ')}).
        </p>
      </div>
    );
  }

  return (
    <DecideConfirm
      reviewId={review.id}
      choice={choice}
      gate={review.gate}
      docTitle={review.document.title}
      docKind={review.document.kind}
      docId={review.document.id}
      targetRoomSlug={review.targetRoomSlug}
      targetRefNumber={review.targetRefNumber}
      targetStatus={review.targetStatus}
      agentName={review.requesterAgent?.name ?? 'Agent'}
      agentSlug={review.requesterAgent?.slug ?? ''}
      viewerName={viewer.name}
    />
  );
}
