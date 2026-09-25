/**
 * POST /api/approvals/[id]/reject
 *
 * Reject a pending ApprovalRequest. No underlying action runs. Optional
 * reason is recorded for audit + so the agent (next turn) can see why.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isExec(session.user.role)) {
    return NextResponse.json({ error: 'Only execs can reject requests' }, { status: 403 });
  }

  const { id } = await params;
  const approval = await prisma.approvalRequest.findUnique({
    where: { id },
    include: { agent: { select: { slug: true } } },
  });
  if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  if (approval.status !== 'PENDING') {
    return NextResponse.json({ error: `Approval is already ${approval.status}` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : undefined;

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      decidedById: session.user.id,
      decidedAt: new Date(),
      rejectReason: reason ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      agentId: approval.agentId,
      action: 'approval.reject',
      entityType: 'ApprovalRequest',
      entityId: approval.id,
      summary: `${session.user.name} rejected ${approval.kind} for ${approval.agent.slug}${reason ? `: "${reason}"` : ''}`,
      metadata: { kind: approval.kind, reason },
    },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
