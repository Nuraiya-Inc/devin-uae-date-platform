/**
 * Portal — waste collection tickets: the two-sided circular-economy market.
 * Producers post what's ready for pickup; recyclers/collectors/factories in
 * the region claim it. Confirmed collections write MaterialTransfer edges —
 * national traceability as a side effect of a useful service.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { createTicket, claimTicket, confirmCollected } from '@/lib/portal-actions';

export const dynamic = 'force-dynamic';

const STREAM_LABELS: Record<string, string> = {
  FRONDS: 'Fronds · سعف',
  FROND_BASE: 'Frond bases · كرب',
  FIBER: 'Fibers · ليف',
  PITS: 'Date pits · نوى',
  DATES: 'Date losses · فاقد تمور',
  OTHER: 'Other · أخرى',
};

export default async function CollectionPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const isCollectorSide =
    partner.type === 'RECYCLER' || partner.type === 'COLLECTOR' || partner.type === 'FACTORY';

  const [myTickets, regionalOpen] = await Promise.all([
    prisma.collectionTicket.findMany({
      where: { OR: [{ partnerId: partner.id }, { claimedByPartnerId: partner.id }] },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { nameEn: true, registryNo: true, city: true } },
        claimedBy: { select: { nameEn: true, registryNo: true } },
      },
      take: 20,
    }),
    isCollectorSide
      ? prisma.collectionTicket.findMany({
          where: { status: 'OPEN', region: partner.region as never, partnerId: { not: partner.id } },
          orderBy: { createdAt: 'desc' },
          include: { partner: { select: { nameEn: true, city: true } } },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Waste collection</h1>
        <p className="text-sm text-muted">
          جمع نواتج النخيل · Post what&apos;s ready for pickup — registered recyclers in{' '}
          {partner.region} see it immediately. Every confirmed collection counts toward the
          national circular-economy record.
        </p>
      </header>

      {/* New ticket */}
      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-brand-800">Request a collection · طلب جمع</h2>
        <form action={createTicket} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Material
            </label>
            <select name="stream" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
              {Object.entries(STREAM_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Estimated quantity (tons)
            </label>
            <input
              name="estimatedTons" type="number" step="0.1" min="0.1" required placeholder="3.0"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Pickup location note
            </label>
            <input
              name="locationNote" placeholder="Gate 2, north field — after Asr"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Notes
            </label>
            <input
              name="notes" placeholder="Bundled and dry, loader available…"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Post ticket
            </button>
            <span className="ml-3 text-xs text-muted">or just tell Abdullah in chat</span>
          </div>
        </form>
      </section>

      {/* Open tickets nearby — collector side */}
      {isCollectorSide && (
        <section className="fade-up fade-up-2 rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-1 text-base font-semibold text-brand-800">
            Open in your region · متاح للجمع
          </h2>
          <p className="mb-4 text-xs text-muted">
            Feedstock ready for pickup in {partner.region}. Claiming shares your contact with the producer.
          </p>
          <div className="space-y-2">
            {regionalOpen.length === 0 && (
              <p className="text-sm text-muted">Nothing open right now — new tickets appear here instantly.</p>
            )}
            {regionalOpen.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div>
                  <div className="text-sm font-medium text-ink">
                    {STREAM_LABELS[t.stream] ?? t.stream} — {t.estimatedTons} t
                  </div>
                  <div className="text-xs text-muted">
                    {t.partner.nameEn}
                    {t.partner.city ? ` · ${t.partner.city}` : ''} ·{' '}
                    {t.createdAt.toISOString().slice(0, 10)}
                    {t.locationNote ? ` · ${t.locationNote}` : ''}
                  </div>
                </div>
                <form action={claimTicket}>
                  <input type="hidden" name="ticketId" value={t.id} />
                  <button className="rounded-lg bg-mint-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-mint-700">
                    Claim for collection
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My tickets */}
      <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-brand-800">Your tickets · تذاكركم</h2>
        <div className="space-y-2">
          {myTickets.length === 0 && <p className="text-sm text-muted">No tickets yet.</p>}
          {myTickets.map((t) => {
            const mine = t.partnerId === partner.id;
            return (
              <div key={t.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {STREAM_LABELS[t.stream] ?? t.stream} — {t.actualTons ?? t.estimatedTons} t
                      {!mine && <span className="ml-2 text-xs text-muted">(you are collecting)</span>}
                    </div>
                    <div className="text-xs text-muted">
                      {mine
                        ? t.claimedBy
                          ? `Claimed by ${t.claimedBy.nameEn} (${t.claimedBy.registryNo})`
                          : 'Waiting for a collector'
                        : `From ${t.partner.nameEn} (${t.partner.registryNo})`}
                      {' · '}
                      {t.createdAt.toISOString().slice(0, 10)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        t.status === 'OPEN'
                          ? 'border-brand-200 bg-brand-50 text-brand-600'
                          : t.status === 'CLAIMED'
                            ? 'border-gold-300 bg-gold-50 text-gold-700'
                            : t.status === 'COLLECTED'
                              ? 'border-mint-300 bg-mint-100 text-mint-700'
                              : 'border-line bg-mist text-muted'
                      }`}
                    >
                      {t.status}
                    </span>
                    {t.status === 'CLAIMED' && (
                      <form action={confirmCollected} className="flex items-center gap-1.5">
                        <input type="hidden" name="ticketId" value={t.id} />
                        <input
                          name="actualTons" type="number" step="0.1" min="0"
                          placeholder={`${t.estimatedTons}`}
                          className="w-20 rounded-lg border border-line px-2 py-1.5 text-xs"
                          title="Actual tons collected"
                        />
                        <button className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">
                          Confirm collected
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
