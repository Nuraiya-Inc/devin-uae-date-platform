/**
 * Storage helper — read/write files in /app/uploads.
 *
 * In Coolify, /app/uploads is mounted as a persistent volume so uploads
 * survive container redeploys. The path is hardcoded here so we don't
 * accidentally serve files from arbitrary paths if env vars are missing.
 *
 * Storage layout:
 *   /app/uploads/documents/<doc-id>/original.<ext>
 *
 * We use the Document.id (cuid) as the folder name. Filenames are derived
 * from the original upload but only the extension is preserved — never
 * the original name on disk — to prevent path-traversal attacks.
 */

import { mkdir, writeFile, readFile, stat, unlink } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const UPLOADS_ROOT = path.resolve(process.env.UPLOADS_ROOT || '/app/uploads');
const DOCUMENTS_DIR = path.join(UPLOADS_ROOT, 'documents');
// 50 MB per file. Phone photos at full resolution are routinely 5-8 MB; this
// gives plenty of headroom for hi-res scans, photographed multi-page documents,
// and large PDFs. The image preprocessor (lib/image-preprocess.ts) downscales
// images further before sending to Anthropic, so this is the upload cap, not
// the vision-API cap.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export class StorageError extends Error {}

/** Safe extension extractor — letters/numbers only, max 8 chars, lowercased. */
export function safeExtension(originalName: string | null | undefined): string {
  if (!originalName) return 'bin';
  const ext = path.extname(originalName).slice(1).toLowerCase();
  if (!ext) return 'bin';
  if (!/^[a-z0-9]+$/.test(ext)) return 'bin';
  if (ext.length > 8) return 'bin';
  return ext;
}

/** Build the relative storage path for a document — caller stores this. */
export function buildStoragePath(documentId: string, ext: string): string {
  return `documents/${documentId}/original.${ext}`;
}

/** Resolve a relative storage path to its absolute on-disk path, with traversal protection. */
function resolveAbsolute(relativeStoragePath: string): string {
  const resolved = path.resolve(UPLOADS_ROOT, relativeStoragePath);
  if (!resolved.startsWith(UPLOADS_ROOT + path.sep) && resolved !== UPLOADS_ROOT) {
    throw new StorageError('Path traversal blocked.');
  }
  return resolved;
}

/** Persist an uploaded file Blob to disk under documents/<id>/original.<ext>. */
export async function persistUpload(
  documentId: string,
  file: File,
): Promise<{ storagePath: string; sizeBytes: number; mimeType: string }> {
  if (!file || file.size === 0) throw new StorageError('Empty upload.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new StorageError(`File too large: ${Math.round(file.size / 1024 / 1024)} MB. Limit is 25 MB.`);
  }

  const ext = safeExtension(file.name);
  const rel = buildStoragePath(documentId, ext);
  const abs = resolveAbsolute(rel);
  const dir = path.dirname(abs);

  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buffer);

  return {
    storagePath: rel,
    sizeBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

/**
 * Streaming persist — writes a Web ReadableStream directly to disk in chunks.
 * Never buffers the entire body in memory, never calls req.formData().
 *
 * Use this for the two-step chat upload path so big files don't hit the
 * formData() multipart parsing bottleneck (which proxies sometimes truncate
 * before Next.js sees the full request).
 *
 * Returns the same shape as persistUpload for caller-side compatibility.
 */
export async function persistUploadStream(
  documentId: string,
  body: ReadableStream<Uint8Array>,
  filename: string,
  declaredMimeType: string,
): Promise<{ storagePath: string; sizeBytes: number; mimeType: string }> {
  const ext = safeExtension(filename);
  const rel = buildStoragePath(documentId, ext);
  const abs = resolveAbsolute(rel);
  const dir = path.dirname(abs);

  await mkdir(dir, { recursive: true });

  // Convert the Web stream to a Node stream and pipe to disk.
  // We tally bytes as we go so we can enforce the size cap mid-stream
  // and abort cleanly (vs. buffering everything then complaining).
  let bytesWritten = 0;
  const sizeCheck = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesWritten += chunk.byteLength;
      if (bytesWritten > MAX_UPLOAD_BYTES) {
        controller.error(new StorageError(
          `File too large: ${Math.round(bytesWritten / 1024 / 1024)} MB. Limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
        ));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const piped = body.pipeThrough(sizeCheck);
  const nodeReadable = Readable.fromWeb(piped as never);
  const writeStream = createWriteStream(abs);

  try {
    await pipeline(nodeReadable, writeStream);
  } catch (err) {
    // Clean up partial file on error
    await unlink(abs).catch(() => undefined);
    throw err instanceof StorageError ? err : new StorageError(`Upload stream failed: ${(err as Error).message}`);
  }

  if (bytesWritten === 0) {
    await unlink(abs).catch(() => undefined);
    throw new StorageError('Empty upload.');
  }

  return {
    storagePath: rel,
    sizeBytes: bytesWritten,
    mimeType: declaredMimeType || 'application/octet-stream',
  };
}

/** Read a stored file into a Buffer — for small files / inline use. */
export async function readStoredFile(relativeStoragePath: string): Promise<Buffer> {
  const abs = resolveAbsolute(relativeStoragePath);
  return readFile(abs);
}

/** Streaming read — for serving downloads via NextResponse. */
export async function streamStoredFile(relativeStoragePath: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  sizeBytes: number;
}> {
  const abs = resolveAbsolute(relativeStoragePath);
  const s = await stat(abs);
  const node = createReadStream(abs);
  // Convert Node stream to Web stream (Next.js 15 Response expects ReadableStream)
  const web = Readable.toWeb(node) as ReadableStream<Uint8Array>;
  return { stream: web, sizeBytes: s.size };
}

export const STORAGE_LIMITS = {
  maxBytes: MAX_UPLOAD_BYTES,
  maxMB: MAX_UPLOAD_BYTES / 1024 / 1024,
};
