import Link from 'next/link';
import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      ownerAgent: { select: { slug: true, name: true } },
      _count: { select: { tasks: true, raidEntries: true, phases: true, milestones: true } },
      phases: {
        select: { id: true, name: true, ordering: true, ragStatus: true },
        orderBy: { ordering: 'asc' },
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">Programme</h1>
      <p className="text-sm text-forest-500 mb-6">
        Active projects and the phases that make them up. Click a project to drill into deliverables.
      </p>

      {projects.length === 0 ? (
        <div className="bg-white border border-forest-100 rounded-lg p-12 text-center text-forest-400 text-sm">
          No projects yet. The seed creates Safa Build-Out by default.
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.slug}`}
              className="block bg-white border border-forest-100 rounded-lg p-5 hover:border-amber transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-forest">{p.name}</h2>
                    <StatusChip s={p.status} />
                  </div>
                  {p.description && <p className="text-sm text-forest-600 max-w-3xl">{p.description}</p>}
                </div>
                <div className="text-right text-xs text-forest-400 flex-shrink-0">
                  <div>{p._count.tasks} tasks · {p._count.raidEntries} RAID</div>
                  {p.budget && (
                    <div className="mt-1">
                      Budget: {p.currency} {Number(p.budget).toLocaleString()}
                    </div>
                  )}
                  {p.startDate && p.targetEndDate && (
                    <div className="mt-1">{fmtDate(p.startDate)} → {fmtDate(p.targetEndDate)}</div>
                  )}
                </div>
              </div>

              {/* Phase strip */}
              <div className="flex gap-1 mt-3">
                {p.phases.map((ph) => (
                  <div
                    key={ph.id}
                    title={`Phase ${ph.ordering}: ${ph.name} (${ph.ragStatus})`}
                    className="flex-1 h-2 rounded"
                    style={{ background: ragColor(ph.ragStatus) }}
                  />
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {p.phases.map((ph) => (
                  <div key={ph.id} className="flex-1 text-[10px] text-forest-400 text-center font-mono truncate px-1">
                    P{ph.ordering}
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ragColor(rag: string): string {
  switch (rag) {
    // RAG status colours — kept universal for instant readability (green/amber/red),
    // but tuned to the Safa palette.
    case 'GREEN': return '#2C8255';   // brand mid-green
    case 'AMBER': return '#E1E32A';   // brand lime (stands in for amber)
    case 'RED':   return '#B33A1E';   // deep clay — readable as warning without clashing
    case 'UNSET':
    default:      return '#E5E8E2';   // brand line/neutral
  }
}

function StatusChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    PLANNING: 'bg-forest-50 text-forest-600',
    IN_FLIGHT: 'bg-amber/20 text-amber-700',
    AT_RISK: 'bg-terra/20 text-terra-700',
    BLOCKED: 'bg-terra text-white',
    COMPLETE: 'bg-green-100 text-green-800',
    ON_HOLD: 'bg-forest-100 text-forest-500',
  };
  return <span className={`text-xs px-2 py-0.5 rounded ${colors[s] ?? colors.PLANNING}`}>{s.replace('_', ' ')}</span>;
}
