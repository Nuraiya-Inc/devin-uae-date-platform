/**
 * network console — Network inbox: everything partners send through the portal.
 * Applications to decide, collection tickets to monitor, marketplace
 * activity, and the voice of the network.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { decideApplication, updateSuggestionStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function NetworkInboxPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const [applications, tickets, listings, suggestions] = await Promise.all([
    prisma.application.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
      include: { partner: { select: { nameEn: true, registryNo: true, tier: true, region: true } } },
    }),
    prisma.collectionTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        partner: { select: { nameEn: true, registryNo: true } },
        claimedBy: { select: { nameEn: true } },
      },
    }),
    prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { partner: { select: { nameEn: true, registryNo: true } }, interests: true },
    }),
    prisma.suggestion.findMany({
      where: { status: 'NEW' },
      orderBy: { createdAt: 'asc' },
      include: { partner: { select: { nameEn: true, registryNo: true } } },
    }),
  ]);

  const openTickets = tickets.filter((t) => t.status === 'OPEN').length;
  const collectedTons = tickets
    .filter((t) => t.status === 'COLLECTED')
    .reduce((a, t) => a + (t.actualTons ?? t.estimatedTons), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-4">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Network inbox</h1>
        <p className="text-sm text-muted">
          What the network is sending in — {applications.length} application
          {applications.length === 1 ? '' : 's'} to decide · {openTickets} open collection ticket
          {openTickets === 1 ? '' : 's'} · {suggestions.length} new voice item
          {suggestions.length === 1 ? '' : 's'}
          {collectedTons > 0 && ` · ${collectedTons.toLocaleString('en-US')} t collected via tickets`}
        </p>
      </header>

      {/* Applications to decide */}
      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-brand-800">
          Applications awaiting decision
        </h2>
        <div className="space-y-3">
          {applications.length === 0 && <p className="text-sm text-muted">Queue is clear.</p>}
          {applications.map((a) => (
            <div key={a.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">
                    [{a.kind}] {a.title}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {a.partner.nameEn} · {a.partner.registryNo} · {a.partner.tier} ·{' '}
                    {a.partner.region} · {a.createdAt.toISOString().slice(0, 10)}
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{a.body}</p>
                </div>
                <form action={decideApplication} className="flex shrink-0 flex-col gap-2">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <input
                    name="decisionNote"
                    placeholder="Decision note to the partner…"
                    className="w-56 rounded-lg border border-line px-3 py-2 text-xs"
                  />
                  <div className="flex gap-2">
                    <button
                      name="decision" value="APPROVED"
                      className="flex-1 rounded-lg bg-mint-500 px-3 py-2 text-xs font-medium text-white hover:bg-mint-700"
                    >
                      Approve
                    </button>
                    <button
                      name="decision" value="DECLINED"
                      className="flex-1 rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-ink"
                    >
                      Decline
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Collection activity */}
        <section className="fade-up fade-up-2 rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-brand-800">
            Collection tickets
          </h2>
          <div className="space-y-2 text-sm">
            {tickets.length === 0 && <p className="text-muted">No tickets yet.</p>}
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-line/70 px-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="text-ink">{t.stream} · {t.actualTons ?? t.estimatedTons}t</span>{' '}
                  <span className="text-xs text-muted">
                    {t.partner.registryNo}
                    {t.claimedBy ? ` → ${t.claimedBy.nameEn}` : ''} · {t.region}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${
                    t.status === 'COLLECTED'
                      ? 'bg-mint-100 text-mint-700'
                      : t.status === 'CLAIMED'
                        ? 'bg-gold-50 text-gold-700'
                        : t.status === 'OPEN'
                          ? 'bg-brand-50 text-brand-600'
                          : 'bg-mist text-muted'
                  }`}
                >
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Marketplace pulse */}
        <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-brand-800">
            Marketplace — active listings
          </h2>
          <div className="space-y-2 text-sm">
            {listings.length === 0 && <p className="text-muted">No active listings.</p>}
            {listings.map((l) => (
              <div key={l.id} className="rounded-lg border border-line/70 px-3 py-2">
                <div className="text-ink">{l.title}</div>
                <div className="text-xs text-muted">
                  {l.partner.registryNo} · {l.category} · {l.region} · {l.interests.length} interested
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Voice of the network */}
      <section className="fade-up fade-up-4 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-brand-800">
          Voice of the network — new
        </h2>
        <div className="space-y-3">
          {suggestions.length === 0 && <p className="text-sm text-muted">Nothing new.</p>}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">
                    [{s.kind}] {s.partner.nameEn} · {s.partner.registryNo} ·{' '}
                    {s.createdAt.toISOString().slice(0, 10)}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-ink">{s.body}</p>
                </div>
                <form action={updateSuggestionStatus} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="suggestionId" value={s.id} />
                  <input
                    name="staffNote" placeholder="Reply to the partner…"
                    className="w-48 rounded-lg border border-line px-3 py-2 text-xs"
                  />
                  <select name="status" className="rounded-lg border border-line px-2 py-2 text-xs">
                    <option value="REVIEWED">Reviewed</option>
                    <option value="PLANNED">Planned</option>
                    <option value="DONE">Done</option>
                    <option value="DECLINED">Not planned</option>
                  </select>
                  <button className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600">
                    Save
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
