/**
 * Directory entry detail — staff-only view of one value-chain entity.
 * Shows the full research record including the contact block and
 * safaRelevance, which must never surface on public/neutral pages (UPN-1).
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import { fmtDate } from '@/lib/utils';
import {
  STAGE_LABELS,
  PRIORITY_LABELS,
  CONFIDENCE_LABELS,
  RELATIONSHIP_LABELS,
  REGION_LABELS,
  CONFIDENCE_STYLES,
  RELATIONSHIP_STYLES,
} from '@/lib/directory-labels';

export const dynamic = 'force-dynamic';

export default async function DirectoryEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!hasAtLeast(session.user.role, 'TEAM_MEMBER')) redirect('/dashboard');

  const { id } = await params;
  const entry = await prisma.directoryEntry.findUnique({
    where: { id },
    include: { partner: { select: { registryNo: true, nameEn: true, tier: true } } },
  });
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="text-xs text-muted">
        <Link href="/directory" className="text-brand-600 underline-offset-2 hover:underline">
          ← Directory
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">{entry.nameEn}</h1>
        {entry.nameAr && <p className="text-lg text-muted">{entry.nameAr}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-line bg-mist px-2 py-0.5 text-brand-700">{STAGE_LABELS[entry.stage]}</span>
          <span className="rounded border border-line bg-mist px-2 py-0.5 text-brand-700">{entry.segment}</span>
          {entry.alsoRoles && (
            <span className="rounded border border-line bg-mist px-2 py-0.5 text-muted">also: {entry.alsoRoles}</span>
          )}
          <span className={`rounded border px-2 py-0.5 ${CONFIDENCE_STYLES[entry.confidence]}`}>
            {CONFIDENCE_LABELS[entry.confidence]} confidence
          </span>
          <span className={`rounded border px-2 py-0.5 ${RELATIONSHIP_STYLES[entry.relationship]}`}>
            {RELATIONSHIP_LABELS[entry.relationship]}
          </span>
          <span className="text-muted">{PRIORITY_LABELS[entry.priority]}</span>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl border border-line bg-white p-5 text-sm sm:grid-cols-2">
        <Field label="Emirate">{entry.region ? REGION_LABELS[entry.region] : entry.emirateLabel}</Field>
        {entry.location && <Field label="Location">{entry.location}</Field>}
        {entry.ownership && <Field label="Ownership">{entry.ownership}</Field>}
        <Field label="First mapped">{fmtDate(entry.createdAt)}</Field>
      </dl>

      {entry.description && (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-800">About</h2>
          <p className="whitespace-pre-wrap text-sm text-forest-700">{entry.description}</p>
        </section>
      )}

      {(entry.website || entry.phone || entry.email || entry.address) && (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-800">
            Contact <span className="font-normal text-muted">— staff only</span>
          </h2>
          <dl className="space-y-1.5 text-sm">
            {entry.website && (
              <Field label="Website">
                <a
                  href={entry.website.startsWith('http') ? entry.website : `https://${entry.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 underline-offset-2 hover:underline"
                >
                  {entry.website}
                </a>
              </Field>
            )}
            {entry.phone && <Field label="Phone">{entry.phone}</Field>}
            {entry.email && <Field label="Email">{entry.email}</Field>}
            {entry.address && <Field label="Address">{entry.address}</Field>}
          </dl>
        </section>
      )}

      {entry.safaRelevance && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
          <h2 className="mb-2 text-sm font-semibold text-gold-700">
            Safa BioWorks relevance <span className="font-normal text-muted">— internal, never public (UPN-1)</span>
          </h2>
          <p className="whitespace-pre-wrap text-sm text-forest-700">{entry.safaRelevance}</p>
        </section>
      )}

      {entry.sources.length > 0 && (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-800">Sources</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-forest-700">
            {entry.sources.map((s, i) =>
              /^https?:\/\//.test(s) ? (
                <li key={i}>
                  <a href={s} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline-offset-2 hover:underline">
                    {s}
                  </a>
                </li>
              ) : (
                <li key={i}>{s}</li>
              ),
            )}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-brand-800">Network status</h2>
        {entry.partner ? (
          <p className="text-forest-700">
            Registered as partner{' '}
            <span className="font-mono text-xs">{entry.partner.registryNo}</span> — {entry.partner.nameEn} (
            {entry.partner.tier}). This entry now counts in partner aggregates via its Partner record.
          </p>
        ) : (
          <p className="text-muted">
            Not a registered partner — excluded from all partner aggregates (UPN-7). Promotion is a staff action
            (TD4); tier/certification changes follow the approvals queue (UPN-2).
          </p>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-forest-700">{children}</dd>
    </div>
  );
}
