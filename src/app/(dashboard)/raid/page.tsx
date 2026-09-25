import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RaidPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string; severity?: string }>;
}) {
  const sp = await searchParams;

  const where: Record<string, unknown> = {};
  if (sp.status) where.status = sp.status;
  if (sp.kind) where.kind = sp.kind;
  if (sp.severity) where.severity = sp.severity;

  const entries = await prisma.raidEntry.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    include: {
      ownerAgent: { select: { slug: true, name: true } },
      raisedByAgent: { select: { slug: true } },
    },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">RAID Register</h1>
      <p className="text-sm text-forest-500 mb-6">
        Risks · Assumptions · Issues · Dependencies. Reviewed at the heartbeat per item; severity HIGH/CRITICAL requires mitigation.
      </p>

      <div className="flex gap-2 mb-4 text-xs">
        <span className="text-forest-500 self-center">Kind:</span>
        <FilterLink label="All" param="kind" value="" current={sp.kind} />
        <FilterLink label="Risk" param="kind" value="RISK" current={sp.kind} />
        <FilterLink label="Issue" param="kind" value="ISSUE" current={sp.kind} />
        <FilterLink label="Assumption" param="kind" value="ASSUMPTION" current={sp.kind} />
        <FilterLink label="Dependency" param="kind" value="DEPENDENCY" current={sp.kind} />
        <span className="text-forest-500 self-center ml-3">Severity:</span>
        <FilterLink label="All" param="severity" value="" current={sp.severity} />
        <FilterLink label="Critical" param="severity" value="CRITICAL" current={sp.severity} />
        <FilterLink label="High" param="severity" value="HIGH" current={sp.severity} />
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-lg border border-forest-100 p-12 text-center text-forest-400 text-sm">
          No RAID entries match these filters.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-forest-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <KindChip k={r.kind} />
                <SeverityChip s={r.severity} />
                <StatusChip s={r.status} />
                <span className="ml-auto text-xs text-forest-400 font-mono">owner: {r.ownerAgent?.slug ?? '—'}</span>
              </div>
              <h3 className="font-medium text-forest mb-1">{r.title}</h3>
              {r.description && <p className="text-sm text-forest-600 mb-2">{r.description}</p>}
              {r.mitigation && (
                <div className="text-xs bg-cream/60 border border-amber/30 rounded p-2 mt-2">
                  <span className="text-amber-700 font-semibold">Mitigation:</span>{' '}
                  <span className="text-forest-700">{r.mitigation}</span>
                </div>
              )}
              <div className="text-xs text-forest-400 mt-2 flex gap-4">
                <span>Created: {fmtDate(r.createdAt)}</span>
                {r.reviewAt && <span>Next review: {fmtDate(r.reviewAt)}</span>}
                {r.raisedByAgent && <span>Raised by: <code>{r.raisedByAgent.slug}</code></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterLink({ label, param, value, current }: { label: string; param: string; value: string; current?: string }) {
  const active = (current ?? '') === value;
  const href = value ? `/raid?${param}=${encodeURIComponent(value)}` : '/raid';
  return (
    <a
      href={href}
      className={`px-2 py-1 rounded ${active ? 'bg-forest text-white' : 'bg-cream text-forest-600 hover:bg-forest-100'}`}
    >
      {label}
    </a>
  );
}

function KindChip({ k }: { k: string }) {
  return <span className="text-xs px-2 py-0.5 rounded bg-forest-100 text-forest-700 font-mono">{k}</span>;
}

function SeverityChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-terra text-white',
    HIGH: 'bg-amber text-white',
    MEDIUM: 'bg-forest-100 text-forest-700',
    LOW: 'bg-forest-50 text-forest-500',
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${colors[s] ?? colors.MEDIUM}`}>{s}</span>;
}

function StatusChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    OPEN: 'bg-terra/20 text-terra-700',
    MITIGATING: 'bg-amber/20 text-amber-700',
    CLOSED: 'bg-green-50 text-green-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${colors[s] ?? 'bg-forest-50'}`}>{s}</span>;
}
