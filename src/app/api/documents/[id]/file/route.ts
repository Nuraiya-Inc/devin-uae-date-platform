/**
 * GET /api/documents/[id]/file — stream the stored file back to the user.
 *
 * ACL: userCanReadDocument applied — if the caller can't see this doc by
 * IP-sensitivity / entity rules, 403.
 *
 * Headers set:
 *   - Content-Type from stored mimeType (fallback application/octet-stream)
 *   - Content-Disposition: inline for viewable types, attachment otherwise
 *   - X-Content-Type-Options: nosniff
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userCanReadDocument } from '@/lib/access';
import { streamStoredFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INLINE_VIEWABLE = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/markdown',
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || !doc.storagePath) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { reportsToAgent: { select: { branch: true } } },
  });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 401 });

  const allowed = userCanReadDocument(
    { role: dbUser.role, entity: dbUser.entity, canAccessAllEntities: dbUser.canAccessAllEntities },
    dbUser.reportsToAgent?.branch ?? null,
    { ipSensitivity: doc.ipSensitivity, entity: doc.entity, allowedBranches: doc.allowedBranches },
  );
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let streamed;
  try {
    streamed = await streamStoredFile(doc.storagePath);
  } catch {
    return NextResponse.json({ error: 'File missing on disk.' }, { status: 410 });
  }

  // Audit access — only for sensitive grades to keep noise down
  if (['IP_CRITICAL', 'INVESTOR_RESTRICTED', 'COMMERCIAL_SENSITIVE'].includes(doc.ipSensitivity)) {
    prisma.auditLog
      .create({
        data: {
          userId: dbUser.id,
          action: 'document.access',
          entityType: 'Document',
          entityId: doc.id,
          summary: `${dbUser.name} accessed ${doc.title}`,
          metadata: { ipSensitivity: doc.ipSensitivity, mimeType: doc.mimeType },
        },
      })
      .catch(() => undefined);
  }

  const mimeType = doc.mimeType ?? 'application/octet-stream';
  const url = new URL(req.url);
  const forceDownload = url.searchParams.get('download') === '1';
  const inline = !forceDownload && INLINE_VIEWABLE.has(mimeType);
  const safeFilename = `${doc.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.${(doc.storagePath.split('.').pop() ?? 'bin')}`;

  return new NextResponse(streamed.stream, {
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(streamed.sizeBytes),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeFilename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=60',
    },
  });
}
