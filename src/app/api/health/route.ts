import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Liveness + DB-reachability check. Coolify reads this every 30s.
 *
 * Returns 200 when both the process is alive and Postgres responds to
 * a trivial SELECT 1; otherwise 503 with the reason.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      app: process.env.APP_NAME ?? 'UAE Palm Network',
      time: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ status: 'degraded', reason: msg }, { status: 503 });
  }
}
