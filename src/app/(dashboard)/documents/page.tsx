import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userCanReadDocument } from '@/lib/access';
import { fmtDate } from '@/lib/utils';
import { clearStuckPending } from '@/lib/document-analysis';
import UploadDocumentForm from './UploadDocumentForm';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; sensitivity?: string; project?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  // Self-heal: clear any docs stuck in aiAnalysisPending state >5 min ago
  // (typically caused by container restarts mid-analysis). Cheap, idempotent.
  await clearStuckPending(5).catch(() => undefined);

  const sp = await searchParams;

  const where: Record<string, unknown> = {};
  if (sp.kind) where.kind = sp.kind;
  if (sp.sensitivity) where.ipSensitivity = sp.sensitivity;
  if (sp.project) {
    const proj = await prisma.project.findUnique({ where: { slug: sp.project } });
    if (proj) where.projectId = proj.id;
  }

  const [docs, projects, dbUser] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { name: true, email: true } },
        project: { select: { slug: true, name: true } },
      },
      take: 300,
    }),
    prisma.project.findMany({ select: { slug: true, name: true } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { reportsToAgent: { select: { branch: true } } },
    }),
  ]);

  if (!dbUser) redirect('/signin');

  const visible = docs.filter((d) =>
    userCanReadDocument(
      { role: dbUser.role, entity: dbUser.entity, canAccessAllEntities: dbUser.canAccessAllEntities },
      dbUser.reportsToAgent?.branch ?? null,
      { ipSensitivity: d.ipSensitivity, entity: d.entity, allowedBranches: d.allowedBranches },
    ),
  );
  const hidden = docs.length - visible.length;

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-semibold text-forest">Documents</h1>
      </div>
      <p className="text-sm text-forest-500 mb-6">
        Upload artefacts (decks, contracts, models, dossiers, SOPs) and tag them so the right agents can read them.
        All file types accepted. 25 MB per file.
      </p>

      <div className="bg-white border border-forest-100 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-forest uppercase tracking-wide mb-3">Upload new</h2>
        <UploadDocumentForm projects={projects} />
      </div>

      {projects.length > 0 && (
        <div className="flex gap-2 mb-3 text-xs flex-wrap">
          <span className="text-muted self-center">Project:</span>
          <FilterLink label="All" param="project" value="" current={sp.project} />
          {projects.map((p) => (
            <FilterLink key={p.slug} label={p.name} param="project" value={p.slug} current={sp.project} />
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-4 text-xs flex-wrap">
        <span className="text-forest-500 self-center">Kind:</span>
        <FilterLink label="All" param="kind" value="" current={sp.kind} />
        <FilterLink label="Deck" param="kind" value="PITCH_DECK" current={sp.kind} />
        <FilterLink label="BP" param="kind" value="BUSINESS_PLAN" current={sp.kind} />
        <FilterLink label="Model" param="kind" value="FINANCIAL_MODEL" current={sp.kind} />
        <FilterLink label="Contract" param="kind" value="CONTRACT" current={sp.kind} />
        <FilterLink label="LOI" param="kind" value="LOI" current={sp.kind} />
        <FilterLink label="Sci memo" param="kind" value="SCIENTIFIC_MEMO" current={sp.kind} />
        <FilterLink label="Regulatory" param="kind" value="REGULATORY_DOSSIER" current={sp.kind} />
        <FilterLink label="SOP" param="kind" value="SOP" current={sp.kind} />
        <span className="text-forest-500 self-center ml-2">Sensitivity:</span>
        <FilterLink label="All" param="sensitivity" value="" current={sp.sensitivity} />
        <FilterLink label="Public" param="sensitivity" value="PUBLIC" current={sp.sensitivity} />
        <FilterLink label="Internal" param="sensitivity" value="INTERNAL" current={sp.sensitivity} />
        <FilterLink label="Commercial" param="sensitivity" value="COMMERCIAL_SENSITIVE" current={sp.sensitivity} />
        <FilterLink label="IP critical" param="sensitivity" value="IP_CRITICAL" current={sp.sensitivity} />
        <FilterLink label="Investor" param="sensitivity" value="INVESTOR_RESTRICTED" current={sp.sensitivity} />
      </div>

      {hidden > 0 && (
        <div className="mb-3 text-xs text-forest-400">
          ({hidden} document{hidden === 1 ? '' : 's'} hidden from you by sensitivity / entity ACL.)
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white border border-forest-100 rounded-lg p-8 text-center text-forest-400 text-sm">
          No documents match these filters yet.
        </div>
      ) : (
        <div className="bg-white border border-forest-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-forest-50 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Title</th>
                <th className="text-left px-4 py-2 font-medium">Kind</th>
                <th className="text-left px-4 py-2 font-medium">Sensitivity</th>
                <th className="text-left px-4 py-2 font-medium">Project</th>
                <th className="text-left px-4 py-2 font-medium">Uploaded</th>
                <th className="text-left px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id} className="border-t border-forest-100 hover:bg-cream/50">
                  <td className="px-4 py-2">
                    <Link href={`/documents/${d.id}`} className="text-forest-700 hover:text-terra-600 hover:underline">
                      {d.title}
                    </Link>
                    {d.aiAnalysisPending && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-amber/20 text-amber-700 font-mono animate-pulse">
                        analyzing…
                      </span>
                    )}
                    {d.aiSummary && !d.aiAnalysisPending && (
                      <div className="text-xs text-forest-500 mt-1 italic line-clamp-1">
                        {d.aiSummary}
                      </div>
                    )}
                    {d.tags.length > 0 && (
                      <div className="text-xs text-forest-400 mt-0.5">
                        {d.tags.map((t) => `#${t}`).join(' ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-forest-500">{d.kind}</td>
                  <td className="px-4 py-2"><SensitivityChip s={d.ipSensitivity} /></td>
                  <td className="px-4 py-2 text-xs">
                    {d.project ? (
                      <Link href={`/projects/${d.project.slug}`} className="text-brand hover:underline">
                        {d.project.name}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-forest-500">
                    {fmtDate(d.createdAt)}<br />
                    <span className="text-forest-400">by {d.uploader.name}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-forest-500">{fmtSize(d.sizeBytes)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <a
                      href={`/api/documents/${d.id}/file`}
                      className="text-xs text-brand hover:underline mr-3"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in browser (PDFs/images render inline)"
                    >
                      open
                    </a>
                    <a
                      href={`/api/documents/${d.id}/file?download=1`}
                      className="text-xs text-brand hover:underline"
                      title="Force download"
                    >
                      download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterLink({ label, param, value, current }: { label: string; param: string; value: string; current?: string }) {
  const active = (current ?? '') === value;
  const href = value ? `/documents?${param}=${encodeURIComponent(value)}` : '/documents';
  return (
    <a
      href={href}
      className={`px-2 py-1 rounded ${active ? 'bg-forest text-white' : 'bg-cream text-forest-600 hover:bg-forest-100'}`}
    >
      {label}
    </a>
  );
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

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
