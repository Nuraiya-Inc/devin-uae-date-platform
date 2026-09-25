'use server';

/**
 * Network inbox — staff server actions (exec-gated).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import type { ApplicationStatus, SuggestionStatus } from '@prisma/client';

async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!isExec(session.user.role)) redirect('/dashboard');
  return session.user;
}

export async function decideApplication(formData: FormData) {
  const user = await requireStaff();
  const id = String(formData.get('applicationId'));
  const decision = String(formData.get('decision')) as ApplicationStatus;
  if (decision !== 'APPROVED' && decision !== 'DECLINED') return;

  await prisma.application.update({
    where: { id },
    data: {
      status: decision,
      decisionNote: String(formData.get('decisionNote') ?? '').trim() || null,
      decidedById: user.id,
      decidedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'application.decide',
      entityType: 'Application',
      entityId: id,
      summary: `${user.name} ${decision.toLowerCase()} application ${id}`,
    },
  });
  revalidatePath('/network');
}

export async function updateSuggestionStatus(formData: FormData) {
  const user = await requireStaff();
  const id = String(formData.get('suggestionId'));
  const status = String(formData.get('status')) as SuggestionStatus;
  await prisma.suggestion.update({
    where: { id },
    data: {
      status,
      staffNote: String(formData.get('staffNote') ?? '').trim() || null,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'suggestion.update',
      entityType: 'Suggestion',
      entityId: id,
      summary: `${user.name} marked suggestion ${status}`,
    },
  });
  revalidatePath('/network');
}
