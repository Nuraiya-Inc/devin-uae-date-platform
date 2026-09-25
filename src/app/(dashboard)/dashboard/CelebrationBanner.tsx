'use client';

/**
 * CelebrationBanner — fires a confetti burst + shows a celebratory banner
 * when a celebration trigger is active (personal-best week, data-room
 * milestone crossed, multi-week growth streak).
 *
 * De-dup strategy: writes the trigger key to localStorage on fire, so the
 * same celebration doesn't re-fire on every page navigation. New triggers
 * (e.g. crossing the 50% data-room mark a week later) get a new key and
 * re-fire fresh.
 *
 * The banner itself stays visible for the whole session — confetti is just
 * the one-shot moment. User can dismiss the banner with the × button.
 */

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { CelebrationTriggers } from '@/lib/dashboard-stats';

interface Props {
  triggers: CelebrationTriggers;
}

const STORAGE_KEY = 'safa.celebration.lastFired';
const DISMISS_KEY = 'safa.celebration.dismissed';

export default function CelebrationBanner({ triggers }: Props) {
  const { isPersonalBestWeek, dataRoomMilestone, thisWeekTotal, growthStreakWeeks, triggerKey } = triggers;

  // Decide whether ANY celebration is active. If not, render nothing.
  const hasReason =
    isPersonalBestWeek || dataRoomMilestone !== null || growthStreakWeeks >= 3 || thisWeekTotal >= 10;

  const [dismissed, setDismissed] = useState(false);
  const firedRef = useRef(false);

  // Fire confetti once per (triggerKey) — gated by localStorage so it doesn't
  // re-fire on every soft nav. Skipped entirely if the user dismissed today.
  useEffect(() => {
    if (!hasReason || firedRef.current || typeof window === 'undefined') return;

    try {
      const lastFired = window.localStorage.getItem(STORAGE_KEY);
      const dismissedKey = window.localStorage.getItem(DISMISS_KEY);

      // If they dismissed this exact trigger, honour that for the rest of the session
      if (dismissedKey === triggerKey) {
        setDismissed(true);
        return;
      }

      // Already celebrated this trigger? Don't refire.
      if (lastFired === triggerKey) return;

      firedRef.current = true;
      window.localStorage.setItem(STORAGE_KEY, triggerKey);

      // Brand-coloured confetti — lime + brand greens
      const palette = ['#E1E32A', '#004923', '#006950', '#2C8255', '#90C038'];

      // Burst 1: from the centre, big spread
      confetti({
        particleCount: 90,
        spread: 80,
        startVelocity: 35,
        origin: { y: 0.35 },
        colors: palette,
      });
      // Burst 2: left side
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.5 },
          colors: palette,
        });
      }, 180);
      // Burst 3: right side
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.5 },
          colors: palette,
        });
      }, 360);
    } catch {
      // localStorage blocked (private mode, etc.) — just fire once per mount
      firedRef.current = true;
    }
  }, [hasReason, triggerKey]);

  if (!hasReason || dismissed) return null;

  // Compose the banner copy from active triggers
  const lines: string[] = [];
  if (isPersonalBestWeek) lines.push('Best week in the last 8 — you outshipped every prior week.');
  if (dataRoomMilestone)
    lines.push(`Series A data room is ${dataRoomMilestone}% complete.${dataRoomMilestone === 100 ? ' Ship it.' : ''}`);
  if (growthStreakWeeks >= 3)
    lines.push(`${growthStreakWeeks}-week growth streak. Don't break the chain.`);
  if (lines.length === 0 && thisWeekTotal >= 10)
    lines.push(`${thisWeekTotal} things shipped this week and counting.`);

  const headline = isPersonalBestWeek
    ? '🎉 New personal best'
    : dataRoomMilestone === 100
    ? '🚀 Data room: shipped'
    : dataRoomMilestone
    ? `🎯 Milestone: ${dataRoomMilestone}%`
    : growthStreakWeeks >= 3
    ? `📈 ${growthStreakWeeks}-week streak`
    : '✨ Strong week';

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, triggerKey);
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <section
      className="mb-6 rounded-xl border p-5 shadow-card relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #E1E32A 0%, #C5D826 35%, #90C038 75%, #2C8255 100%)',
        borderColor: '#90C038',
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-brand/70 hover:text-brand text-xs px-2 py-1 rounded hover:bg-white/30"
      >
        ×
      </button>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-lg font-semibold text-brand tracking-tight">{headline}</span>
      </div>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-sm text-brand-900 leading-relaxed">
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}
