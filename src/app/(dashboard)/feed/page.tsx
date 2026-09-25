/**
 * /feed — live activity feed across all branches.
 *
 * The "Real-time Dashboard" for the org: see what every agent has shipped,
 * blocked, escalated, or posted to channels, in chronological order with
 * filters by branch / severity. Updates every 20s via client-side poll.
 *
 * Distinct from /activity (which renders the broad AuditLog for compliance).
 * /feed is the curated, semantic event stream from ActivityEvent — what
 * humans and Layla actually consume.
 *
 * Access: open to all authenticated users. Per-user filtering (watched
 * branches, muted agents, severity floor) is applied via
 * UserNotificationPreference.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import ActivityFeed from '@/components/feed/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; agentSlug?: string; severity?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const sp = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">Activity feed</h1>
      <p className="text-sm text-forest-500 mb-6">
        Live stream of agent ships, channel posts, RAID entries, task completions, and run lifecycle.
        Updates every 20 seconds.
      </p>

      <ActivityFeed
        initialBranch={sp.branch}
        initialAgentSlug={sp.agentSlug}
        initialSeverity={sp.severity}
      />
    </div>
  );
}
