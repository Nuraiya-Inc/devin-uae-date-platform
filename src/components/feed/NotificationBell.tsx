'use client';

/**
 * <NotificationBell> — sidebar bell icon with:
 *   - unread badge (count of events since user's lastSeenAt)
 *   - click → popover with the recent events (8 max)
 *   - in-app toasts that pop top-right when new events arrive
 *
 * Polls /api/activity-feed every 20s with `since={lastSeenAt}`.
 * On popover open: POST /api/activity-feed/seen to clear the badge.
 *
 * Toast appearance is deliberately lightweight — no external lib. Toasts
 * stack top-right, auto-dismiss after 7s, dismissible. Severity drives
 * the left-edge accent color. Respects `toastMinSeverity` user preference
 * via server filter (we ask for `respectPrefs=1`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import type { ActivityEventDTO } from '@/app/api/activity-feed/route';
import ActivityFeed from './ActivityFeed';

const POLL_INTERVAL_MS = 20_000;
const TOAST_TTL_MS = 7_000;
const MAX_TOASTS = 4;

interface FeedResponse {
  events: ActivityEventDTO[];
  nextCursor: string | null;
  lastSeenAt: string | null;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ActivityEventDTO[]>([]);
  const lastPolledAtRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Poll for events since lastSeenAt (or last poll time after initial load).
  const poll = useCallback(async () => {
    try {
      const since = lastPolledAtRef.current ?? lastSeenAt ?? null;
      const qs = new URLSearchParams();
      qs.set('limit', '20');
      qs.set('respectPrefs', '1');
      if (since) qs.set('since', since);
      const res = await fetch(`/api/activity-feed?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as FeedResponse;

      // Server returns server-side lastSeenAt — useful on first load
      if (data.lastSeenAt && lastSeenAt === null) {
        setLastSeenAt(data.lastSeenAt);
      }

      const newEvents = data.events;
      if (newEvents.length === 0) return;

      // Bump unread count
      setUnread((u) => u + newEvents.length);

      // Fire toasts — but only on subsequent polls (skip first load avalanche)
      if (initialLoadDoneRef.current) {
        setToasts((cur) => [...newEvents.slice(0, MAX_TOASTS), ...cur].slice(0, MAX_TOASTS));
        // schedule auto-dismiss per toast
        for (const ev of newEvents.slice(0, MAX_TOASTS)) {
          setTimeout(() => {
            setToasts((cur) => cur.filter((t) => t.id !== ev.id));
          }, TOAST_TTL_MS);
        }
      }

      // Advance polled-at watermark to the newest event we saw
      lastPolledAtRef.current = newEvents[0].createdAt;
    } catch {
      // silent — bell shouldn't display errors
    } finally {
      initialLoadDoneRef.current = true;
    }
  }, [lastSeenAt]);

  // Initial load + poll loop
  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // On open, mark all current events as seen
  const markSeen = useCallback(async () => {
    setUnread(0);
    const at = lastPolledAtRef.current ?? new Date().toISOString();
    setLastSeenAt(at);
    try {
      await fetch('/api/activity-feed/seen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ at }),
      });
    } catch {
      // silent
    }
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) void markSeen();
      return next;
    });
  }, [markSeen]);

  const handleDismissToast = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      {/* Bell button — designed to drop into the sidebar above the user chip */}
      <button
        type="button"
        onClick={handleToggle}
        title={unread > 0 ? `${unread} new event${unread === 1 ? '' : 's'}` : 'Notifications'}
        className="relative flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/8 transition-colors border border-white/10 w-full"
      >
        <span className="inline-flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" strokeWidth={1.8} />
          <span>Activity</span>
        </span>
        {unread > 0 && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-semibold rounded-full bg-lime text-forest">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Popover — anchored to the bell, contains a compact ActivityFeed */}
      {open && (
        <div
          className="fixed left-64 bottom-6 z-50 ml-3 w-[26rem] max-w-[calc(100vw-17rem)] bg-white rounded-lg shadow-card-hover border border-forest-100 flex flex-col"
          style={{ maxHeight: 'min(70vh, 600px)' }}
          role="dialog"
          aria-label="Recent activity"
        >
          <div className="px-4 py-3 border-b border-forest-100 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-forest">Recent activity</div>
              <div className="text-[10px] text-forest-400 mt-0.5">Last 8 events · polling 20s</div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/feed"
                onClick={() => setOpen(false)}
                className="text-[11px] text-terra-600 hover:underline"
              >
                Open full feed →
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-forest-400 hover:text-forest p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ActivityFeed compact respectPrefs hideFilters />
          </div>
        </div>
      )}

      {/* Toast stack — fixed top-right, independent of the popover */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} event={t} onDismiss={() => handleDismissToast(t.id)} />
        ))}
      </div>
    </>
  );
}

function ToastCard({ event, onDismiss }: { event: ActivityEventDTO; onDismiss: () => void }) {
  const accent = accentForSeverity(event.severity);
  return (
    <div
      className="pointer-events-auto bg-white rounded-lg shadow-card-hover border border-forest-100 w-80 overflow-hidden"
      role="status"
    >
      <div className="flex">
        <div className="w-1" style={{ background: accent }} aria-hidden="true" />
        <div className="flex-1 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-forest-500 uppercase tracking-wide font-mono mb-0.5">
                {event.actorAgent?.slug ?? 'system'} · {event.kind.toLowerCase().replace(/_/g, ' ')}
              </div>
              <div className="text-sm text-forest-800 line-clamp-2">{event.title}</div>
              {event.summary && (
                <div className="text-xs text-forest-500 line-clamp-2 mt-0.5">{event.summary}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="text-forest-400 hover:text-forest -mt-0.5 -mr-0.5 p-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function accentForSeverity(sev: string): string {
  switch (sev) {
    case 'CRITICAL': return '#9A1B1B';
    case 'WARNING':  return '#9A6510';
    case 'NOTABLE':  return '#5A8C30';
    case 'INFO':
    default:         return '#9CC65C';
  }
}
