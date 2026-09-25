/**
 * Partner registry — network console view.
 * Every partner, their tier, standing, and reporting recency.
 */

import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TIER_STYLES: Record<string, string> = {
  ELITE: 'bg-amber-400/15 text-gold-700 border-amber-400/30',
  CERTIFIED: 'bg-mint-100 text-mint-700 border-mint-300',
  ACTIVE: 'bg-brand-50 text-brand-600 border-brand-200',
  REGISTERED: 'bg-mist text-muted border-line',
};

const STANDING_STYLES: Record<string, string> = {
  GOOD: 'text-mint-700',
  AT_RISK: 'text-gold-600',
  PAUSED: 'text-red-600',
};

export default async function PartnersPage() {
  const partners = await prisma.partner.findMany({
    orderBy: [{ region: 'asc' }, { registryNo: 'asc' }],
    include: {
      reports: {
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
        take: 1,
        select: { year: true, quarter: true, status: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Partner Registry</h1>
        <p className="text-sm text-muted">
          السجل الوطني للشركاء — {partners.length} partner{partners.length === 1 ? '' : 's'} · standing is held, not
          owned
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="p-3">Registry no.</th>
              <th className="p-3">Name</th>
              <th className="p-3">Type</th>
              <th className="p-3">Region</th>
              <th className="p-3">Tier</th>
              <th className="p-3">Standing</th>
              <th className="p-3">Last report</th>
              <th className="p-3">Certificate</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const last = p.reports[0];
              return (
                <tr key={p.id} className="border-t border-line/70">
                  <td className="p-3 font-mono text-xs">{p.registryNo}</td>
                  <td className="p-3">
                    {p.nameEn}
                    {p.nameAr && <span className="text-muted"> · {p.nameAr}</span>}
                    {p.foundingMember && (
                      <span className="ml-2 rounded border border-amber-400/40 px-1 text-[10px] uppercase text-gold-600">
                        Founding
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {p.type}
                    {p.sizeClass ? ` · ${p.sizeClass}` : ''}
                  </td>
                  <td className="p-3">{p.region}</td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-xs ${TIER_STYLES[p.tier] ?? ''}`}>{p.tier}</span>
                  </td>
                  <td className={`p-3 ${STANDING_STYLES[p.standing] ?? ''}`}>{p.standing}</td>
                  <td className="p-3 text-muted">
                    {last ? `${last.year} Q${last.quarter} · ${last.status}` : 'never reported'}
                  </td>
                  <td className="p-3">
                    <a
                      href={`/api/certificates/${p.id}`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs text-brand-600 underline-offset-2 hover:underline"
                    >
                      PDF ↓
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Tier changes and public registry updates require official approval (see the Approvals queue). Partners are
        onboarded by Abdullah — start a conversation in Agents → Abdullah.
      </p>
    </div>
  );
}
