/**
 * Portal — announcements & seasons: network directives, advisories, events
 * (with RSVP), and the sector calendar.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { rsvp } from '@/lib/portal-actions';
import { UPN_FACTS } from '@/facts';

export const dynamic = 'force-dynamic';

const KIND_STYLE: Record<string, string> = {
  DIRECTIVE: 'border-brand-200 bg-brand-50 text-brand-700',
  ADVISORY: 'border-gold-300 bg-gold-50 text-gold-700',
  EVENT: 'border-mint-300 bg-mint-100 text-mint-700',
  SEASON: 'border-line bg-mist text-muted',
};

export default async function NewsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const announcements = await prisma.announcement.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 20,
    include: { rsvps: { where: { partnerId: partner.id } } },
  });

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Announcements</h1>
        <p className="text-sm text-muted">إعلانات الشبكة · Directives, advisories, and invitations.</p>
      </header>

      <div className="space-y-3">
        {announcements.length === 0 && (
          <p className="fade-up fade-up-1 text-sm text-muted">No announcements yet.</p>
        )}
        {announcements.map((a, i) => {
          const myRsvp = a.rsvps[0];
          return (
            <article
              key={a.id}
              className="fade-up rounded-2xl border border-line bg-white p-5 shadow-card"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${KIND_STYLE[a.kind] ?? ''}`}>
                  {a.kind}
                </span>
                <span className="text-[11px] text-muted">{a.publishedAt.toISOString().slice(0, 10)}</span>
                {a.eventDate && (
                  <span className="text-[11px] text-muted">· event {a.eventDate.toISOString().slice(0, 10)}</span>
                )}
              </div>
              <h2 className="mt-2 text-base font-semibold text-ink">{a.titleEn}</h2>
              <div className="text-sm text-brand-700" dir="rtl" lang="ar">{a.titleAr}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.bodyEn}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted" dir="rtl" lang="ar">{a.bodyAr}</p>

              {a.rsvpEnabled && (
                <div className="mt-3 flex items-center gap-2">
                  {myRsvp ? (
                    <span className="text-xs text-mint-700">
                      ✓ {myRsvp.attending ? 'Attending — نراكم هناك' : 'Declined'}
                    </span>
                  ) : (
                    <>
                      <form action={rsvp}>
                        <input type="hidden" name="announcementId" value={a.id} />
                        <input type="hidden" name="attending" value="yes" />
                        <button className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600">
                          Attend · سنحضر
                        </button>
                      </form>
                      <form action={rsvp}>
                        <input type="hidden" name="announcementId" value={a.id} />
                        <input type="hidden" name="attending" value="no" />
                        <button className="rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-ink">
                          Can&apos;t attend
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Season calendar */}
      <section className="fade-up fade-up-3 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="section-rule" aria-hidden />
        <h2 className="text-base font-semibold text-brand-800">The sector year</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {UPN_FACTS.engagement.seasonalCalendar.map((s) => (
            <div key={s.period} className="rounded-xl border border-line p-3">
              <div className="text-sm font-medium text-ink">{s.period}</div>
              <div className="text-xs leading-relaxed text-muted">{s.focus}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
