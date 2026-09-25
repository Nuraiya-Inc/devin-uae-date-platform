/**
 * POST /api/account/change-password
 *
 * Self-serve password rotation. Verifies the current password (bcrypt
 * compare against User.passwordHash), then writes a new bcrypt hash.
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Returns 200 { ok: true } on success.
 * Returns 400 with a clear error message on validation / wrong-current-pw.
 *
 * Audit: writes one AuditLog row per successful rotation. Never logs
 * either password (plaintext or hash).
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { currentPassword, newPassword } = (body ?? {}) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are both required.' },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `New password is too long (max ${MAX_PASSWORD_LENGTH} characters).` },
      { status: 400 },
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from your current password.' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) {
    // Same response shape as success-side validation, but rate-limit-friendly:
    // we don't reveal which field was wrong beyond "current password."
    return NextResponse.json(
      { error: 'Current password is incorrect.' },
      { status: 400 },
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'account.password.changed',
      entityType: 'User',
      entityId: user.id,
      summary: `${user.name} changed their password`,
      metadata: { email: user.email, ipAddress: req.headers.get('x-forwarded-for') ?? null },
    },
  });

  return NextResponse.json({ ok: true });
}
