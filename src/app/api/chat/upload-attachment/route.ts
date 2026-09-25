/**
 * POST /api/chat/upload-attachment
 *
 * Streaming file-upload endpoint specifically for chat attachments. Bypasses
 * the multipart/formData() code path entirely:
 *
 *   - Browser sends the raw file body (Content-Type from the file itself)
 *   - Filename + size come in custom headers (X-Filename, X-File-Size)
 *   - Server streams body → disk in chunks via Node pipeline (never buffers
 *     the whole file in memory, never invokes req.formData())
 *   - Creates a Document row with INTERNAL sensitivity by default
 *   - Returns { docId, title, mimeType, sizeBytes } for the client to
 *     reference in the subsequent chat message
 *
 * The two-step pattern solves two problems at once:
 *   1. Avoids the proxy/multipart-parse bottleneck that caps file uploads
 *      at a few MB on most reverse-proxy defaults
 *   2. Makes the chat message itself a small JSON body so the actual chat
 *      round-trip is fast and never has size pressure
 *
 * Auth: user must be logged in. Document is owned by the uploader.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { persistUploadStream, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 270;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 401 });

  // Pull metadata from custom headers (set by the browser-side fetch())
  const rawFilename = req.headers.get('x-filename') ?? 'attachment';
  // Filenames sometimes arrive URL-encoded from the browser
  const filename = (() => {
    try { return decodeURIComponent(rawFilename); } catch { return rawFilename; }
  })();
  const mimeType = req.headers.get('content-type') ?? 'application/octet-stream';

  if (!req.body) {
    return NextResponse.json({ error: 'No request body.' }, { status: 400 });
  }

  // Create the Document row FIRST so we have the id for the storage path.
  // If anything fails after this, we delete the row.
  const doc = await prisma.document.create({
    data: {
      title: filename.replace(/\.[^.]+$/, '').slice(0, 200) || 'Untitled',
      kind: 'GENERAL',
      ipSensitivity: 'INTERNAL',
      entity: dbUser.entity,
      allowedBranches: [],
      tags: ['chat-attachment'],
      uploaderId: dbUser.id,
      mimeType,
      aiAnalysisPending: true,
    },
  });

  try {
    const persisted = await persistUploadStream(doc.id, req.body, filename, mimeType);
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        storagePath: persisted.storagePath,
        sizeBytes: persisted.sizeBytes,
        mimeType: persisted.mimeType,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'chat.attachment_upload',
        entityType: 'Document',
        entityId: updated.id,
        summary: `${dbUser.name} uploaded chat attachment: ${filename} (${(persisted.sizeBytes / 1024).toFixed(0)} KB)`,
        metadata: { sizeBytes: persisted.sizeBytes, mimeType: persisted.mimeType },
      },
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      docId: updated.id,
      title: updated.title,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
    });
  } catch (err) {
    // Roll back the Document row if streaming failed
    await prisma.document.delete({ where: { id: doc.id } }).catch(() => undefined);
    const status = err instanceof StorageError ? 400 : 500;
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status });
  }
}
