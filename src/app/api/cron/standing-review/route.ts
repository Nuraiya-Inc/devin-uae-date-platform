/**
 * POST /api/cron/standing-review
 *
 * Weekly standing lifecycle sweep (see src/lib/standing-engine.ts):
 *   - auto standing decay/restore (GOOD ⇄ AT_RISK ⇄ PAUSED)
 *   - drafts annual certification-lapse ApprovalRequests for officials
 *
 * Schedule: 0 4 * * 1  (Monday 04:00 UTC = 07:00 GST — before the workday).
 * Auth: Bearer CRON_SECRET. Concurrency: CronLock, 10-min TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { reviewStandings } from '@/lib/standing-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const LOCK_KEY = 'cron:standing-review';
const LOCK_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
  try {
    const existing = await prisma.cronLock.findUnique({ where: { key: LOCK_KEY } });
    if (existing && existing.acquiredAt > staleBefore) {
      return NextResponse.json({ skipped: true, reason: 'lock held', holder: existing.holder });
    }
    await prisma.cronLock.upsert({
      where: { key: LOCK_KEY },
      create: { key: LOCK_KEY, acquiredAt: now, holder: 'standing-review-runner' },
      update: { acquiredAt: now, holder: 'standing-review-runner' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Lock acquisition failed', detail: (err as Error).message },
      { status: 500 },
    );
  }

  try {
    const result = await reviewStandings(now);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: 'Standing review failed', detail: (err as Error).message },
      { status: 500 },
    );
  } finally {
    await prisma.cronLock.delete({ where: { key: LOCK_KEY } }).catch(() => {});
  }
}
