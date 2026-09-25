'use client';

/**
 * <ActivityFeed> — the single component that renders the live event stream.
 *
 * Used in:
 *   - /feed (full-page Activity view)
 *   - /agents/[slug] (per-agent drill-down — later)
 *   - sidebar bell popover (mini variant)
 *
 * Polls /api/activity-feed every 20s for new events. Supports filters via
 * URL query params (branch / agentSlug / severity) so views are linkable.
 * "Load more" pagination via cursor. New events animate in.
 *
 * Visual treatment matches existing dashboard cards (white bg, forest text,
 * lime accent for live state). No new icon set introduced.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Hash,
  MessageSquare,
  Package,
  PlayCircle,
  ShieldAlert,
  XCircle,
  Zap,
} from 'lucide-react';
import type { ActivityEventDTO } from '@/app/api/activity-feed/route';

const POLL_INTERVAL_MS = 20_000;
const PAGE_SIZE = 50;

export interface ActivityFeedProps {
  /** Pre-applied filters — server can pass these from URL params. */
  initialBranch?: string;
  initialAgentSlug?: string;
  initialSeverity?: string;
  /** When true, server respects the caller's UserNotificationPreference filters. */
  respectPrefs?: boolean;
  /** Renders a compact variant for the bell popover (max 8 items, no controls). */
  compact?: boolean;
  /** Hide internal filter chips (useful when the parent page provides its own). */
  hideFilters?: boolean;
}

interface FeedResponse {
  events: ActivityEventDTO[];
  nextCursor: string | null;
  lastSeenAt: string | null;
}

export default function ActivityFeed({
  initialBranch,
  initialAgentSlug,
  initialSeverity,
  respectPrefs = false,
  compact = false,
  hideFilters = false,
}: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEventDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState(initialBranch ?? '');
  const [severity, setSeverity] = useState(initialSeverity ?? '');
  const isMountedRef = useRef(true);

  // Build query string for the API
  const buildQuery = useCallback(
    (opts: { cursor?: string | null } = {}) => {
      const qs = new URLSearchParams();
      qs.set('limit', String(compact ? 8 : PAGE_SIZE));
      if (branch) qs.set('branch', branch);
      if (initialAgentSlug) qs.set('agentSlug', initialAgentSlug);
      if (severity) qs.set('severity', severity);
      if (respectPrefs) qs.set('respectPrefs', '1');
      if (opts.cursor) qs.set('cursor', opts.cursor);
      return `/api/activity-feed?${qs.toString()}`;
    },
    [branch, severity, initialAgentSlug, respectPrefs, compact],
  );

  // Fresh fetch (replaces list)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(buildQuery(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FeedResponse;
      if (!isMountedRef.current) return;
      setEvents(data.events);
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'fetch failed');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [buildQuery]);

  // Append-fetch ("load more")
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildQuery({ cursor: nextCursor }), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FeedResponse;
      if (!isMountedRef.current) return;
      setEvents((cur) => [...cur, ...data.events]);
      setNextCursor(data.nextCursor);
    } catch {
      // silent — the user can try again
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
    }
  }, [buildQuery, nextCursor, loadingMore]);

  // Initial load + filter change → refresh
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Poll loop
  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Unmount tracking
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const branchOptions = useMemo(
    () => ['EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS'],
    [],
  );

  return (
    <div className={compact ? '' : 'space-y-4'}>
      {!compact && !hideFilters && (
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="text-forest-500 mr-1">Branch:</span>
          <FilterChip label="All" value="" current={branch} onSelect={setBranch} />
          {branchOptions.map((b) => (
            <FilterChip key={b} label={b[0] + b.slice(1).toLowerCase()} value={b} current={branch} onSelect={setBranch} />
          ))}
          <span className="text-forest-500 mr-1 ml-3">Severity:</span>
          <FilterChip label="All" value="" current={severity} onSelect={setSeverity} />
          <FilterChip label="Notable+" value="NOTABLE,WARNING,CRITICAL" current={severity} onSelect={setSeverity} />
          <FilterChip label="Warning+" value="WARNING,CRITICAL" current={severity} onSelect={setSeverity} />
          <FilterChip label="Critical" value="CRITICAL" current={severity} onSelect={setSeverity} />
          <span className="ml-auto inline-flex items-center gap-1.5 text-forest-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
            Live · polling 20s
          </span>
        </div>
      )}

      <div className={compact ? 'divide-y divide-forest-100' : 'bg-white border border-forest-100 rounded-lg divide-y divide-forest-100'}>
        {loading && events.length === 0 ? (
          <div className="p-6 text-center text-forest-400 text-sm">Loading activity…</div>
        ) : error ? (
          <div className="p-6 text-center text-terra-600 text-sm">Error loading feed: {error}</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center text-forest-400 text-sm">No activity yet matching these filters.</div>
        ) : (
          events.map((e) => <FeedItem key={e.id} event={e} compact={compact} />)
        )}
      </div>

      {!compact && nextCursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="text-xs px-3 py-1.5 rounded bg-cream text-forest-600 hover:bg-forest-100 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load older'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: string;
  current: string;
  onSelect: (v: string) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`px-2 py-1 rounded transition-colors ${
        active ? 'bg-forest text-white' : 'bg-cream text-forest-600 hover:bg-forest-100'
      }`}
    >
      {label}
    </button>
  );
}

