/**
 * Portal — spot marketplace (matchmaking only, no payments in v1).
 * Surplus dates and byproducts listed; interested partners raise a hand and
 * Network-verified contact details are exchanged.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { createListing, expressInterest, closeListing } from '@/lib/portal-actions';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  DATES: 'Dates · تمور',
  PITS: 'Pits · نوى',
  FRONDS: 'Fronds · سعف',
  FROND_BASE: 'Frond bases · كرب',
  FIBER: 'Fibers · ليف',
  COMPOST: 'Compost · سماد',
  PRODUCTS: 'Products · منتجات',
  OTHER: 'Other · أخرى',
};

export default async function MarketPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const [listings, mine] = await Promise.all([
    prisma.listing.findMany({
      where: { status: 'ACTIVE', partnerId: { not: partner.id } },
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { nameEn: true, region: true, tier: true } },
        interests: { where: { partnerId: partner.id }, select: { id: true } },
      },
      take: 30,
    }),
    prisma.listing.findMany({
      where: { partnerId: partner.id },
      orderBy: { createdAt: 'desc' },
      include: {
        interests: {
          include: { partner: { select: { nameEn: true, registryNo: true, contactPhone: true, contactEmail: true } } },
        },
      },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Marketplace</h1>
        <p className="text-sm text-muted">
          السوق · Surplus dates and byproducts, member to member. The network verifies identities;
          the transaction itself stays between you.
        </p>
      </header>

      {/* New listing */}
      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-brand-800">List something · عرض للبيع</h2>
        <form action={createListing} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Title
            </label>
            <input
              name="title" required placeholder="Surplus Sukkari — export grade B, 4 tons"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              Category
            </label>
            <select name="category" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
                Qty (tons)
              </label>
              <input name="qtyTons" type="number" step="0.1" placeholder="4.0"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
                Asking (AED)
              </label>
              <input name="askPriceAed" type="number" step="1" placeholder="negotiable"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600">
              Publish listing
            </button>
          </div>
        </form>
      </section>

      {/* Browse */}
      <section className="fade-up fade-up-2">
        <h2 className="mb-3 text-base font-semibold text-brand-800">Open listings · العروض</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {listings.length === 0 && (
            <p className="text-sm text-muted">No open listings right now.</p>
          )}
          {listings.map((l) => (
            <div key={l.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-ink">{l.title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {CATEGORY_LABELS[l.category] ?? l.category} · {l.partner.nameEn} · {l.region}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] text-brand-600">
                  {l.partner.tier}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted">
                {l.qtyTons ? `${l.qtyTons} t` : 'quantity on request'} ·{' '}
                {l.askPriceAed ? `AED ${l.askPriceAed.toLocaleString('en-US')}` : 'price negotiable'}
              </div>
              <form action={expressInterest} className="mt-3">
                <input type="hidden" name="listingId" value={l.id} />
                {l.interests.length > 0 ? (
                  <span className="text-xs text-mint-700">✓ Interest sent — the seller sees your contact details</span>
                ) : (
                  <button className="rounded-lg bg-gold-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-gold-600">
                    I&apos;m interested · مهتم
                  </button>
                )}
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* My listings */}
      <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-4 text-base font-semibold text-brand-800">Your listings · عروضكم</h2>
        <div className="space-y-3">
          {mine.length === 0 && <p className="text-sm text-muted">Nothing listed yet.</p>}
          {mine.map((l) => (
            <div key={l.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-ink">{l.title}</span>
                  <span className="ml-2 text-xs text-muted">{l.status}</span>
                </div>
                {l.status === 'ACTIVE' && (
                  <form action={closeListing}>
                    <input type="hidden" name="listingId" value={l.id} />
                    <button className="text-xs text-muted underline hover:text-ink">Close listing</button>
                  </form>
                )}
              </div>
              {l.interests.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg bg-mist p-2.5 text-xs">
                  <div className="font-medium text-ink">
                    {l.interests.length} interested member{l.interests.length === 1 ? '' : 's'}:
                  </div>
                  {l.interests.map((i) => (
                    <div key={i.id} className="text-muted">
                      {i.partner.nameEn} ({i.partner.registryNo})
                      {i.partner.contactPhone ? ` · ${i.partner.contactPhone}` : ''}
                      {i.partner.contactEmail ? ` · ${i.partner.contactEmail}` : ''}
                      {i.message ? ` — “${i.message}”` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
