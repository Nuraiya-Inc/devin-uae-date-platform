import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canChatWithAgent } from '@/lib/access';
import Avatar from '@/components/Avatar';
import MarkdownText from '@/components/MarkdownText';
import { agentAvatar } from '@/lib/avatar';
import { getAgentPhotoUrl } from '@/lib/team-avatars';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileType,
  Presentation,
  File as FileIconLucide,
  MessageSquare,
  Sparkles,
  Clock,
  Folder,
  Cpu,
  ChevronDown,
  Lock,
} from 'lucide-react';

// Skip static optimisation — this page reads from Postgres which isn't reachable
// at build time. Render on every request instead.
export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const { slug } = await params;
  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent) return notFound();

  // Check whether the current viewer is allowed to chat with this agent.
  // Profile/files/reference content stay visible to everyone; only the CTA
  // changes when chat is restricted (e.g. MD-tier users viewing Layla).
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  const canChat = dbUser
    ? await canChatWithAgent(
        { id: dbUser.id, role: dbUser.role, entity: dbUser.entity, email: dbUser.email, name: dbUser.name },
        { id: agent.id, slug: agent.slug, tier: agent.tier, branch: agent.branch },
      )
    : false;

  // ────────────────────────────────────────────────────────────────
  // Data for the new agent profile: generated files, message count,
  // last-active timestamp, all scoped to the current viewer's threads.
  // ────────────────────────────────────────────────────────────────
  const [agentMessages, totalMessages, lastMessage] = await Promise.all([
    prisma.message.findMany({
      where: {
        agentId: agent.id,
        role: 'ASSISTANT',
        attachmentDocIds: { isEmpty: false },
        thread: { userId: session.user.id },
      },
      select: { attachmentDocIds: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.message.count({
      where: {
        agentId: agent.id,
        role: 'ASSISTANT',
        thread: { userId: session.user.id },
      },
    }),
    prisma.message.findFirst({
      where: {
        agentId: agent.id,
        role: 'ASSISTANT',
        thread: { userId: session.user.id },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const generatedDocIds = Array.from(new Set(agentMessages.flatMap((m) => m.attachmentDocIds)));
  const generatedDocs = generatedDocIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: generatedDocIds } },
        select: { id: true, title: true, mimeType: true, sizeBytes: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : [];

  const firstName = agent.name.split(/\s|—/)[0].trim();
  const av = agentAvatar(agent.name);
  const photoUrl = getAgentPhotoUrl(agent.slug);
  const showAvatar = agent.tier === 'ORCHESTRATOR' || agent.tier === 'EXECUTIVE';

  const tierLabel =
    agent.tier === 'ORCHESTRATOR' ? 'Orchestrator' :
    agent.tier === 'EXECUTIVE'    ? 'C-Suite'      : 'Functional';

  return (
    <div className="max-w-4xl">
      {/* ──────────────────────────────────────────────────────────────
          HERO — large avatar, name, role chips, mission as the headline,
          big "Open chat" CTA. The whole block is the focal point of the
          page; everything else exists to support it.
      ────────────────────────────────────────────────────────────── */}
      <section
        className="mb-6 rounded-2xl border border-line/70 overflow-hidden shadow-card"
        style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F1F8E9 70%, #E1E32A22 100%)' }}
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-start md:gap-7 gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {showAvatar ? (
                <Avatar
                  initials={av.initials}
                  color={av.color}
                  photoUrl={photoUrl}
                  size={120}
                  alt={agent.name}
                  ring="ring-lime/40"
                />
              ) : (
                <div
                  className="w-[88px] h-[88px] rounded-2xl flex items-center justify-center"
                  style={{ background: av.color }}
                >
                  <span className="text-white text-2xl font-semibold tracking-tight">{av.initials}</span>
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-muted">{agent.slug}</span>
                <span className="text-muted">·</span>
                <Chip tone={agent.tier === 'ORCHESTRATOR' ? 'lime' : agent.tier === 'EXECUTIVE' ? 'brand' : 'muted'}>
                  {tierLabel}
                </Chip>
                <Chip tone="muted">{agent.branch} branch</Chip>
              </div>
              <h1 className="text-3xl md:text-4xl font-semibold text-brand tracking-tight leading-tight">
                {agent.name.split('—')[0].trim()}
              </h1>
              <p className="text-sm text-muted mt-1.5">{agent.title}</p>

              {/* Mission as the headline pull-quote */}
              <div className="mt-5 pl-4 border-l-2 border-lime">
                <p className="text-base md:text-lg font-serif italic text-brand-700 leading-relaxed">
                  {agent.mission}
                </p>
              </div>
            </div>
          </div>

          {/* ─── Big chat CTA + secondary stats row ─────────────────── */}
          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            {canChat ? (
              <Link
                href={`/agents/${agent.slug}/chat`}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-white text-base font-medium shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #004923 0%, #006950 100%)' }}
              >
                <MessageSquare className="w-5 h-5" strokeWidth={2} />
                <span>Open chat with {firstName}</span>
              </Link>
            ) : (
              <div
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full text-muted text-base font-medium bg-mist border border-line cursor-not-allowed"
                title={`Chat with ${firstName} is restricted. You can still view ${firstName}'s briefings and files.`}
              >
                <Lock className="w-5 h-5" strokeWidth={2} />
                <span>View only — chat restricted</span>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted">
              <Stat icon={Cpu}    label={agent.model} />
              <Stat icon={Folder} label={`${generatedDocIds.length} ${generatedDocIds.length === 1 ? 'file' : 'files'}`} />
              {totalMessages > 0 && (
                <Stat
                  icon={Sparkles}
                  label={`${totalMessages} ${totalMessages === 1 ? 'reply' : 'replies'}`}
                />
              )}
              {lastMessage && (
                <Stat icon={Clock} label={`active ${shortAgo(lastMessage.createdAt)}`} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────
          FILES — friendly grid of everything this agent has produced
          for the current viewer.
      ────────────────────────────────────────────────────────────── */}
      {generatedDocs.length > 0 && (
        <GeneratedDocsPanel
          docs={generatedDocs}
          agentFirstName={firstName}
          totalCount={generatedDocIds.length}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────
          REFERENCE — the long-form text content (decision rights, KPIs,
          responsibilities, tools) lives here. Demoted from the hero so
          the chat CTA stays the centerpiece. Native <details> for
          progressive disclosure — no JS, accessible by default, the
          first one (Mandate) is open by default.
      ────────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-[10px] uppercase tracking-[0.18em] text-muted font-semibold mt-8 mb-2">
          Reference
        </h2>

        <Disclosure title="Mandate" defaultOpen>
          <MarkdownText>
            {`**Mission.** ${agent.mission}\n\n${agent.responsibilities}`}
          </MarkdownText>
        </Disclosure>

        <Disclosure title="Decision rights">
          <MarkdownText>{agent.decisionRights}</MarkdownText>
        </Disclosure>

        <Disclosure title="KPIs">
          <MarkdownText>{agent.kpis}</MarkdownText>
        </Disclosure>

        <Disclosure title="Tools">
          <MarkdownText>{agent.tools}</MarkdownText>
        </Disclosure>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function Chip({ children, tone }: { children: React.ReactNode; tone: 'brand' | 'lime' | 'muted' }) {
  const styles =
    tone === 'lime'  ? 'bg-lime/25 text-brand-800' :
    tone === 'brand' ? 'bg-brand/10 text-brand'    :
                       'bg-mist text-muted';
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium ${styles}`}>
      {children}
    </span>
  );
}

function Stat({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="w-3.5 h-3.5 text-muted" strokeWidth={1.8} />
      <span>{label}</span>
    </span>
  );
}

/** Native <details> with a tailored summary — no JS, accessible, animates open. */
function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="bg-white rounded-xl border border-line/70 overflow-hidden group"
    >
      <summary className="cursor-pointer list-none px-5 py-3.5 flex items-center justify-between hover:bg-mist/40 transition-colors">
        <span className="text-sm font-semibold text-brand">{title}</span>
        <ChevronDown className="w-4 h-4 text-muted group-open:rotate-180 transition-transform" strokeWidth={2} />
      </summary>
      <div className="px-5 pb-5 pt-1 border-t border-line/60">
        {children}
      </div>
    </details>
  );
}

// ────────────────────────────────────────────────────────────────
// Generated docs panel — friendly UI for everything this agent has
// produced for the viewer. Grid of file cards with icon, name, type,
// size, and time-ago. Click to open in a new tab.
// ────────────────────────────────────────────────────────────────

function GeneratedDocsPanel({
  docs,
  agentFirstName,
  totalCount,
}: {
  docs: Array<{ id: string; title: string; mimeType: string | null; sizeBytes: number | null; createdAt: Date }>;
  agentFirstName: string;
  totalCount: number;
}) {
  return (
    <section
      className="mb-6 rounded-2xl border p-5 shadow-card"
      style={{ background: 'linear-gradient(135deg, #F1F8E9 0%, #FFFFFF 70%)', borderColor: '#90C038' }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-forest uppercase tracking-wide">
            Files {agentFirstName} produced for you
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {totalCount > docs.length
              ? `Showing ${docs.length} most recent of ${totalCount} total`
              : `${docs.length} ${docs.length === 1 ? 'file' : 'files'}`}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {docs.map((d) => (
          <a
            key={d.id}
            href={`/api/documents/${d.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 bg-white rounded-lg border border-line p-3 hover:border-brand-200 hover:shadow-card-hover transition-all"
            title={`${d.title} · ${fmtBytes(d.sizeBytes)} · ${d.createdAt.toLocaleString()}`}
          >
            <DocIcon mime={d.mimeType ?? ''} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate leading-tight">{d.title}</div>
              <div className="text-[10px] text-muted mt-1 flex items-center gap-2">
                <span>{shortKind(d.mimeType ?? '')}</span>
                {d.sizeBytes !== null && <span>· {fmtBytes(d.sizeBytes)}</span>}
                <span>· {shortAgo(d.createdAt)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function DocIcon({ mime }: { mime: string }) {
  const cls = 'w-6 h-6 flex-shrink-0 text-brand';
  if (mime.startsWith('image/')) return <ImageIcon className={cls} strokeWidth={1.6} />;
  if (mime === 'application/pdf') return <FileType className={cls} strokeWidth={1.6} />;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet className={cls} strokeWidth={1.6} />;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <Presentation className={cls} strokeWidth={1.6} />;
  if (mime.includes('word') || mime.includes('document')) return <FileText className={cls} strokeWidth={1.6} />;
  return <FileIconLucide className={cls} strokeWidth={1.6} />;
}

function shortKind(mime: string): string {
  if (mime.startsWith('image/')) return 'Image';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'Spreadsheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'Slides';
  if (mime.includes('word') || mime.includes('document')) return 'Document';
  return 'File';
}

function fmtBytes(b: number | null): string {
  if (b === null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function shortAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
