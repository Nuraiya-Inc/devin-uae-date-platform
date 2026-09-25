/**
 * Portal — quarterly reports: the partner's reporting history and the
 * chat-first path to completing the current one.
 */

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-mint-100 text-mint-700 border-mint-300',
  VALIDATED: 'bg-brand-50 text-brand-600 border-brand-200',
  SUBMITTED: 'bg-brand-50 text-brand-600 border-brand-200',
  DRAFT: 'bg-gold-50 text-gold-700 border-gold-300',
  RETURNED: 'bg-gold-100 text-gold-800 border-gold-400',
};

const STATUS_AR: Record<string, string> = {
  APPROVED: 'معتمد',
  VALIDATED: 'مُدقّق',
  SUBMITTED: 'مُقدّم',
  DRAFT: 'مسودة',
  RETURNED: 'بحاجة لتوضيح',
};

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({
    where: { userId: session.user.id },
    include: {
      reports: {
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
        include: { production: true, wasteRecords: true },
      },
    },
  });
  if (!partner) redirect('/dashboard');

  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  const year = now.getUTCFullYear();
  const hasCurrent = partner.reports.some((r) => r.year === year && r.quarter === q);

  return (
    <div className="space-y-5">
      <header className="fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-rule" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Quarterly reports</h1>
          <p className="text-sm text-muted">
            التقارير الربعية · Two approved quarters reach Active — four reach Certified.
          </p>
        </div>
        <Link
          href="/portal/chat"
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          {hasCurrent ? `Continue Q${q} ${year}` : `Start Q${q} ${year}`} with Abdullah →
        </Link>
      </header>

      <p className="fade-up fade-up-1 rounded-xl border border-line bg-cream px-4 py-3 text-xs leading-relaxed text-muted">
        Send Abdullah your figures any way you like — an Excel file in any layout, a photo of a
        paper ledger, a voice note, or just a message. He extracts everything, confirms it with
        you, and returns your regional benchmark the moment you submit. أرسل الأرقام كما يناسبك —
        ملف، صورة دفتر، أو رسالة صوتية.
      </p>

      <div className="space-y-3">
        {partner.reports.length === 0 && (
          <div className="fade-up fade-up-2 rounded-2xl border border-dashed border-line bg-white p-8 text-center">
            <div className="text-sm text-ink">No reports yet — your first one starts your climb.</div>
            <div className="mt-1 text-xs text-muted">
              أول تقرير يبدأ رحلتكم نحو العضوية النشطة
            </div>
          </div>
        )}
        {partner.reports.map((r, i) => {
          const waste = r.wasteRecords.reduce((a, w) => a + w.tons, 0);
          return (
            <div
              key={r.id}
              className={`fade-up rounded-2xl border border-line bg-white p-4 shadow-card`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-ink">
                    {r.year} · Q{r.quarter}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {r.production?.datesProducedTons != null
                      ? `${r.production.datesProducedTons.toLocaleString('en-US')} t production`
                      : 'production not recorded'}
                    {' · '}
                    {waste > 0 ? `${waste.toLocaleString('en-US')} t waste recorded` : 'no waste records'}
                    {r.confidenceScore != null && ` · confidence ${r.confidenceScore}`}
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${STATUS_STYLE[r.status] ?? ''}`}
                >
                  {r.status} · {STATUS_AR[r.status] ?? ''}
                </span>
              </div>
              {r.status === 'RETURNED' && r.validationNotes && (
                <p className="mt-3 rounded-lg bg-gold-50 p-3 text-xs leading-relaxed text-gold-800">
                  Abdullah has a couple of clarifying questions —{' '}
                  <Link href="/portal/chat" className="underline">
                    continue in chat
                  </Link>
                  .
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
