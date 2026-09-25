/**
 * /needs-you — your personal queue of data-room entries that agents
 * have tagged as blocked specifically on YOU.
 *
 * This is the data-room slice of Layla's "What needs you" morning brief
 * section: every entry where humanDependencyOwner == current user AND
 * humanDependencyStatus is not yet CLOSED.
 *
 * Sort order: WAITING_ON_HUMAN before IN_PROGRESS before UNBLOCKED; within
 * each, oldest tag first (older dependencies = more overdue). CLOSED items
 * are filtered out — they're permanently resolved and only clutter the view.
 *
 * Everyone sees their OWN queue. There is no "see-all" exec view — the
 * data-room page already lists all entries with their dependency badges.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HumanDependencyStatus } from '@prisma/client';
import { ArrowRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NeedsYouPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const userId = session.user.id;

  // Pull every open dependency tagged on this user. We exclude CLOSED
  // explicitly so the queue stays a working surface, not an archive.
  const entries = await prisma.dataRoomEntry.findMany({
    where: {
      humanDependencyOwnerId: userId,
      humanDependencyStatus: { not: HumanDependencyStatus.CLOSED },
    },
    include: {
      folder: { select: { name: true } },
      dataRoom: { select: { slug: true } },
      document: { select: { id: true, title: true } },
    },
    orderBy: [{ humanDependencyUpdatedAt: 'asc' }],
  });

  // Count by status for the header chips
  const byStatus = {
    WAITING_ON_HUMAN: 0,
    IN_PROGRESS: 0,
    UNBLOCKED: 0,
    NONE: 0,
    CLOSED: 0,
  } as Record<HumanDependencyStatus, number>;
  for (const e of entries) byStatus[e.humanDependencyStatus]++;

  // Sort: waiting first, then in_progress, then unblocked
  const STATUS_ORDER: Record<HumanDependencyStatus, number> = {
    WAITING_ON_HUMAN: 0,
    IN_PROGRESS: 1,
    UNBLOCKED: 2,
    NONE: 3,
    CLOSED: 4,
  };
  entries.sort((a, b) => {
    const sa = STATUS_ORDER[a.humanDependencyStatus];
    const sb = STATUS_ORDER[b.humanDependencyStatus];
    if (sa !== sb) return sa - sb;
    const ta = a.humanDependencyUpdatedAt?.getTime() ?? 0;
    const tb = b.humanDependencyUpdatedAt?.getTime() ?? 0;
    return ta - tb;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand tracking-tight mb-1">
          Needs you
        </h1>
        <p className="text-sm text-muted">
          Data-room entries that agents have flagged as blocked specifically on
          you. Resolving these unblocks downstream work across the platform.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-5 text-xs">
        <Chip
          tone="amber"
          icon={<AlertCircle className="w-3 h-3" />}
          label={`${byStatus.WAITING_ON_HUMAN} waiting`}
        />
        <Chip
          tone="brand"
          icon={<Clock className="w-3 h-3" />}
          label={`${byStatus.IN_PROGRESS} in progress`}
        />
        <Chip
          tone="muted"
          icon={<CheckCircle2 className="w-3 h-3" />}
          label={`${byStatus.UNBLOCKED} unblocked, ready to confirm`}
        />
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-14 text-sm text-muted bg-white border border-line rounded-xl">
          Nothing on your plate from the agents right now. They&apos;ll surface
          something here when a decision lands on you.
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((e) => (
            <DependencyRow
              key={e.id}
              entry={{
                id: e.id,
                refNumber: e.refNumber,
                displayName: e.displayName,
                folderName: e.folder?.name ?? '',
                dataRoomSlug: e.dataRoom.slug,
                status: e.humanDependencyStatus,
                note: e.humanDependencyNote ?? '',
                updatedAt: e.humanDependencyUpdatedAt,
                docTitle: e.document?.title ?? null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  tone,
  icon,
  label,
}: {
  tone: 'amber' | 'brand' | 'muted';
  icon: React.ReactNode;
  label: string;
}) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'brand'
        ? 'bg-brand/10 text-brand border-brand/20'
        : 'bg-mist text-muted border-line';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${cls} font-medium`}
    >
      {icon}
      {label}
    </span>
  );
}

function DependencyRow({
  entry,
}: {
  entry: {
    id: string;
    refNumber: string;
    displayName: string;
    folderName: string;
    dataRoomSlug: string;
    status: HumanDependencyStatus;
    note: string;
    updatedAt: Date | null;
    docTitle: string | null;
  };
}) {
  const statusStyles: Record<HumanDependencyStatus, string> = {
    WAITING_ON_HUMAN: 'bg-amber-50 text-amber-700',
    IN_PROGRESS: 'bg-brand/10 text-brand',
    UNBLOCKED: 'bg-emerald-50 text-emerald-700',
    NONE: 'bg-mist text-muted',
    CLOSED: 'bg-mist text-muted',
  };
  const statusLabel: Record<HumanDependencyStatus, string> = {
    WAITING_ON_HUMAN: 'waiting',
    IN_PROGRESS: 'in progress',
    UNBLOCKED: 'unblocked',
    NONE: 'none',
    CLOSED: 'closed',
  };
  const href = `/data-room/${entry.dataRoomSlug}?entry=${encodeURIComponent(entry.refNumber)}`;

  return (
    <Link
      href={href}
      className="block bg-white rounded-xl border border-line shadow-card p-4 hover:border-brand/40 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium ${statusStyles[entry.status]}`}
            >
              {statusLabel[entry.status]}
            </span>
            <span className="text-xs text-muted font-mono">
              {entry.refNumber}
            </span>
            {entry.folderName && (
              <span className="text-xs text-muted">· {entry.folderName}</span>
            )}
          </div>
          <div className="text-sm font-medium text-ink mb-1.5">
            {entry.displayName}
          </div>
          {entry.note && (
            <p className="text-sm text-muted leading-relaxed bg-mist/40 border border-line/60 rounded-md p-2.5 mb-1.5">
              {entry.note}
            </p>
          )}
          <div className="text-[11px] text-muted flex items-center gap-2 mt-1">
            {entry.docTitle && <span>Linked doc: {entry.docTitle}</span>}
            {entry.updatedAt && (
              <span>
                Tagged {new Date(entry.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted/60 mt-1 flex-shrink-0" />
      </div>
    </Link>
  );
}
