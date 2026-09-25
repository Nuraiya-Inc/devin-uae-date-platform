/**
 * POST /api/cron/activity-prune
 *
 * Weekly cleanup — hard-deletes ActivityEvent rows older than 90 days.
 * ActivityEvent is the user-facing event stream; AuditLog is the
 * compliance-grade record and stays untouched.
 *
 * Schedule: 0 1 * * 0  (Sunday 01:00 UTC = 05:00 GST). Low traffic window.
 *
 * Auth: Bearer token via CRON_SECRET env var. Returns 401 if mismatched.
 *
 * Concurrency: protected by CronLock with a 10-min TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOCK_KEY = 'cron:activity-prune';
const LOCK_TTL_MS = 10 * 60 * 1000;
const RETENTION_DAYS = 90;

export async function POST(req: NextRequest) {
  // Auth
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Acquire lock
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
  try {
    const existing = await prisma.cronLock.findUnique({ where: { key: LOCK_KEY } });
    if (existing && existing.acquiredAt > staleBefore) {
      return NextResponse.json({ skipped: true, reason: 'lock held', holder: existing.holder });
    }
    await prisma.cronLock.upsert({
      where: { key: LOCK_KEY },
      create: { key: LOCK_KEY, acquiredAt: now, holder: 'activity-prune-runner' },
      update: { acquiredAt: now, holder: 'activity-prune-runner' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Lock acquisition failed', detail: (err as Error).message },
      { status: 500 },
    );
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await prisma.activityEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return NextResponse.json({
      ok: true,
      cutoff: cutoff.toISOString(),
      deletedCount: result.count,
      retentionDays: RETENTION_DAYS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Prune failed', detail: (err as Error).message },
      { status: 500 },
    );
  } finally {
    // Release lock so re-runs aren't blocked for the full TTL
    await prisma.cronLock.delete({ where: { key: LOCK_KEY } }).catch(() => {});
  }
}
