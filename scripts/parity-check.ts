/**
 * parity-check.ts — exercises the governance invariants directly against the
 * tool executors (no Anthropic key needed). Run from app root:
 *   npx tsx scripts/parity-check.ts
 *
 * Checks:
 *   UPN-2  request_tier_change creates a PENDING ApprovalRequest and does NOT
 *          mutate partner.tier.
 *   UPN-3  get_regional_benchmark returns MODELED/suppressed for <3 partners
 *          and MEASURED aggregates for ≥3; portal users are locked to self.
 */

import { prisma } from '../src/lib/db';
import {
  executeRequestTierChange,
  executeGetRegionalBenchmark,
  executeGetPartnerProfile,
  type ToolExecuteContext,
} from '../src/lib/tool-catalog';

async function main() {
  const agent = await prisma.agent.findUniqueOrThrow({ where: { slug: 'cer-01' } });
  const staff = await prisma.user.findUniqueOrThrow({ where: { email: 'demo.official@uaepalm.ae' } });
  const ctx: ToolExecuteContext = { agent, user: staff, threadId: null, consultationDepth: 0 };

  // ── UPN-2 ──
  const partner = await prisma.partner.findFirstOrThrow({ orderBy: { registryNo: 'asc' } });
  const before = partner.tier;
  const res = await executeRequestTierChange(
    {
      registry_no: partner.registryNo,
      to_tier: 'CERTIFIED',
      reason: 'Parity check — should only draft, not apply',
      evidence: 'Automated TD-check',
    },
    ctx,
  );
  const after = await prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
  const approval = await prisma.approvalRequest.findFirst({
    where: { kind: 'TIER_CHANGE', status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n=== UPN-2: tier change is drafted, not applied ===');
  console.log('tool result:', res.text.split('\n')[0]);
  console.log(`tier before=${before} after=${after.tier}  → ${before === after.tier ? 'UNCHANGED ✓' : 'MUTATED ✗'}`);
  console.log(`pending ApprovalRequest: ${approval ? `yes (${approval.id.slice(-6)}) ✓` : 'NO ✗'}`);

  // ── UPN-3: suppression floor ──
  console.log('\n=== UPN-3: aggregation floor (MIN_AGGREGATE=3) ===');
  for (const region of ['FUJAIRAH', 'ABU_DHABI'] as const) {
    const r = await executeGetRegionalBenchmark({ region }, ctx);
    const kind = r.text.startsWith('MEASURED') ? 'MEASURED' : r.text.startsWith('MODELED') ? 'MODELED (suppressed)' : 'UNKNOWN';
    console.log(`${region.padEnd(10)} → ${kind}`);
  }

  // cross-partner leak check: portal user resolved to own record regardless
  const portalUser = await prisma.user.findUnique({ where: { email: 'demo.farm@partners.uaepalm.ae' } });
  if (portalUser) {
    const portalCtx: ToolExecuteContext = { agent, user: portalUser, threadId: null, consultationDepth: 0 };
    const other = await prisma.partner.findFirst({ where: { userId: null }, orderBy: { registryNo: 'asc' } });
    const own = await prisma.partner.findFirst({ where: { userId: portalUser.id } });
    // get_partner_profile ignores registry_no for portal users (UPN-3)
    const r = await executeGetPartnerProfile({ registry_no: other?.registryNo }, portalCtx);
    const leakedOther = !!(other && r.text.includes(other.registryNo) && own && !r.text.includes(own.registryNo));
    console.log(`portal user asked for ${other?.registryNo} → got ${leakedOther ? 'OTHER PARTNER ✗ LEAK' : 'own record only ✓'}`);
  }

  console.log('\nDone.');
}

main().finally(() => prisma.$disconnect());
