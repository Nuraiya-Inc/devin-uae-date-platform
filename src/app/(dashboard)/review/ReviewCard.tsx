'use client';

/**
 * ReviewCard — one row in the /review queue.
 *
 * Shows the agent's claim, the document, fact-check warnings (if any),
 * and approve / reject / revoke action buttons. Buttons differ by gate:
 *   - BLOCK    → "Approve & promote" vs "Reject"
 *   - ANNOTATE → "Confirm" (lift the badge) vs "Revoke" (pull from room)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, FileText, AlertTriangle, ExternalLink } from 'lucide-react';

interface Props {
  review: {
    id: string;
    gate: string;
    status: string;
    targetRoomSlug: string;
    targetRefNumber: string;
    targetStatus: string;
    targetVersion: string | null;
    summary: string;
    createdAt: string;
    document: {
      id: string;
      title: string;
      kind: string;
      ipSensitivity: string;
      mimeType: string | null;
      sizeBytes: number | null;
    };
    requesterAgent: { slug: string; name: string; branch: string } | null;
    factCheckWarnings: Array<{
      ruleId: string;
      expected: string;
      severity: string;
      claim?: string;
    }> | null;
  };
}

export default function ReviewCard({ review }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [notes, setNotes] = useState('');

  const isBlock = review.gate === 'BLOCK';

  async function decide(choice: 'approve' | 'reject') {
    setBusy(choice);
    setError(null);
    try {
      const res = await fetch(`/api/review/${review.id}/${choice}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${choice} failed`);
      setBusy(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-line p-5 shadow-card">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isBlock ? 'bg-amber-50 text-amber-700' : 'bg-mist text-muted'
          }`}
        >
          <FileText className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${
                isBlock ? 'bg-amber-100 text-amber-800' : 'bg-mist text-muted'
              }`}
            >
              {isBlock ? 'BLOCKING' : 'ANNOTATING'}
            </span>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-mist text-muted font-medium">
              {review.document.kind.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-mist text-muted font-medium">
              {review.document.ipSensitivity.replace(/_/g, ' ')}
            </span>
            {review.requesterAgent && (
              <>
                <span className="text-xs text-muted font-mono">{review.requesterAgent.slug}</span>
                <span className="text-xs text-muted">·</span>
              </>
            )}
            <span className="text-xs text-muted">{new Date(review.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-sm font-medium text-ink leading-snug">{review.document.title}</div>
          <div className="text-xs text-muted mt-1">
            destination:{' '}
            <span className="font-mono">
              {review.targetRoomSlug}/{review.targetRefNumber}
            </span>{' '}
            → status <span className="font-mono">{review.targetStatus}</span>
            {review.targetVersion && <> · version {review.targetVersion}</>}
          </div>
        </div>
        <a
          href={`/documents/${review.document.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted hover:text-ink inline-flex items-center gap-1 flex-shrink-0"
          title="Open document"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          open
        </a>
      </div>

      <div className="bg-mist/40 rounded-lg border border-line/60 p-3 mb-3 text-xs text-ink whitespace-pre-wrap leading-relaxed">
        {review.summary}
      </div>

      {review.factCheckWarnings && review.factCheckWarnings.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
            Fact-check warnings ({review.factCheckWarnings.length})
          </div>
          <ul className="space-y-1 text-xs text-amber-900">
            {review.factCheckWarnings.slice(0, 6).map((w, i) => (
              <li key={i} className="leading-snug">
                <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
                  {w.severity}
                </span>{' '}
                [{w.ruleId}] {w.expected}
                {w.claim && (
                  <div className="text-amber-700 mt-0.5 ml-4 italic">&quot;{truncate(w.claim, 140)}&quot;</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showRejectForm ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isBlock
                ? 'Why are you rejecting? (the agent sees this and revises)'
                : 'Why are you revoking? (the agent sees this and revises)'
            }
            rows={2}
            className="w-full text-sm px-3 py-2 border border-line rounded-md resize-none focus:outline-none focus:border-brand-200 focus:ring-2 focus:ring-lime/20"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="text-xs text-muted hover:text-ink px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => decide('reject')}
              disabled={busy !== null}
              className="text-xs px-3 py-1.5 rounded-md bg-mist text-ink hover:bg-line disabled:opacity-50"
            >
              {busy === 'reject' ? 'Submitting…' : isBlock ? 'Confirm reject' : 'Confirm revoke'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-end items-center">
          {error && <span className="text-xs text-red-700 mr-auto">{error}</span>}
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={busy !== null}
            className="text-xs px-3 py-1.5 rounded-md text-muted hover:bg-mist disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
            {isBlock ? 'Reject' : 'Revoke'}
          </button>
          <button
            type="button"
            onClick={() => decide('approve')}
            disabled={busy !== null}
            className="text-sm px-4 py-1.5 rounded-full text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{ background: '#004923' }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            {busy === 'approve'
              ? 'Submitting…'
              : isBlock
                ? 'Approve & promote'
                : 'Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}
