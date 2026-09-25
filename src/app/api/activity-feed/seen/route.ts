/**
 * POST /api/activity-feed/seen
 *
 * Advances the caller's UserNotificationPreference.lastSeenAt timestamp.
 * Called when the user opens the feed page or the bell popover, which
 * clears their unread badge.
 *
 * Optional body: { at?: ISO timestamp } — defaults to NOW. Allows the
 * client to pin "seen up to the timestamp of the most recent event
 * rendered" instead of NOW (avoids race where new events arrive between
 * the GET that rendered the list and this POST).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let at = new Date();
  try {
    const body = (await req.json().catch(() => null)) as { at?: string } | null;
    if (body?.at) {
      const parsed = new Date(body.at);
      if (!Number.isNaN(parsed.getTime())) at = parsed;
    }
  } catch {
    // ignore body parse errors — fall back to NOW
  }

  await prisma.userNotificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, lastSeenAt: at },
    update: { lastSeenAt: at },
  });

  return NextResponse.json({ ok: true, lastSeenAt: at.toISOString() });
}
