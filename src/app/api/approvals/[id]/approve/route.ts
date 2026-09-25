/**
 * POST /api/approvals/[id]/approve
 *
 * Approve a pending ApprovalRequest and execute the underlying action.
 * v0 handles kind=TIER_CHANGE (applies the tier/standing change and
 * writes a TierEvent). Other kinds are recorded as approved without an
 * execution side-effect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PartnerTier, PartnerStanding } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isExec(session.user.role)) {
    return NextResponse.json({ error: 'Only network officials can approve requests' }, { status: 403 });
  }

  const { id } = await params;
  const approval = await prisma.approvalRequest.findUnique({
    where: { id },
    include: { agent: { select: { slug: true, name: true } } },
  });
  if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  if (approval.status !== 'PENDING') {
    return NextResponse.json({ error: `Approval is already ${approval.status}` }, { status: 400 });
  }

  let executionResult: Record<string, unknown> = {};
  let execStatus: 'APPROVED' | 'EXECUTE_FAILED' = 'APPROVED';

  try {
    if (approval.kind === 'TIER_CHANGE') {
      const p = approval.payload as {
        partnerId: string;
        registryNo: string;
        fromTier: string;
        toTier: string;
        fromStanding: string;
        toStanding: string;
        reason: string;
      };
      const partner = await prisma.partner.findUnique({ where: { id: p.partnerId } });
      if (!partner) throw new Error(`Partner ${p.registryNo} no longer exists`);

      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          tier: p.toTier as PartnerTier,
          standing: p.toStanding as PartnerStanding,
        },
      });
      await prisma.tierEvent.create({
        data: {
          partnerId: partner.id,
          fromTier: partner.tier,
          toTier: p.toTier as PartnerTier,
          fromStanding: partner.standing,
          toStanding: p.toStanding as PartnerStanding,
          reason: p.reason,
          approvalId: approval.id,
        },
      });
      await recordActivity({
        kind: 'TIER_CHANGE_APPLIED',
        actorUser: session.user as never,
        entityType: 'Partner',
        entityId: partner.id,
        title: `${p.registryNo}: ${partner.tier}/${partner.standing} → ${p.toTier}/${p.toStanding}`,
        summary: p.reason,
      });
      executionResult = { applied: true, registryNo: p.registryNo, toTier: p.toTier, toStanding: p.toStanding };
    } else {
      // Other kinds: approval recorded, no automatic execution in v0.
      executionResult = { applied: false, note: `Kind ${approval.kind} approved without automatic execution.` };
    }
  } catch (err) {
    execStatus = 'EXECUTE_FAILED';
    executionResult = { error: err instanceof Error ? err.message : 'unknown' };
  }

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: execStatus,
      decidedById: session.user.id,
      decidedAt: new Date(),
      result: executionResult as Prisma.InputJsonValue,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      agentId: approval.agentId,
      action: execStatus === 'APPROVED' ? 'approval.approve' : 'approval.approve.failed',
      entityType: 'ApprovalRequest',
      entityId: approval.id,
      summary: `${session.user.name} approved ${approval.kind} for ${approval.agent.slug}${execStatus === 'EXECUTE_FAILED' ? ' (execution failed)' : ''}`,
      metadata: { kind: approval.kind, result: executionResult } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: execStatus === 'APPROVED', status: updated.status, result: executionResult });
}
