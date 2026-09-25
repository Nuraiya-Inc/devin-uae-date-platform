import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canChatWithAgent } from '@/lib/access';
import { fmtDate } from '@/lib/utils';
import { agentAvatar } from '@/lib/avatar';
import { getAgentPhotoUrl } from '@/lib/team-avatars';
import Avatar from '@/components/Avatar';
import ChatWindow from '@/components/ChatWindow';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileType,
  Presentation,
  File as FileIconLucide,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AgentChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ taskId?: string; prefill?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const { slug } = await params;
  const sp = await searchParams;

  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent || !agent.isActive) notFound();

  // Access check
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) redirect('/signin');
  const allowed = await canChatWithAgent(
    { id: dbUser.id, role: dbUser.role, entity: dbUser.entity, email: dbUser.email, name: dbUser.name },
    { id: agent.id, slug: agent.slug, tier: agent.tier, branch: agent.branch },
  );
  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-forest mb-2">Access restricted</h1>
        <p className="text-sm text-forest-600">
          You don't have permission to chat with this agent. The MD orchestrator is restricted to CEO and MD-tier users.
        </p>
      </div>
    );
  }

  // Optional task context — if we got here from a Task detail page.
  // Inferred type includes the `ownerAgent` and `assignee` relations because
  // we pass them in the `include` argument.
  const task = sp.taskId
    ? await prisma.task.findUnique({
        where: { id: sp.taskId },
        include: {
          ownerAgent: { select: { slug: true, name: true } },
          assignee: { select: { name: true } },
        },
      })
    : null;

  let prefill = sp.prefill ?? '';
  if (task && !prefill) {
    // Default prefill — actionable starter the user can edit before sending
    prefill = `Re: "${task.title}" (id=${task.id})\nCurrent status: ${task.status} · Priority: ${task.priority}${task.dueDate ? ` · Due ${task.dueDate.toISOString().slice(0, 10)}` : ''}\n\n[ Your update here — the agent will use update_task_status if you tell it the status changed ]`;
  }

  // Load or create thread
  let thread = await prisma.chatThread.findUnique({
    where: { userId_agentId: { userId: dbUser.id, agentId: agent.id } },
  });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: { userId: dbUser.id, agentId: agent.id, title: `Chat with ${agent.name}` },
    });
  }

  // Load the most recent 200 messages (was 100, ordered ascending — which
  // capped long threads at their FIRST 100 messages and made new sends appear
  // to "revert" once the thread grew past 100). Now: pull the newest 200 by
  // createdAt desc, then reverse for chronological display.
  const recent = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const messages = recent.reverse();

  // Resolve attachment metadata (one query for all docs referenced across the thread)
  const allDocIds = messages.flatMap((m) => m.attachmentDocIds);
  const docs = allDocIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: allDocIds } },
        select: { id: true, title: true, mimeType: true, sizeBytes: true, createdAt: true },
      })
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  // ────────────────────────────────────────────────────────────────
  // Two strips of files surface above the chat:
  //   1. User uploads — files YOU attached in this conversation. Kept intact;
  //      this strip is how you reach back to your originals at any time.
  //      Distinct visual treatment (mist/grey) — these are INPUT.
  //   2. Agent generated — files the agent produced (generate_xlsx/docx/pdf/pptx
  //      or edit_xlsx output). Lime-tinted — these are OUTPUT.
  // ────────────────────────────────────────────────────────────────
  const userDocIds = new Set(
    messages
      .filter((m) => m.role === 'USER')
      .flatMap((m) => m.attachmentDocIds),
  );
  const userUploadedDocs = docs
    .filter((d) => userDocIds.has(d.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const agentDocIds = new Set(
    messages
      .filter((m) => m.role === 'ASSISTANT')
      .flatMap((m) => m.attachmentDocIds),
  );
  const agentGeneratedDocs = docs
    .filter((d) => agentDocIds.has(d.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const initial = messages.map((m) => ({
    id: m.id,
    role: m.role as 'USER' | 'ASSISTANT',
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    modelUsed: m.modelUsed,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    cachedTokensIn: m.cachedTokensIn,
    toolsUsed: m.toolsUsed,
    attachmentDocIds: m.attachmentDocIds,
    attachments: m.attachmentDocIds
      .map((id) => docMap.get(id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ id: d.id, title: d.title, mimeType: d.mimeType, sizeBytes: d.sizeBytes })),
  }));

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        {(agent.tier === 'ORCHESTRATOR' || agent.tier === 'EXECUTIVE') && (() => {
          const av = agentAvatar(agent.name);
          const photoUrl = getAgentPhotoUrl(agent.slug);
          return <Avatar initials={av.initials} color={av.color} photoUrl={photoUrl} size={44} alt={agent.name} ring="ring-lime/30" />;
        })()}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-muted">{agent.slug}</div>
          <h1 className="text-xl font-semibold text-brand truncate">{agent.name}</h1>
          <p className="text-xs text-muted mt-0.5 truncate">{agent.mission}</p>
        </div>
      </div>

      {task && (
        <div className="mb-3 p-3 bg-amber/10 border border-amber/30 rounded-lg flex items-start gap-3">
          <div className="text-xl">📋</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
              Updating task
            </div>
            <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-forest hover:text-terra-600 hover:underline truncate block">
              {task.title}
            </Link>
            <div className="text-xs text-forest-500 mt-0.5 flex gap-3 flex-wrap">
              <span>Status: <code className="text-forest-700">{task.status}</code></span>
              <span>Priority: <code className="text-forest-700">{task.priority}</code></span>
              {task.dueDate && <span>Due: {fmtDate(task.dueDate)}</span>}
              {task.assignee && <span>Assignee: {task.assignee.name}</span>}
              {task.ownerAgent && <span>Owner: <code className="text-forest-700">{task.ownerAgent.slug}</code></span>}
            </div>
            {task.ownerAgent && task.ownerAgent.slug !== agent.slug && (
              <div className="text-xs text-amber-700 mt-2">
                ⚠ This task is owned by <code>{task.ownerAgent.slug}</code>, not {agent.slug}. {agent.slug} can advise but cannot directly change the status — only the owner agent can. Consider chatting with <Link href={`/agents/${task.ownerAgent.slug}/chat?taskId=${task.id}`} className="text-terra-600 underline">{task.ownerAgent.slug}</Link> instead.
              </div>
            )}
          </div>
          <Link href={`/tasks/${task.id}`} className="text-xs text-terra-600 hover:underline whitespace-nowrap flex-shrink-0">
            view task →
          </Link>
        </div>
      )}

      {userUploadedDocs.length > 0 && (
        <FilesStrip
          docs={userUploadedDocs}
          variant="input"
          label="Files you uploaded in this chat"
        />
      )}

      {agentGeneratedDocs.length > 0 && (
        <FilesStrip
          docs={agentGeneratedDocs}
          variant="output"
          label={`Files ${agent.name.split(' ')[0]} produced in this chat`}
        />
      )}

      <ChatWindow
        agentSlug={agent.slug}
        agentName={agent.name}
        agentTier={agent.tier}
        initialMessages={initial}
        initialPrefill={prefill}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Quick-access strip — files this agent has produced in this chat.
// Horizontally scrollable on overflow so a long history stays usable on
// mobile without expanding the page.
// ────────────────────────────────────────────────────────────────

function FilesStrip({
  docs,
  variant,
  label,
}: {
  docs: Array<{ id: string; title: string; mimeType: string | null; sizeBytes: number | null; createdAt: Date }>;
  variant: 'input' | 'output';
  label: string;
}) {
  // Visual treatment differs so input vs output read clearly at a glance.
  const isInput = variant === 'input';
  const containerCls = isInput
    ? 'mb-2 bg-mist/40 rounded-lg border border-line/70 p-3'
    : 'mb-3 rounded-lg border p-3';
  const containerStyle = isInput
    ? undefined
    : { background: 'linear-gradient(135deg, #F1F8E9 0%, #FFFFFF 70%)', borderColor: '#90C038' };
  const labelCls = isInput
    ? 'text-[10px] uppercase tracking-[0.15em] text-muted font-semibold'
    : 'text-[10px] uppercase tracking-[0.15em] text-forest font-semibold';
  const chipCls = isInput
    ? 'inline-flex items-center gap-2 text-xs bg-white border border-line hover:border-brand-200 rounded px-2.5 py-1.5 flex-shrink-0 max-w-[240px] transition-colors'
    : 'inline-flex items-center gap-2 text-xs bg-white border border-line hover:border-brand-200 hover:shadow-card-hover rounded px-2.5 py-1.5 flex-shrink-0 max-w-[240px] transition-all';

  return (
    <div className={containerCls} style={containerStyle}>
      <div className="flex items-baseline justify-between mb-2">
        <div className={labelCls}>
          {label}
          {isInput && (
            <span className="ml-2 normal-case text-muted/70 font-normal">— originals kept intact</span>
          )}
        </div>
        <div className="text-[10px] text-muted">
          {docs.length} {docs.length === 1 ? 'file' : 'files'}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {docs.map((d) => (
          <a
            key={d.id}
            href={`/api/documents/${d.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className={chipCls}
            title={`${d.title}${d.sizeBytes ? ` · ${formatBytes(d.sizeBytes)}` : ''} · ${fmtDate(d.createdAt)}`}
          >
            <DocIcon mime={d.mimeType ?? ''} />
            <span className="truncate text-ink">{d.title}</span>
            <span className="text-muted text-[10px] flex-shrink-0">{shortAgo(d.createdAt)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function DocIcon({ mime }: { mime: string }) {
  const cls = 'w-3.5 h-3.5 flex-shrink-0 text-brand-500';
  if (mime.startsWith('image/')) return <ImageIcon className={cls} strokeWidth={1.8} />;
  if (mime === 'application/pdf') return <FileType className={cls} strokeWidth={1.8} />;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet className={cls} strokeWidth={1.8} />;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <Presentation className={cls} strokeWidth={1.8} />;
  if (mime.includes('word') || mime.includes('document')) return <FileText className={cls} strokeWidth={1.8} />;
  return <FileIconLucide className={cls} strokeWidth={1.8} />;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function shortAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
