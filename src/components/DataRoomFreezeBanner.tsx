/**
 * DataRoomFreezeBanner — surfaces the data-room freeze AND the autonomous
 * agent pause. Pulls state from facts so there's a single source of truth.
 *
 * Important framing: both freezes are on AUTOMATED agent work, not human
 * use. Humans can still browse, view, download, upload, approve manually,
 * AND chat with agents on-demand. The banner says this explicitly so people
 * don't think the platform is "down."
 *
 * Three render variants (controlled via `variant` prop):
 *   - "full"     — large card with full breakdown (used on /data-room/*)
 *   - "compact"  — single-line strip (used on /review)
 *   - "pill"     — tiny "FROZEN" tag (used in the sidebar nav item)
 *
 * When BOTH freezes are inactive, the component renders nothing.
 */

import { getDataRoomFreezeStatus, getAutonomousAgentPauseStatus } from '@/facts';
import { Snowflake, PauseCircle } from 'lucide-react';

type Variant = 'full' | 'compact' | 'pill';

export default function DataRoomFreezeBanner({
  variant = 'full',
}: {
  variant?: Variant;
}) {
  const freeze = getDataRoomFreezeStatus();
  const pause = getAutonomousAgentPauseStatus();
  if (!freeze.active && !pause.active) return null;

  // Compute days-to-lift for the countdown — use the later of the two ends.
  const fEnd = freeze.endsOn ?? '';
  const pEnd = pause.endsOn ?? '';
  const endIso = freeze.active && pause.active ? (fEnd > pEnd ? fEnd : pEnd) : freeze.active ? fEnd : pEnd;
  const today = new Date();
  const ends = endIso ? new Date(endIso) : today;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilLift = Math.max(
    0,
    Math.ceil((ends.getTime() - today.getTime()) / msPerDay),
  );

  if (variant === 'pill') {
    return (
      <span className="ml-1 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold bg-amber-200/30 text-amber-200 border border-amber-200/40">
        Frozen
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-3 text-sm">
        <Snowflake className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
        <div className="flex-1">
          <span className="font-medium">Platform in focus week</span>
          <span className="text-amber-800/80 ml-2">
            {freeze.active && 'Data room frozen. '}
            {pause.active && 'Autonomous agent runs paused. '}
            Auto-lifts in {daysUntilLift} day{daysUntilLift === 1 ? '' : 's'}. Your human actions still work — chat, approve, upload, download.
          </span>
        </div>
      </div>
    );
  }

  // "full"
  return (
    <div className="bg-cream border border-brand-200 rounded-xl p-5 mb-6 shadow-card">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center flex-shrink-0">
          {pause.active ? (
            <PauseCircle className="w-5 h-5" strokeWidth={2} />
          ) : (
            <Snowflake className="w-5 h-5" strokeWidth={2} />
          )}
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-brand">
            {freeze.active && pause.active
              ? 'Platform in focus week — agent automation paused'
              : freeze.active
                ? 'Data room freeze — agent production paused'
                : 'Autonomous agent runs paused'}
          </div>
          <div className="text-xs text-muted mt-0.5">
            Auto-lifts {endIso} ({daysUntilLift} day{daysUntilLift === 1 ? '' : 's'})
          </div>
        </div>
      </div>

      <p className="text-sm text-ink leading-relaxed mb-3">
        CEO + Senior Financial Advisor finalising the canonical capital baseline, financial story,
        Gantt charts, timelines, and strategic direction. Autonomous agent activity is paused to
        optimise credit usage and let new knowledge land before agents act on it.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-white/70 border border-brand-100 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-brand font-semibold mb-1.5">
            ✓ Still available to you
          </div>
          <ul className="space-y-0.5 text-ink/85">
            <li>• Browse, view, download every document</li>
            <li>• Approve / reject in <span className="font-mono text-brand">/review</span></li>
            <li>• Upload via <span className="font-mono text-brand">/documents</span></li>
            <li>• Chat with any agent on-demand</li>
            <li>• Email an agent — they&apos;ll respond</li>
            <li>• Run quality grades in <span className="font-mono text-brand">/diligence-audit</span></li>
          </ul>
        </div>
        <div className="bg-white/70 border border-amber-100 rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold mb-1.5">
            ✗ Paused this week
          </div>
          <ul className="space-y-0.5 text-ink/85">
            {pause.active && (
              <>
                <li>• Daily 7am autonomous agent sweep</li>
                <li>• Layla morning brief + Saqib pulse</li>
                <li>• Reactor cron (event-triggered runs)</li>
              </>
            )}
            {freeze.active && (
              <>
                <li>• <span className="font-mono">promote_to_dataroom</span> (agent)</li>
                <li>• <span className="font-mono">create / update / attach</span> (agent)</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <p className="text-[11px] text-muted mt-3 leading-relaxed">
        After {endIso} (or earlier — flip <span className="font-mono">SAFA_FACTS.capital.autonomousAgentPause.active</span> to false), autonomous
        runs resume with whatever financial baseline + strategy you and Saqib have locked.
      </p>
    </div>
  );
}
