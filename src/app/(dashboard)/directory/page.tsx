/**
 * Value-chain directory — Safa BioWorks' researched network map (staff only).
 *
 * DirectoryEntry is NOT a Partner: these rows never feed participation
 * rates, benchmarks, or sector aggregates (UPN-7). Contact details and
 * safaRelevance are internal context — this page is gated to staff
 * (TEAM_MEMBER and above) and never linked from partner/public surfaces.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import {
  Prisma,
  ValueChainStage,
  DirectoryPriority,
  ConfidenceLevel,
  RelationshipStatus,
  Region,
} from '@prisma/client';
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

type Params = {
  q?: string;
  stage?: string;
  region?: string;
  priority?: string;
  confidence?: string;
  relationship?: string;
};

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!hasAtLeast(session.user.role, 'TEAM_MEMBER')) redirect('/dashboard');

  const sp = await searchParams;

  const where: Prisma.DirectoryEntryWhereInput = {};
  if (sp.stage && (Object.values(ValueChainStage) as string[]).includes(sp.stage)) {
    where.stage = sp.stage as ValueChainStage;
  }
  if (sp.region) {
    if (sp.region === 'UNSPECIFIED') {
      where.region = null;
    } else if ((Object.values(Region) as string[]).includes(sp.region)) {
      where.region = sp.region as Region;
    }
  }
  if (sp.priority && (Object.values(DirectoryPriority) as string[]).includes(sp.priority)) {
    where.priority = sp.priority as DirectoryPriority;
  }
  if (sp.confidence && (Object.values(ConfidenceLevel) as string[]).includes(sp.confidence)) {
    where.confidence = sp.confidence as ConfidenceLevel;
  }
  if (sp.relationship && (Object.values(RelationshipStatus) as string[]).includes(sp.relationship)) {
    where.relationship = sp.relationship as RelationshipStatus;
  }
  const q = sp.q?.trim();
  if (q) {
    where.OR = ['nameEn', 'nameAr', 'segment', 'emirateLabel', 'location', 'description'].map((f) => ({
      [f]: { contains: q, mode: 'insensitive' as const },
    }));
  }

  const entries = await prisma.directoryEntry.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { confidence: 'asc' }, { nameEn: 'asc' }],
    take: 500,
  });

  const total = await prisma.directoryEntry.count();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Value-Chain Directory</h1>
        <p className="text-sm text-muted">
          دليل سلسلة القيمة — {entries.length} of {total} entries · researched network map, not registered partners —
          nothing here counts in sector aggregates until promoted.
        </p>
      </div>

      {/* Search — GET form preserves active filters as hidden params */}
      <form action="/directory" method="get" className="flex gap-2">
        {(['stage', 'region', 'priority', 'confidence', 'relationship'] as const).map(
          (k) => sp[k] && <input key={k} type="hidden" name={k} value={sp[k]} />,
        )}
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search name, segment, emirate, location…"
          className="w-full max-w-md rounded-lg border border-line bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Search
        </button>
      </form>

      <div className="space-y-2 text-xs">
        <FilterRow
          label="Stage"
          param="stage"
          sp={sp}
          options={Object.values(ValueChainStage).map((v) => ({ value: v, label: STAGE_LABELS[v] }))}
        />
        <FilterRow
          label="Emirate"
          param="region"
          sp={sp}
          options={[
            ...Object.values(Region).map((v) => ({ value: v, label: REGION_LABELS[v] })),
            { value: 'UNSPECIFIED', label: 'Multi / unspecified' },
          ]}
        />
        <FilterRow
          label="Priority"
          param="priority"
          sp={sp}
          options={Object.values(DirectoryPriority).map((v) => ({ value: v, label: PRIORITY_LABELS[v] }))}
        />
        <FilterRow
          label="Confidence"
          param="confidence"
          sp={sp}
          options={Object.values(ConfidenceLevel).map((v) => ({ value: v, label: CONFIDENCE_LABELS[v] }))}
        />
        <FilterRow
          label="Relationship"
          param="relationship"
          sp={sp}
          options={Object.values(RelationshipStatus).map((v) => ({ value: v, label: RELATIONSHIP_LABELS[v] }))}
        />
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-12 text-center text-sm text-muted">
          No directory entries match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="p-3">Name</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Segment</th>
                <th className="p-3">Emirate</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Relationship</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-line/70 hover:bg-mist/50">
                  <td className="p-3">
                    <Link href={`/directory/${e.id}`} className="text-brand-700 underline-offset-2 hover:underline">
                      {e.nameEn}
                    </Link>
                    {e.nameAr && <span className="text-muted"> · {e.nameAr}</span>}
                  </td>
                  <td className="p-3">{STAGE_LABELS[e.stage]}</td>
                  <td className="p-3">
                    {e.segment}
                    {e.alsoRoles && <span className="text-muted"> + {e.alsoRoles}</span>}
                  </td>
                  <td className="p-3">{e.region ? REGION_LABELS[e.region] : e.emirateLabel}</td>
                  <td className="p-3">{PRIORITY_LABELS[e.priority]}</td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-xs ${CONFIDENCE_STYLES[e.confidence]}`}>
                      {CONFIDENCE_LABELS[e.confidence]}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-xs ${RELATIONSHIP_STYLES[e.relationship]}`}>
                      {RELATIONSHIP_LABELS[e.relationship]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted">
        Internal directory — contact details and Safa relevance are staff-only and never appear on public surfaces
        (impact map, showcase). Promoting an entry to a registered partner is done from the entry&apos;s detail page.
      </p>
    </div>
  );
}

function FilterRow({
  label,
  param,
  sp,
  options,
}: {
  label: string;
  param: keyof Params;
  sp: Params;
  options: { value: string; label: string }[];
}) {
  const build = (value: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== param) params.set(k, v);
    }
    if (value) params.set(param, value);
    const qs = params.toString();
    return qs ? `/directory?${qs}` : '/directory';
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-24 text-muted">{label}:</span>
      <FilterLink label="All" href={build('')} active={!sp[param]} />
      {options.map((o) => (
        <FilterLink key={o.value} label={o.label} href={build(o.value)} active={sp[param] === o.value} />
      ))}
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-2 py-1 ${active ? 'bg-brand-600 text-white' : 'bg-mist text-brand-700 hover:bg-brand-50'}`}
    >
      {label}
    </Link>
  );
}
