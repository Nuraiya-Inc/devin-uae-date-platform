/**
 * Document-review email notifications.
 *
 * When a DocumentReview row is created, this module:
 *   1. Resolves the set of reviewers (branch reviewers + CEO/MD).
 *   2. Composes a phone-friendly plain-text email from Layla's mailbox.
 *   3. Includes signed approve/reject deep links so reviewers can act
 *      on their phone without a full login (Nima's primary workflow).
 *
 * Called fire-and-forget from tool-catalog.ts's executePromoteToDataRoom.
 * Errors are logged but never thrown — the queue row in the DB is the
 * source of truth; email is best-effort.
 */

import { prisma } from './db';
import { sendMessage, type EmailAttachment } from './gmail';
import { getAgentEmail } from './agent-emails';

const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://uae.safabioworks.com';

/**
 * Compose + send review notification emails. Fans out one email per
 * reviewer (so each gets a tokenized link bound to their identity in
 * the audit). Returns the number of emails actually sent.
 *
 * Behavior is intentionally forgiving:
 *   - Missing Layla mailbox → log + return 0
 *   - Reviewer has no email → skipped
 *   - Gmail API failure for one reviewer → other reviewers still get sent
 */
export async function notifyReviewers(reviewId: string): Promise<number> {
  const review = await prisma.documentReview.findUnique({
    where: { id: reviewId },
    include: {
      document: {
        select: { id: true, title: true, kind: true, ipSensitivity: true, sizeBytes: true },
      },
      requesterAgent: { select: { slug: true, name: true, branch: true, title: true } },
      requesterUser: { select: { name: true } },
    },
  });
  if (!review) {
    console.warn(`[notifyReviewers] review ${reviewId} not found`);
    return 0;
  }

  // Reviewers = users with reviewerForBranches matching the allowedBranches
  // (typically just the creator agent's branch). CEO is INTENTIONALLY excluded
  // from per-doc emails — Nima sees the consolidated list in Layla's morning
  // digest. Per-doc fan-out to the CEO produced 15+ emails on a typical
  // morning sweep, which is noise not signal.
  //
  // CEO/MD still see the full /review queue in-app and via the morning digest.
  // To re-enable per-doc CEO emails (e.g., for CRITICAL items only), filter
  // by review.factCheckWarnings or document.ipSensitivity instead of adding
  // the role-based OR back.
  const reviewers = await prisma.user.findMany({
    where: {
      isActive: true,
      reviewerForBranches: { hasSome: review.allowedBranches },
    },
    select: { id: true, name: true, email: true, role: true },
  });
  if (reviewers.length === 0) {
    console.warn(`[notifyReviewers] no reviewers found for review ${reviewId}`);
    return 0;
  }

  const fromEmail = getAgentEmail('md-00');
  if (!fromEmail) {
    console.warn('[notifyReviewers] no mailbox for md-00 (Layla) — skipping email');
    return 0;
  }

  const baseUrl = PUBLIC_BASE_URL.replace(/\/+$/, '');
  const approveLink = `${baseUrl}/review/${review.id}/decide?token=${review.decisionToken}&choice=approve`;
  const rejectLink = `${baseUrl}/review/${review.id}/decide?token=${review.decisionToken}&choice=reject`;
  const queueLink = `${baseUrl}/review`;

  const gateLabel = review.gate === 'BLOCK' ? 'BLOCK' : 'ANNOTATE';
  const subjectPrefix = review.gate === 'BLOCK' ? '[Review needed]' : '[Promoted, pending review]';
  const subject = `${subjectPrefix} ${review.requesterAgent?.name ?? 'Agent'} → ${review.targetRoomSlug}/${review.targetRefNumber}: ${truncate(review.document.title, 80)}`;

  // Try to attach the document so reviewers can read it on their phone
  // before deciding. Fail open: if we can't read it, send without attachment.
  const attachments: EmailAttachment[] = [];
  try {
    const doc = await prisma.document.findUnique({
      where: { id: review.document.id },
      select: { storagePath: true, mimeType: true, sizeBytes: true },
    });
    if (doc?.storagePath && (doc.sizeBytes ?? 0) <= 20 * 1024 * 1024) {
      const { readStoredFile } = await import('./storage');
      const buf = await readStoredFile(doc.storagePath);
      attachments.push({
        filename: buildFilename(review.document.title, doc.mimeType ?? null),
        mimeType: doc.mimeType ?? 'application/octet-stream',
        content: buf,
      });
    }
  } catch (err) {
    console.warn('[notifyReviewers] attachment read failed (non-fatal)', err);
  }

  let sent = 0;
  for (const reviewer of reviewers) {
    if (!reviewer.email) continue;
    const body = composeBody({
      reviewerName: reviewer.name,
      reviewerRole: reviewer.role,
      agentName: review.requesterAgent?.name ?? 'Agent',
      agentTitle: review.requesterAgent?.title ?? '',
      docTitle: review.document.title,
      docKind: review.document.kind,
      docSensitivity: review.document.ipSensitivity,
      docSizeBytes: review.document.sizeBytes ?? null,
      targetRoomSlug: review.targetRoomSlug,
      targetRefNumber: review.targetRefNumber,
      targetStatus: review.targetStatus,
      gateLabel,
      summary: review.summary,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      factCheckWarnings: (review.factCheckWarnings as any) ?? null,
      approveLink,
      rejectLink,
      queueLink,
    });
    try {
      await sendMessage(fromEmail, {
        to: reviewer.email,
        subject,
        body,
        attachments: attachments.length ? attachments : undefined,
      });
      sent++;
    } catch (err) {
      console.error(`[notifyReviewers] send failed to ${reviewer.email}`, err);
    }
  }

  // One audit row capturing the fan-out for traceability.
  await prisma.auditLog.create({
    data: {
      action: 'document_review.notified',
      entityType: 'DocumentReview',
      entityId: review.id,
      summary: `Notified ${sent}/${reviewers.length} reviewers for "${review.document.title}"`,
      metadata: {
        reviewId: review.id,
        recipients: reviewers.map((r) => ({ id: r.id, email: r.email, role: r.role })),
        sent,
        attachmentBytes: attachments[0]?.content.length ?? 0,
      },
    },
  }).catch(() => undefined);

  return sent;
}

