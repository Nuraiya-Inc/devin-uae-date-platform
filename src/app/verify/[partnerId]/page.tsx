/**
 * PUBLIC certificate verification — /verify/[partnerId].
 * Unauthenticated by design: scanning the QR on a certificate resolves here
 * and confirms standing against the live registry. Shows ONLY public facts
 * (name, registry no, tier, standing, region) — never figures.
 */

import { prisma } from '@/lib/db';
import Logo from '@/components/brand/Logo';

export const dynamic = 'force-dynamic';

const TIER_AR: Record<string, string> = {
  REGISTERED: 'عضو مسجّل',
  ACTIVE: 'عضو نشط',
  CERTIFIED: 'شريك معتمد',
  ELITE: 'شريك نخبة',
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: {
      registryNo: true, nameEn: true, nameAr: true, tier: true, standing: true,
      region: true, foundingMember: true, createdAt: true,
    },
  });

  const valid = !!partner && partner.standing !== 'PAUSED';

  return (
    <main className="min-h-screen" style={{ background: '#F4F1EA' }}>
      <div className="gold-bar w-full" aria-hidden />
      <div className="mx-auto max-w-lg px-5 py-12">
        <div className="mb-8 flex justify-center">
          <Logo width={210} priority />
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card-hover">
          <div
            className={`px-6 py-4 text-center text-white ${valid ? '' : ''}`}
            style={{ background: valid ? 'linear-gradient(135deg, #0C3B43, #124E57)' : '#6E7A78' }}
          >
            <div className="text-2xl font-semibold">
              {partner ? (valid ? '✓ Verified · موثّق' : 'Standing paused · العضوية موقوفة') : 'Not found · غير موجود'}
            </div>
            <div className="mt-1 text-xs text-white/75">
              Official verification by the National Center for Palms and Dates
            </div>
            {valid && (
              <div className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-white/90">
                <span style={{ color: '#D5B672' }}>◉</span>
                Annual seal {new Date().getUTCFullYear()} · valid through 31 Dec — renewed by quarterly reporting
              </div>
            )}
          </div>

          {partner ? (
            <div className="space-y-4 p-6">
              <div className="text-center">
                <div className="text-xl font-semibold text-ink">{partner.nameEn}</div>
                {partner.nameAr && <div className="text-brand-700">{partner.nameAr}</div>}
                <div className="mt-1 font-mono text-xs text-muted">{partner.registryNo}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-xl bg-mist p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Membership</div>
                  <div className="font-semibold text-ink">{partner.tier}</div>
                  <div className="text-xs text-brand-700">{TIER_AR[partner.tier]}</div>
                </div>
                <div className="rounded-xl bg-mist p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted">Region</div>
                  <div className="font-semibold text-ink">{partner.region}</div>
                  <div className="text-xs text-muted">member since {partner.createdAt.getUTCFullYear()}</div>
                </div>
              </div>
              {partner.foundingMember && (
                <div className="rounded-xl border border-gold-300 bg-gold-50 px-4 py-2 text-center text-sm text-gold-700">
                  ★ Founding Member · عضو مؤسس
                </div>
              )}
              <p className="text-center text-[11px] leading-relaxed text-muted">
                This page confirms current membership standing in the UAE Palm Network. It shows
                no commercial data. تؤكد هذه الصفحة حالة العضوية فقط.
              </p>
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted">
              No partner matches this certificate. If you believe this is an error, contact the
              Center. لا يوجد شريك مطابق لهذه الشهادة.
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted">
          UAE Palm Network · United Arab Emirates
        </p>
      </div>
    </main>
  );
}