function FeedItem({ event, compact }: { event: ActivityEventDTO; compact: boolean }) {
  const Icon = iconForKind(event.kind);
  const sevTone = toneForSeverity(event.severity);
  const href = entityHref(event.entityType, event.entityId, event.payload);
  const inner = (
    <div className={`flex items-start gap-3 ${compact ? 'px-3 py-2' : 'px-4 py-3'} hover:bg-cream/40 transition-colors`}>
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: sevTone.bg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: sevTone.fg }} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-forest-700 truncate">{event.title}</div>
        {event.summary && !compact && (
          <div className="text-xs text-forest-500 mt-0.5 line-clamp-2">{event.summary}</div>
        )}
        <div className="text-[10px] text-forest-400 mt-1 flex items-center gap-2 font-mono">
          <span title={formatExactLocal(event.createdAt)}>{formatTimeAgo(event.createdAt)}</span>
          {event.actorAgent && (
            <>
              <span>·</span>
              <span>{event.actorAgent.slug}</span>
            </>
          )}
          {event.branch && (
            <>
              <span>·</span>
              <span>{event.branch.toLowerCase()}</span>
            </>
          )}
          <span>·</span>
          <span>{event.kind.toLowerCase().replace(/_/g, ' ')}</span>
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function iconForKind(kind: string) {
  switch (kind) {
    case 'DATA_ROOM_ENTRY_SHIPPED': return Package;
    case 'DOCUMENT_UPLOADED':        return FileText;
    case 'CHANNEL_MESSAGE_POSTED':   return MessageSquare;
    case 'AGENT_CONSULT_COMPLETED':  return Zap;
    case 'TASK_COMPLETED':           return CheckCircle2;
    case 'TASK_BLOCKED':             return AlertTriangle;
    case 'RAID_OPENED':              return ShieldAlert;
    case 'RAID_ESCALATED':           return ShieldAlert;
    case 'RAID_CLOSED':              return CheckCircle2;
    case 'AGENT_RUN_STARTED':        return PlayCircle;
    case 'AGENT_RUN_COMPLETED':      return CheckCircle2;
    case 'AGENT_RUN_FAILED':         return XCircle;
    case 'APPROVAL_REQUESTED':       return AlertTriangle;
    case 'APPROVAL_DECIDED':         return CheckCircle2;
    case 'INVESTOR_STAGE_CHANGED':   return Activity;
    case 'INVESTOR_TOUCH_LOGGED':    return Hash;
    default:                         return Activity;
  }
}

function toneForSeverity(sev: string): { fg: string; bg: string } {
  switch (sev) {
    case 'CRITICAL': return { fg: '#9A1B1B', bg: '#FCE6E6' };
    case 'WARNING':  return { fg: '#9A6510', bg: '#FCEBD5' };
    case 'NOTABLE':  return { fg: '#1F5E2E', bg: '#E4F2DC' };
    case 'INFO':
    default:         return { fg: '#4B6259', bg: '#EDF1EE' };
  }
}

function entityHref(
  type: string | null,
  id: string | null,
  payload: Record<string, unknown>,
): string | null {
  if (!type || !id) return null;
  if (type === 'Task')           return `/tasks/${id}`;
  if (type === 'DataRoomEntry')  {
    const slug = (payload?.roomSlug as string) ?? 'series-a';
    return `/data-room/${slug}`;
  }
  if (type === 'RaidEntry')      return `/raid`;
  if (type === 'ChannelMessage') {
    const slug = (payload?.channelSlug as string) ?? '';
    return slug ? `/channels/${slug}` : null;
  }
  if (type === 'AgentRun')       return null; // no detail page yet
  return null;
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const delta = Date.now() - then;
  if (delta < 60_000) return `${Math.max(1, Math.floor(delta / 1000))}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Full local-zone timestamp shown as a tooltip on every relative time label. */
function formatExactLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
