/**
 * POST /api/directory/[id]/promote
 *
 * TD4 — promote a DirectoryEntry into a registered Partner:
 *   - creates exactly one Partner with a fresh sequential registry number
 *   - sets DirectoryEntry.relationship = REGISTERED and links partnerId
 *   - writes an AuditLog row + a PARTNER_ONBOARDED activity event
 *
 * UPN-2: the new partner is created at the default REGISTERED tier — no
 * tier/certification/standing is set here, so no ApprovalRequest is needed.
 * Any subsequent tier change goes through the approvals queue.
 *
 * UPN-7: only after this call does the entity enter partner aggregates —
 * DirectoryEntry rows are never counted.
 *
 * Staff-only (TEAM_MEMBER and above). Idempotent via the unique partnerId
 * link: a second call returns 409 rather than a duplicate Partner.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PartnerType, Prisma, Region, RelationshipStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import { nextRegistryNo } from '@/lib/tool-catalog';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PARTNER_TYPES = Object.values(PartnerType) as string[];
const REGIONS = Object.values(Region) as string[];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAtLeast(session.user.role, 'TEAM_MEMBER')) {
    return NextResponse.json({ error: 'Staff only' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? '');
  const region = String(body.region ?? '');
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';

  const entry = await prisma.directoryEntry.findUnique({
    where: { id },
    include: { partner: { select: { registryNo: true } } },
  });
  if (!entry) return NextResponse.json({ error: 'Directory entry not found' }, { status: 404 });

  if (entry.partnerId || entry.relationship === 'REGISTERED') {
    return NextResponse.json(
      { error: `Already registered${entry.partner ? ` as ${entry.partner.registryNo}` : ''}` },
      { status: 409 },
    );
  }
  if (entry.relationship === 'DECLINED') {
    return NextResponse.json({ error: 'Entry is marked DECLINED — update its status first' }, { status: 400 });
  }
  if (!PARTNER_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of ${PARTNER_TYPES.join(', ')}` }, { status: 400 });
  }

  const resolvedRegion = entry.region ?? region;
  if (!resolvedRegion || !REGIONS.includes(resolvedRegion)) {
    return NextResponse.json(
      { error: 'This entry has no single emirate — supply a region to register it under' },
      { status: 400 },
    );
  }

  // Don't corrupt the registry with a same-name duplicate in the same emirate
  // (mirrors bulk_register_partners' dedupe rule).
  const dup = await prisma.partner.findFirst({
    where: { nameEn: { equals: entry.nameEn, mode: 'insensitive' }, region: resolvedRegion as Region },
    select: { registryNo: true },
  });
  if (dup) {
    return NextResponse.json(
      { error: `A partner named ${entry.nameEn} already exists in this emirate (${dup.registryNo})` },
      { status: 409 },
    );
  }

  const registryNo = await nextRegistryNo(resolvedRegion, new Map());

  const partner = await prisma.$transaction(async (tx) => {
    const created = await tx.partner.create({
      data: {
        registryNo,
        nameEn: entry.nameEn,
        nameAr: entry.nameAr,
        type: type as PartnerType,
        region: resolvedRegion as Region,
        city: city || entry.location,
        contactName: contactName || null,
        contactEmail: entry.email,
        contactPhone: entry.phone,
        preferredLang: 'ar',
        profileFacts: {
          source: 'directory_promotion',
          directoryEntryId: entry.id,
          promotedBy: session.user.email ?? session.user.id,
        } as Prisma.InputJsonValue,
      },
    });
    // The unique constraint on DirectoryEntry.partnerId makes a double-link
    // impossible; the conditional update also fails the race cheaply.
    const linked = await tx.directoryEntry.updateMany({
      where: { id: entry.id, partnerId: null, relationship: { not: 'REGISTERED' } },
      data: { partnerId: created.id, relationship: RelationshipStatus.REGISTERED },
    });
    if (linked.count === 0) throw new Error('Entry was promoted concurrently — aborting duplicate partner');
    return created;
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'directory.promote',
      entityType: 'DirectoryEntry',
      entityId: entry.id,
      summary: `${session.user.name} promoted directory entry "${entry.nameEn}" to partner ${partner.registryNo}`,
      metadata: { partnerId: partner.id, registryNo: partner.registryNo, type, region: resolvedRegion },
    },
  });

  await recordActivity({
    kind: 'PARTNER_ONBOARDED',
    severity: 'NOTABLE',
    actorUser: session.user as never,
    entityType: 'Partner',
    entityId: partner.id,
    title: `${partner.registryNo} · ${partner.nameEn} registered from the directory`,
  });

  return NextResponse.json({ ok: true, registryNo: partner.registryNo, partnerId: partner.id });
}
