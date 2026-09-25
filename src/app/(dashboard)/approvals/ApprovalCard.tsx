'use client';

/**
 * ApprovalCard — single approval row with Approve / Reject actions.
 *
 * Optimistic UI: when you click Approve, the card disables + shows
 * "Approving…"; on success it disappears (page revalidates).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Mail } from 'lucide-react';

interface Props {
  approval: {
    id: string;
    kind: string;
    severity: string;
    summary: string;
    detail: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
    agent: { slug: string; name: string; branch: string };
  };
}

export default function ApprovalCard({ approval }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  async function approve() {
    setBusy('approve');
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${approval.id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
      setBusy(null);
    }
  }

  async function reject() {
    setBusy('reject');
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${approval.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed');
      setBusy(null);
    }
  }

  // Pull out send-specific fields if it's an email approval
  const isEmailSend = approval.kind === 'EXTERNAL_COMMUNICATION' && approval.payload?.tool === 'gmail_send';
  const to = typeof approval.payload?.to === 'string' ? approval.payload.to : '';
  const cc = typeof approval.payload?.cc === 'string' ? approval.payload.cc : '';
  const subject = typeof approval.payload?.subject === 'string' ? approval.payload.subject : '';
  const body = typeof approval.payload?.body === 'string' ? approval.payload.body : '';
  const from = typeof approval.payload?.from === 'string' ? approval.payload.from : '';

  return (
    <div className="bg-white rounded-xl border border-line p-5 shadow-card">
      <div className="flex items-start gap-3 mb-3">
        {isEmailSend && (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-brand/10 text-brand flex-shrink-0">
            <Mail className="w-5 h-5" strokeWidth={1.8} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
              {approval.kind.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-mist text-muted font-medium">
              {approval.severity}
            </span>
            <span className="text-xs text-muted font-mono">{approval.agent.slug}</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{new Date(approval.createdAt).toLocaleString()}</span>
          </div>
          <div className="text-sm font-medium text-ink leading-snug">{approval.summary}</div>
        </div>
      </div>

      {isEmailSend ? (
        <div className="bg-mist/40 rounded-lg border border-line/60 p-4 mb-4 space-y-2 text-sm">
          <div className="grid grid-cols-[60px_1fr] gap-x-3 gap-y-1">
            <div className="text-xs text-muted uppercase tracking-wide">From</div>
            <div className="text-ink font-mono text-xs">{from}</div>
            <div className="text-xs text-muted uppercase tracking-wide">To</div>
            <div className="text-ink font-mono text-xs">{to}</div>
            {cc && (
              <>
                <div className="text-xs text-muted uppercase tracking-wide">Cc</div>
                <div className="text-ink font-mono text-xs">{cc}</div>
              </>
            )}
            <div className="text-xs text-muted uppercase tracking-wide">Subject</div>
            <div className="text-ink font-medium">{subject}</div>
          </div>
          <div className="border-t border-line/60 pt-2 mt-2">
            <pre className="whitespace-pre-wrap text-xs text-ink leading-relaxed font-sans">{body}</pre>
          </div>
        </div>
      ) : (
        approval.detail && (
          <pre className="whitespace-pre-wrap text-xs text-ink bg-mist/40 border border-line/60 rounded-lg p-3 mb-4">
            {approval.detail}
          </pre>
        )
      )}

      {showRejectForm ? (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Optional reason (helps the agent understand the rejection)"
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
              onClick={reject}
              disabled={busy !== null}
              className="text-xs px-3 py-1.5 rounded-md bg-mist text-ink hover:bg-line disabled:opacity-50"
            >
              {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
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
            Reject
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={busy !== null}
            className="text-sm px-4 py-1.5 rounded-full text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{ background: '#004923' }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            {busy === 'approve' ? 'Approving…' : 'Approve & send'}
          </button>
        </div>
      )}
    </div>
  );
}
