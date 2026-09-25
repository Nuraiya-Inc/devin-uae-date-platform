/**
 * /review — the queue of agent-generated documents waiting on human sign-off.
 *
 * Visible to:
 *   - Exec (CEO, MD) — see-all, can decide anything
 *   - Branch reviewers — see items matching their reviewerForBranches
 *   - Everyone else — empty queue + a "you're not configured as a reviewer"
 *     hint (so the page doesn't 404 if someone bookmarks it).
 *
 * Sort order: BLOCK before ANNOTATE (BLOCK is hot — investors literally
 * can't see the doc yet), then oldest first.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { pendingReviewsForViewer } from '@/lib/document-review';
import { isExec } from '@/lib/access';
import { AgentBranch } from '@prisma/client';
import ReviewCard from './ReviewCard';
import DataRoomFreezeBanner from '@/components/DataRoomFreezeBanner';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  // Need the reviewerForBranches field to filter the queue. Session
  // user is lean by design (no extra DB columns) so we fetch.
  const viewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, reviewerForBranches: true },
  });
  if (!viewer) redirect('/signin');

  const isExecViewer = isExec(viewer.role);
  const hasReviewerRole = viewer.reviewerForBranches.length > 0;

  // Only fetch the queue if this user can decide anything. Otherwise
  // show the empty/help state — no point hitting the DB.
  const pending = isExecViewer || hasReviewerRole
    ? await pendingReviewsForViewer({
        id: viewer.id,
        role: viewer.role,
        reviewerForBranches: viewer.reviewerForBranches,
      })
    : [];

  const recent = isExecViewer || hasReviewerRole
    ? await prisma.documentReview.findMany({
        where: {
          status: { in: ['APPROVED', 'REJECTED', 'REVOKED'] },
          ...(isExecViewer
            ? {}
            : { allowedBranches: { hasSome: viewer.reviewerForBranches } }),
        },
        include: {
          document: { select: { id: true, title: true } },
          requesterAgent: { select: { slug: true, name: true } },
          decidedBy: { select: { name: true } },
        },
        orderBy: { decidedAt: 'desc' },
        take: 15,
      })
    : [];

  if (!isExecViewer && !hasReviewerRole) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-brand mb-2">Review queue</h1>
        <p className="text-sm text-muted mb-6">
          This page is for reviewers — people authorized to sign off on agent-
          generated documents before they enter the investor data room.
        </p>
        <div className="bg-white border border-line rounded-xl p-5 text-sm text-muted">
          You aren&apos;t configured as a reviewer for any branch yet. Ask Nima to
          add you via your user settings (<code className="font-mono text-xs bg-mist px-1.5 py-0.5 rounded">reviewerForBranches</code>).
        </div>
      </div>
    );
  }

  const blockCount = pending.filter((p) => p.gate === 'BLOCK').length;
  const annotateCount = pending.filter((p) => p.gate === 'ANNOTATE').length;

  return (
    <div>
      <DataRoomFreezeBanner variant="compact" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand tracking-tight mb-1">Review queue</h1>
        <p className="text-sm text-muted">
          Agent-generated documents waiting for human sign-off.
          {isExecViewer ? (
            <> You see <strong>everything</strong>.</>
          ) : (
            <>
              {' '}You review:{' '}
              <strong>{viewer.reviewerForBranches.map(branchLabel).join(', ')}</strong>.
            </>
          )}
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Pending ({pending.length})
          {blockCount > 0 && (
            <span className="ml-2 text-amber-700 normal-case tracking-normal">
              · {blockCount} blocking promotion
            </span>
          )}
          {annotateCount > 0 && (
            <span className="ml-2 text-muted normal-case tracking-normal">
              · {annotateCount} promoted with pending badge
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted bg-white border border-line rounded-xl">
            Nothing waiting on you. The agents are operating within the lines.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <ReviewCard
                key={r.id}
                review={{
                  id: r.id,
                  gate: r.gate,
                  status: r.status,
                  targetRoomSlug: r.targetRoomSlug,
                  targetRefNumber: r.targetRefNumber,
                  targetStatus: r.targetStatus,
                  targetVersion: r.targetVersion,
                  summary: r.summary,
                  createdAt: r.createdAt.toISOString(),
                  document: {
                    id: r.document.id,
                    title: r.document.title,
                    kind: r.document.kind,
                    ipSensitivity: r.document.ipSensitivity,
                    mimeType: r.document.mimeType,
                    sizeBytes: r.document.sizeBytes,
                  },
                  requesterAgent: r.requesterAgent
                    ? {
                        slug: r.requesterAgent.slug,
                        name: r.requesterAgent.name,
                        branch: r.requesterAgent.branch,
                      }
                    : null,
                  factCheckWarnings: r.factCheckWarnings as Array<{
                    ruleId: string;
                    expected: string;
                    severity: string;
                    claim?: string;
                  }> | null,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Recent decisions
        </h2>
        {recent.length === 0 ? (
          <div className="text-xs text-muted italic">No decisions yet.</div>
        ) : (
          <div className="space-y-1">
            {recent.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-lg border border-line/60 px-4 py-2.5 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      r.status === 'APPROVED'
                        ? 'bg-brand/10 text-brand'
                        : r.status === 'REJECTED'
                          ? 'bg-mist text-muted'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-muted text-xs font-mono">{r.requesterAgent?.slug ?? 'agent'}</span>
                  <span className="text-ink truncate flex-1">{r.document.title}</span>
                  {r.decidedBy && (
                    <span className="text-xs text-muted whitespace-nowrap">
                      by {r.decidedBy.name}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted whitespace-nowrap flex-shrink-0 ml-3">
                  {r.decidedAt ? new Date(r.decidedAt).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function branchLabel(b: AgentBranch): string {
  return ({
    EXECUTIVE: 'Executive',
    FINANCE: 'Finance',
    TECHNOLOGY: 'Technology',
    COMMERCIAL: 'Commercial',
    MARKETING: 'Marketing',
    OPERATIONS: 'Operations',
  } as Record<AgentBranch, string>)[b];
}