// ────────────────────────────────────────────────────────────
// Body composition
// ────────────────────────────────────────────────────────────

interface BodyArgs {
  reviewerName: string;
  reviewerRole: string;
  agentName: string;
  agentTitle: string;
  docTitle: string;
  docKind: string;
  docSensitivity: string;
  docSizeBytes: number | null;
  targetRoomSlug: string;
  targetRefNumber: string;
  targetStatus: string;
  gateLabel: 'BLOCK' | 'ANNOTATE';
  summary: string;
  factCheckWarnings: Array<{ ruleId: string; expected: string; severity: string; claim?: string }> | null;
  approveLink: string;
  rejectLink: string;
  queueLink: string;
}

function composeBody(a: BodyArgs): string {
  const isBlock = a.gateLabel === 'BLOCK';
  const gateHeader = isBlock
    ? `${a.agentName} is asking to add a document to the investor data room. It will NOT appear there until you sign off.`
    : `${a.agentName} has just added a document to the investor data room. It's live now — review it and revoke if anything's wrong.`;

  const sizeStr = a.docSizeBytes ? formatBytes(a.docSizeBytes) : '(size unknown)';

  const lines: string[] = [];
  lines.push(`${a.reviewerName},`);
  lines.push('');
  lines.push(gateHeader);
  lines.push('');
  lines.push('DOCUMENT');
  lines.push(`  ${a.docTitle}`);
  lines.push(`  Kind: ${a.docKind} · Sensitivity: ${a.docSensitivity} · ${sizeStr}`);
  lines.push('');
  lines.push('DESTINATION');
  lines.push(`  ${a.targetRoomSlug} / ${a.targetRefNumber} → status ${a.targetStatus}`);
  lines.push('');
  lines.push('AGENT SUMMARY');
  lines.push(`  ${a.summary}`);
  lines.push('');

  if (a.factCheckWarnings && a.factCheckWarnings.length > 0) {
    lines.push(`FACT-CHECK WARNINGS (${a.factCheckWarnings.length})`);
    for (const w of a.factCheckWarnings.slice(0, 8)) {
      lines.push(`  • [${w.severity}] [${w.ruleId}] ${w.expected}`);
      if (w.claim) lines.push(`    found: "${truncate(w.claim, 120)}"`);
    }
    lines.push('');
  }

  lines.push('YOUR DECISION');
  if (isBlock) {
    lines.push(`  Approve (promote into data room):`);
    lines.push(`    ${a.approveLink}`);
    lines.push('');
    lines.push(`  Reject (kick back to ${a.agentName} with notes):`);
    lines.push(`    ${a.rejectLink}`);
  } else {
    lines.push(`  Confirm (lift the "pending review" badge):`);
    lines.push(`    ${a.approveLink}`);
    lines.push('');
    lines.push(`  Revoke (remove from data room, kick back to ${a.agentName}):`);
    lines.push(`    ${a.rejectLink}`);
  }
  lines.push('');
  lines.push(`  Or open the full queue: ${a.queueLink}`);
  lines.push('');
  lines.push('—');
  lines.push('Layla');
  lines.push('Managing Director · Safa BioWorks');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────
// Tiny formatting helpers (duplicated from morning-digest to keep
// this module self-contained — extract to a shared file later if
// the duplication grows).
// ────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function buildFilename(title: string, mimeType: string | null): string {
  const safe = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'document';
  const lower = safe.toLowerCase();
  const ext = mimeToExtension(mimeType);
  if (ext && !lower.endsWith(`.${ext}`)) return `${safe}.${ext}`;
  return safe;
}

function mimeToExtension(mime: string | null): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/markdown': 'md',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };
  return map[mime] ?? null;
}
