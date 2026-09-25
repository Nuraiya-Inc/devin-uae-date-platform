/**
 * Portal — Voice of the network: requests, feedback, ideas, complaints.
 * Partners who feel heard, stay.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { submitSuggestion } from '@/lib/portal-actions';

export const dynamic = 'force-dynamic';

const KINDS: Record<string, string> = {
  REQUEST: 'Request · طلب',
  FEEDBACK: 'Feedback · ملاحظة',
  IDEA: 'Idea · فكرة',
  COMPLAINT: 'Complaint · شكوى',
};

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Received',
  REVIEWED: 'Reviewed by the network',
  PLANNED: 'Planned',
  DONE: 'Done',
  DECLINED: 'Not planned',
};

export default async function VoicePage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({
    where: { userId: session.user.id },
    include: { suggestions: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!partner) redirect('/dashboard');

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Your voice</h1>
        <p className="text-sm text-muted">
          صوتك يصل · Requests, ideas, and honest feedback go straight to the Center — and you can
          see what happens to them.
        </p>
      </header>

      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <form action={submitSuggestion} className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {Object.entries(KINDS).map(([k, v], i) => (
              <label key={k} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="accent-[#124E57]" />
                {v}
              </label>
            ))}
          </div>
          <textarea
            name="body" rows={4} required
            placeholder="Tell the Center what you need, what's not working, or the idea that would help your operation…"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600">
            Send to the network
          </button>
        </form>
      </section>

      <section className="fade-up fade-up-2 space-y-3">
        <h2 className="text-base font-semibold text-brand-800">Previously sent</h2>
        {partner.suggestions.length === 0 && <p className="text-sm text-muted">Nothing sent yet.</p>}
        {partner.suggestions.map((s) => (
          <div key={s.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {KINDS[s.kind]} · {s.createdAt.toISOString().slice(0, 10)}
              </span>
              <span className="rounded-full border border-line bg-mist px-3 py-1 text-xs text-muted">
                {STATUS_LABEL[s.status] ?? s.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink">{s.body}</p>
            {s.staffNote && (
              <p className="mt-2 rounded-lg bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">
                Network: {s.staffNote}
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
