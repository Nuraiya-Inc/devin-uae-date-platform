/**
 * Portal — applications: awards, honors, grants/funds, media mentions.
 * Structured submissions that land in the network's review queue with status
 * tracking. The network as the gatekeeper of opportunity.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { submitApplication } from '@/lib/portal-actions';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, { en: string; ar: string; hint: string }> = {
  AWARD: { en: 'Award', ar: 'جائزة', hint: 'National date awards, quality prizes, festival competitions' },
  HONOR: { en: 'Honor / Recognition', ar: 'تكريم', hint: 'Ceremonial recognition, founding-partner honors' },
  GRANT: { en: 'Fund / Grant', ar: 'دعم / منحة', hint: 'Development funds, subsidy programs, equipment support' },
  MENTION: { en: 'Media mention', ar: 'ذكر إعلامي', hint: 'Feature your operation in network channels and media' },
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-brand-50 text-brand-600 border-brand-200',
  UNDER_REVIEW: 'bg-gold-50 text-gold-700 border-gold-300',
  APPROVED: 'bg-mint-100 text-mint-700 border-mint-300',
  DECLINED: 'bg-mist text-muted border-line',
};

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({
    where: { userId: session.user.id },
    include: { applications: { orderBy: { createdAt: 'desc' } } },
  });
  if (!partner) redirect('/dashboard');

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Applications</h1>
        <p className="text-sm text-muted">
          طلبات الجوائز والدعم · Membership standing strengthens every application — Certified and
          Elite partners receive priority consideration.
        </p>
      </header>

      {/* New application */}
      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-brand-800">New application · طلب جديد</h2>
        <form action={submitApplication} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Type
            </label>
            <select name="kind" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm sm:max-w-sm">
              {Object.entries(KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.en} · {v.ar}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted">
              {Object.values(KIND_LABELS).map((v) => v.hint).join(' · ')}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Title
            </label>
            <input
              name="title" required placeholder="Application for the Excellence in Sustainable Farming award"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Your case
            </label>
            <textarea
              name="body" rows={5} required
              placeholder="Tell the Center why — achievements, figures, what makes your operation stand out. Abdullah can help you draft this in chat."
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <button className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600">
            Submit to the network
          </button>
        </form>
      </section>

      {/* History */}
      <section className="fade-up fade-up-2 space-y-3">
        <h2 className="text-base font-semibold text-brand-800">Your applications · طلباتكم</h2>
        {partner.applications.length === 0 && (
          <p className="text-sm text-muted">No applications yet.</p>
        )}
        {partner.applications.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{a.title}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {KIND_LABELS[a.kind]?.en ?? a.kind} · submitted {a.createdAt.toISOString().slice(0, 10)}
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[a.status] ?? ''}`}>
                {a.status.replace('_', ' ')}
              </span>
            </div>
            {a.decisionNote && (
              <p className="mt-2 rounded-lg bg-mist p-3 text-xs leading-relaxed text-muted">
                {a.decisionNote}
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
