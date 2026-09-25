/**
 * Standing lifecycle engine — the participation contract, enforced.
 *
 * Standing DECAYS mechanically (it is held, not owned — schema-documented):
 *   0 missed due quarters  → GOOD      (auto-restored the moment the record is complete)
 *   1 missed due quarter   → AT_RISK   (courteous warning; benefits intact)
 *   2+ missed due quarters → PAUSED    (benefits paused; path back always open)
 *
 * CERTIFICATION is annual and is NOT auto-revoked: a CERTIFIED/ELITE partner
 * with no approved report in 12 months gets a lapse DRAFTED as an
 * ApprovalRequest (kind TIER_CHANGE) for a network official to decide —
 * hard rule UPN-2: agents draft, officials approve.
 *
 * A quarter becomes "due" 30 days after it ends (matches the date block
 * shown to agents). Quarters before the partner joined never count.
 */

import { prisma } from '@/lib/db';
import { PartnerStanding, Prisma } from '@prisma/client';

const ACTIVE_STATUSES = ['SUBMITTED', 'VALIDATED', 'APPROVED'] as const;
const LOOKBACK_QUARTERS = 8;
export const LAPSE_ACTION = 'CERTIFICATION_LAPSE';

function qIndex(year: number, quarter: number): number {
  return year * 4 + (quarter - 1);
}
function qFromIndex(i: number): { year: number; quarter: number } {
  return { year: Math.floor(i / 4), quarter: (i % 4) + 1 };
}

/** Latest quarter whose 30-day reporting grace window has fully passed (KSA time). */
export function latestDueQuarterIndex(now: Date = new Date()): number {
  const gst = new Date(now.getTime() + 3 * 3600e3);
  const cut = new Date(gst.getTime() - 30 * 86400e3);
  const y = cut.getUTCFullYear();
  const q = Math.floor(cut.getUTCMonth() / 3) + 1;
  return qIndex(y, q) - 1;
}

export interface StandingReviewResult {
  reviewed: number;
  restored: string[];
  atRisk: string[];
  paused: string[];
  lapseDrafted: string[];
}

export async function reviewStandings(now: Date = new Date()): Promise<StandingReviewResult> {
  const latestDue = latestDueQuarterIndex(now);
  const result: StandingReviewResult = { reviewed: 0, restored: [], atRisk: [], paused: [], lapseDrafted: [] };

  const partners = await prisma.partner.findMany({
    include: {
      reports: {
        where: { status: { in: [...ACTIVE_STATUSES] } },
        select: { year: true, quarter: true, status: true, approvedAt: true },
      },
    },
  });

  const cer = await prisma.agent.findUnique({ where: { slug: 'cer-01' } });
  const pendingLapses = cer
    ? await prisma.approvalRequest.findMany({
        where: { kind: 'TIER_CHANGE', status: 'PENDING', agentId: cer.id },
        select: { payload: true },
      })
    : [];
  const pendingLapseRegistryNos = new Set(
    pendingLapses
      .map((r) => (r.payload as { action?: string; registryNo?: string } | null))
      .filter((p) => p?.action === LAPSE_ACTION)
      .map((p) => p!.registryNo),
  );

  for (const partner of partners) {
    result.reviewed++;
    const reported = new Set(partner.reports.map((r) => qIndex(r.year, r.quarter)));

    // Quarters before (and including) the join quarter are never owed.
    const joined = new Date(partner.createdAt.getTime() + 3 * 3600e3);
    const joinIdx = qIndex(joined.getUTCFullYear(), Math.floor(joined.getUTCMonth() / 3) + 1);

    // Count consecutive missed due quarters, newest backwards.
    let missed = 0;
    for (let i = latestDue; i > latestDue - LOOKBACK_QUARTERS && i > joinIdx; i--) {
      if (reported.has(i)) break;
      missed++;
    }

    const target: PartnerStanding = missed === 0 ? 'GOOD' : missed === 1 ? 'AT_RISK' : 'PAUSED';

    if (target !== partner.standing) {
      await prisma.partner.update({ where: { id: partner.id }, data: { standing: target } });
      await prisma.tierEvent.create({
        data: {
          partnerId: partner.id,
          fromTier: partner.tier,
          toTier: partner.tier,
          fromStanding: partner.standing,
          toStanding: target,
          reason:
            target === 'GOOD'
              ? 'Automatic restoration — reporting record complete'
              : `Automatic standing decay — ${missed} consecutive due quarter${missed === 1 ? '' : 's'} unreported`,
        },
      });
      const mq = qFromIndex(latestDue);
      await prisma.activityEvent.create({
        data: {
          kind: 'TIER_CHANGE_APPLIED',
          severity: target === 'PAUSED' ? 'WARNING' : target === 'AT_RISK' ? 'NOTABLE' : 'INFO',
          title:
            target === 'GOOD'
              ? `${partner.registryNo} standing restored to GOOD — record complete`
              : target === 'AT_RISK'
                ? `${partner.registryNo} is AT RISK — ${mq.year} Q${mq.quarter} unreported. Abdullah should reach out warmly.`
                : `${partner.registryNo} standing PAUSED — ${missed} quarters unreported. Benefits paused; path back open.`,
          payload: { registryNo: partner.registryNo, missed, latestDue: mq } as Prisma.InputJsonValue,
        },
      });
      if (target === 'GOOD') result.restored.push(partner.registryNo);
      if (target === 'AT_RISK') result.atRisk.push(partner.registryNo);
      if (target === 'PAUSED') result.paused.push(partner.registryNo);
    }

    // Annual certification renewal: CERTIFIED/ELITE with no APPROVED report
    // in 365 days → draft the lapse for official decision (never auto-apply).
    if ((partner.tier === 'CERTIFIED' || partner.tier === 'ELITE') && cer && !pendingLapseRegistryNos.has(partner.registryNo)) {
      const yearAgo = new Date(now.getTime() - 365 * 86400e3);
      const renewedRecently = partner.reports.some(
        (r) => r.status === 'APPROVED' && r.approvedAt && r.approvedAt > yearAgo,
      );
      const oldEnough = partner.createdAt < yearAgo;
      if (oldEnough && !renewedRecently) {
        await prisma.approvalRequest.create({
          data: {
            kind: 'TIER_CHANGE',
            severity: 'HIGH',
            agentId: cer.id,
            // 30 days to decide — the weekly sweep re-drafts if it expires undecided.
            expiresAt: new Date(now.getTime() + 30 * 86400e3),
            summary: `Certification lapse — ${partner.registryNo} (${partner.nameEn}): no approved report in 12 months`,
            detail:
              `${partner.nameEn} holds ${partner.tier} but has not had a quarterly report approved in the last 365 days. ` +
              `Certification is annual and renews through reporting. Recommended action: lapse to REGISTERED with a warm ` +
              `re-entry path (standing and history preserved; re-certification available after 4 fresh approved quarters). ` +
              `Approving applies the change; rejecting keeps the current tier.`,
            payload: {
              action: LAPSE_ACTION,
              registryNo: partner.registryNo,
              partnerId: partner.id,
              fromTier: partner.tier,
              toTier: 'REGISTERED',
            } as Prisma.InputJsonValue,
          },
        });
        result.lapseDrafted.push(partner.registryNo);
      }
    }
  }

  return result;
}
