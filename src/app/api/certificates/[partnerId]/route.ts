/**
 * GET /api/certificates/[partnerId] — official membership certificate PDF.
 * Staff can fetch any partner's; a partner-linked user only their own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import { generateCertificate } from '@/lib/certificate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { partnerId } = await params;
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

  // Access: staff, or the partner's own linked user
  if (!isExec(session.user.role) && partner.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Paused standing pauses benefits — including the certificate itself.
  // (Staff can still generate it for review purposes.)
  if (partner.standing === 'PAUSED' && !isExec(session.user.role)) {
    return NextResponse.json(
      {
        error: 'Certificate unavailable while standing is paused',
        detail: 'Complete your reporting record with Abdullah to restore standing — the certificate returns immediately.',
      },
      { status: 403 },
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? `https://${req.headers.get('host')}`;
  const pdf = await generateCertificate({
    partnerId: partner.id,
    registryNo: partner.registryNo,
    nameEn: partner.nameEn,
    nameAr: partner.nameAr,
    tier: partner.tier,
    region: partner.region,
    foundingMember: partner.foundingMember,
    issuedAt: new Date(),
    baseUrl,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'certificate.generate',
      entityType: 'Partner',
      entityId: partner.id,
      summary: `Certificate generated for ${partner.registryNo} (${partner.tier})`,
    },
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="UPN-Certificate-${partner.registryNo}.pdf"`,
    },
  });
}
