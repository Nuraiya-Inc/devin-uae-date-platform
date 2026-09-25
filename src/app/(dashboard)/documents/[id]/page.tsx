import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userCanReadDocument } from '@/lib/access';
import { fmtDate } from '@/lib/utils';
import DivergencePanel from './DivergencePanel';

export const dynamic = 'force-dynamic';

const BRANCH_LABEL: Record<string, string> = {
  EXECUTIVE: 'Executive',
  FINANCE: 'Finance',
  TECHNOLOGY: 'Technology',
  COMMERCIAL: 'Commercial',
  MARKETING: 'Marketing & Comms',
  OPERATIONS: 'Operations',
};

const SENSITIVITY_AGENT_HINT: Record<string, string> = {
  PUBLIC: 'All agents can read this.',
  INTERNAL: 'All active agents can read this.',
  COMMERCIAL_SENSITIVE: 'Only Commercial branch agents (CCO + COMM-*) + Executive branch can read this.',
  IP_CRITICAL: 'Only Technology branch agents (CTO + TECH-*) + Executive branch can read this.',
  INVESTOR_RESTRICTED: 'Only Finance branch agents (CFO + FIN-*) + Executive branch can read this.',
};

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      uploader: { select: { name: true, email: true } },
      project: { select: { slug: true, name: true } },
    },
  });
  if (!doc) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { reportsToAgent: { select: { branch: true } } },
  });
  if (!dbUser) redirect('/signin');

  const allowed = userCanReadDocument(
    { role: dbUser.role, entity: dbUser.entity, canAccessAllEntities: dbUser.canAccessAllEntities },
    dbUser.reportsToAgent?.branch ?? null,
    { ipSensitivity: doc.ipSensitivity, entity: doc.entity, allowedBranches: doc.allowedBranches },
  );

  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <Link href="/documents" className="text-sm text-terra-600 underline mb-2 inline-block">← Back to documents</Link>
        <h1 className="text-xl font-semibold text-forest mb-2">Access restricted</h1>
        <p className="text-sm text-forest-600">
          You don't have permission to read this document. Sensitivity: <code>{doc.ipSensitivity}</code> · Entity: <code>{doc.entity}</code>.
          Ask the uploader or your line manager to grant access.
        </p>
      </div>
    );
  }

  // Which agents can read it (preview list)
  const allAgents = await prisma.agent.findMany({
    where: { isActive: true },
    select: { slug: true, name: true, branch: true, tier: true },
    orderBy: [{ tier: 'asc' }, { branch: 'asc' }, { slug: 'asc' }],
  });
  const agentsThatCanRead = allAgents.filter((a) => {
    if (a.branch === 'EXECUTIVE') return true;
    if (doc.allowedBranches.includes(a.branch)) return true;
    switch (doc.ipSensitivity) {
      case 'PUBLIC':
      case 'INTERNAL':
        return true;
      case 'COMMERCIAL_SENSITIVE':
        return a.branch === 'COMMERCIAL';
      case 'IP_CRITICAL':
        return a.branch === 'TECHNOLOGY';
      case 'INVESTOR_RESTRICTED':
        return a.branch === 'FINANCE';
      default:
        return false;
    }
  });

  return (
    <div className="max-w-3xl">
      <Link href="/documents" className="text-sm text-terra-600 underline mb-2 inline-block">← Back to documents</Link>

      <div className="bg-white border border-forest-100 rounded-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <KindChip k={doc.kind} />
              <SensitivityChip s={doc.ipSensitivity} />
              <EntityChip e={doc.entity} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-forest mb-1 leading-tight">{doc.title}</h1>
            {doc.aiAnalysisPending && (
              <div className="text-xs text-amber-700 mt-1 inline-block bg-amber/10 px-2 py-0.5 rounded animate-pulse">
                AI is classifying — refresh in a moment
              </div>
            )}
            {doc.aiSummary && !doc.aiAnalysisPending && (
              <div className="mt-2 p-3 bg-cream/60 border-l-2 border-amber rounded">
                <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold mb-0.5">
                  AI summary
                </div>
                <div className="text-sm text-forest-700">{doc.aiSummary}</div>
                {doc.aiAnalyzedAt && (
                  <div className="text-[10px] text-forest-400 mt-1">
                    classified {doc.aiAnalyzedAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </div>
                )}
              </div>
            )}
            {doc.notes && <p className="text-sm text-forest-700 whitespace-pre-wrap mt-2">{doc.notes}</p>}
            {doc.tags.length > 0 && (
              <div className="mt-2 text-xs text-forest-500 flex gap-2 flex-wrap">
                {doc.tags.map((t) => <span key={t} className="bg-cream px-2 py-0.5 rounded">#{t}</span>)}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a
              href={`/api/documents/${doc.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none text-center px-4 py-2 rounded text-white text-sm font-medium"
              style={{ background: '#004923' }}
              title="Open in a new tab (renders inline for PDFs and images)"
            >
              Open ↗
            </a>
            <a
              href={`/api/documents/${doc.id}/file?download=1`}
              className="flex-1 sm:flex-none text-center px-4 py-2 rounded text-sm font-medium border border-brand-200 text-brand hover:bg-cream"
              title="Force download to your computer"
            >
              Download
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-4 border-t border-forest-100">
          <MetaItem label="Uploaded by" value={doc.uploader.name} />
          <MetaItem label="Uploaded" value={fmtDate(doc.createdAt)} />
          <MetaItem label="Size" value={fmtSize(doc.sizeBytes)} />
          <MetaItem label="Type" value={doc.mimeType ?? 'unknown'} mono />
          {doc.project && <MetaItem label="Project" value={doc.project.name} />}
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-forest uppercase tracking-wide mb-2">Read access</h2>
        <div className="bg-white border border-forest-100 rounded-lg p-4">
          <p className="text-sm text-forest-700 mb-2">
            {SENSITIVITY_AGENT_HINT[doc.ipSensitivity] ?? ''}
          </p>
          {doc.allowedBranches.length > 0 && (
            <p className="text-sm text-forest-700 mb-3">
              Additionally allowed branches:{' '}
              {doc.allowedBranches.map((b) => (
                <span key={b} className="inline-block bg-amber/10 text-amber-700 px-2 py-0.5 rounded text-xs font-mono mr-1">
                  {BRANCH_LABEL[b] ?? b}
                </span>
              ))}
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-forest-500 hover:text-forest-700">
              Show {agentsThatCanRead.length} agent{agentsThatCanRead.length === 1 ? '' : 's'} that can read this
            </summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1">
              {agentsThatCanRead.map((a) => (
                <div key={a.slug} className="text-forest-600">
                  <span className="font-mono text-forest-500">{a.slug}</span> · {a.name.split(' ')[0]}
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>

      {/* Layla's opinion-pushback section — server-rendered, surfaces
          whenever she has logged a flag_opinion_pushback against this doc.
          Visible BEFORE the divergence panel because pushback is a strategic
          objection from the chief-of-staff, not a tone/fact nit. */}
      <PushbackSection documentId={doc.id} />

      <DivergencePanel documentId={doc.id} />

      <div className="p-4 bg-brand-50 border border-brand-100 rounded text-sm text-forest-700">
        <strong>Agent access:</strong> agents can read this document's contents via the <code>read_document</code> tool — in chat and in autonomous runs — subject to the IP-sensitivity rules above. AI classification runs automatically at upload. ✓
      </div>
    </div>
  );
}

/**
 * Server-rendered list of Layla's opinion-pushback flags against this
 * document. Queries ActivityEvent (kind = OPINION_PUSHBACK), most recent
 * first, up to 5. Hidden entirely when none exist so the doc page stays
 * clean for shipments Layla agreed with.
 */
async function PushbackSection({ documentId }: { documentId: string }) {
  const events = await prisma.activityEvent.findMany({
    where: {
      kind: 'OPINION_PUSHBACK',
      entityType: 'Document',
      entityId: documentId,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      actorAgent: { select: { slug: true, name: true } },
    },
  });

  if (events.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-forest uppercase tracking-wide mb-2 flex items-center gap-2">
        <span className="text-red-600">🚩</span>
        Layla&apos;s pushback ({events.length})
      </h2>
      <div className="space-y-2.5">
        {events.map((e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload = (e.payload as any) ?? {};
          const sevClass =
            e.severity === 'CRITICAL'
              ? 'border-red-300 bg-red-50'
              : e.severity === 'WARNING'
                ? 'border-amber-300 bg-amber-50'
                : 'border-line bg-white';
          return (
            <div key={e.id} className={`border rounded-lg p-4 ${sevClass}`}>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${
                    e.severity === 'CRITICAL'
                      ? 'bg-red-600 text-white'
                      : e.severity === 'WARNING'
                        ? 'bg-amber-600 text-white'
                        : 'bg-mist text-muted'
                  }`}
                >
                  {e.severity}
                </span>
                <span className="text-xs text-muted">
                  {e.actorAgent?.name ?? 'Layla'} →{' '}
                  <span className="font-mono">{payload.targetAgentSlug ?? '?'}</span>
                </span>
                <span className="text-[10px] text-muted ml-auto">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm font-medium text-ink mb-1.5 leading-snug">
                {payload.headline ?? e.title}
              </div>
              {payload.reasoning && (
                <p className="text-sm text-ink/80 mb-2 leading-relaxed whitespace-pre-wrap">
                  {payload.reasoning}
                </p>
              )}
              {payload.suggestedAction && (
                <div className="text-xs text-ink bg-white border border-line/60 rounded-md p-2.5 mt-2">
                  <span className="text-muted font-medium uppercase tracking-wide text-[10px] mr-1.5">
                    Suggested action:
                  </span>
                  {payload.suggestedAction}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-forest-400 text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-forest-700 mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function KindChip({ k }: { k: string }) {
  return <span className="text-xs px-2 py-0.5 rounded bg-forest-100 text-forest-700 font-mono">{k.replace('_', ' ')}</span>;
}

function SensitivityChip({ s }: { s: string }) {
  const colors: Record<string, string> = {
    PUBLIC: 'bg-green-50 text-green-700',
    INTERNAL: 'bg-forest-50 text-forest-600',
    COMMERCIAL_SENSITIVE: 'bg-amber/20 text-amber-700',
    IP_CRITICAL: 'bg-terra/20 text-terra-700',
    INVESTOR_RESTRICTED: 'bg-amber/20 text-amber-800',
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${colors[s] ?? 'bg-forest-50'}`}>{s.replace('_', ' ')}</span>;
}

function EntityChip({ e }: { e: string }) {
  const colors: Record<string, string> = {
    FZE: 'bg-forest-50 text-forest-700',
    INC: 'bg-forest-50 text-forest-700',
    GROUP: 'bg-forest-100 text-forest-700',
    CHEMPLAX: 'bg-terra text-white',
  };
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${colors[e] ?? 'bg-forest-50'}`}>{e}</span>;
}

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
