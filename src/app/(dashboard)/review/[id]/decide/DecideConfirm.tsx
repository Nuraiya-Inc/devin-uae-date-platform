'use client';

/**
 * DecideConfirm — single-tap confirmation for an email deep-link.
 *
 * Renders the doc context + a confirm button (NOT auto-decide on load —
 * email prefetchers would trigger that). Phone-friendly: large tap
 * target, optional notes textarea, success state redirects to /review.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, FileText, ExternalLink } from 'lucide-react';

interface Props {
  reviewId: string;
  choice: 'approve' | 'reject';
  gate: string;
  docTitle: string;
  docKind: string;
  docId: string;
  targetRoomSlug: string;
  targetRefNumber: string;
  targetStatus: string;
  agentName: string;
  agentSlug: string;
  viewerName: string;
}

export default function DecideConfirm(props: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isApprove = props.choice === 'approve';
  const isBlock = props.gate === 'BLOCK';

  // Action label depends on (choice × gate):
  const actionLabel = isApprove
    ? isBlock ? 'Approve & promote to data room' : 'Confirm (lift pending badge)'
    : isBlock ? 'Reject (kick back to agent)' : 'Revoke (pull from data room)';

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${props.reviewId}/${props.choice}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDone(true);
      // Small delay so the user sees the confirmation before redirect.
      setTimeout(() => router.push('/review'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${props.choice} failed`);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-brand/10 text-brand inline-flex items-center justify-center mb-4">
          <Check className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-semibold text-brand mb-1">Decision recorded</h1>
        <p className="text-sm text-muted">Taking you to the queue…</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-semibold text-brand mb-1">
        {isApprove ? 'Confirm approval' : isBlock ? 'Confirm rejection' : 'Confirm revoke'}
      </h1>
      <p className="text-sm text-muted mb-6">
        Signed in as <strong>{props.viewerName}</strong>. One tap to finalize.
      </p>

      <div className="bg-white border border-line rounded-xl p-5 shadow-card mb-4">
        <div className="flex items-start gap-3">
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
                {props.docKind.replace(/_/g, ' ')}
              </span>
              {props.agentSlug && (
                <span className="text-xs text-muted font-mono">{props.agentSlug}</span>
              )}
            </div>
            <div className="text-sm font-medium text-ink leading-snug">{props.docTitle}</div>
            <div className="text-xs text-muted mt-1">
              by {props.agentName} · destination{' '}
              <span className="font-mono">
                {props.targetRoomSlug}/{props.targetRefNumber}
              </span>{' '}
              → <span className="font-mono">{props.targetStatus}</span>
            </div>
          </div>
          <a
            href={`/documents/${props.docId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted hover:text-ink inline-flex items-center gap-1 flex-shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            open
          </a>
        </div>
      </div>

      <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
        Notes (optional — the agent sees these)
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={
          isApprove
            ? 'e.g. "Great pull — but tighten the Q3 figure next time."'
            : 'e.g. "Use the updated Sulzer paragraph from the data room."'
        }
        rows={3}
        className="w-full text-sm px-3 py-2 border border-line rounded-md resize-none focus:outline-none focus:border-brand-200 focus:ring-2 focus:ring-lime/20 mb-4"
      />

      {error && <div className="text-xs text-red-700 mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <a
          href="/review"
          className="text-sm text-muted hover:text-ink px-4 py-2"
        >
          Cancel
        </a>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={`text-sm px-5 py-2 rounded-full font-medium text-white disabled:opacity-50 inline-flex items-center gap-1.5 ${
            isApprove ? '' : 'bg-mist text-ink hover:bg-line'
          }`}
          style={isApprove ? { background: '#004923' } : undefined}
        >
          {isApprove ? (
            <Check className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <X className="w-4 h-4" strokeWidth={2.5} />
          )}
          {busy ? 'Submitting…' : actionLabel}
        </button>
      </div>
    </div>
  );
}
