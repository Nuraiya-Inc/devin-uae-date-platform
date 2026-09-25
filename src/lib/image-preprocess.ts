/**
 * Image preprocessing for Anthropic's vision API.
 *
 * Anthropic's messages.create() has a hard 5 MB cap per image content
 * block. Phone photos blow past that routinely (5–8 MB JPEGs are normal).
 * Without this pipeline, a 6 MB iPhone photo of a bank statement uploads
 * cleanly into our storage but silently fails when the agent tries to
 * look at it.
 *
 * This module takes ANY image buffer + mime, and returns a buffer that:
 *   - is auto-rotated based on EXIF (so sideways phone photos read upright)
 *   - has its longest edge ≤ 1568 px (Anthropic's recommended max — beyond
 *     this the model's vision doesn't gain accuracy and the cost goes up)
 *   - is recompressed to JPEG quality 85, or kept as PNG when the input was
 *     a screenshot-style PNG with text (we don't want to mosquito-noise text)
 *   - has EXIF stripped (privacy — phone photos leak location)
 *   - is virtually always < 1 MB in practice
 *
 * Used by:
 *   - chat route (attachments → Anthropic content blocks)
 *   - document-analysis.ts (classifier)
 *   - divergence.ts (AI pass)
 *
 * Falls back gracefully — if sharp fails for any reason, we return the
 * original buffer and let the caller decide.
 */

import sharp from 'sharp';

/** Anthropic's recommended max edge length. Going larger wastes tokens. */
const MAX_EDGE_PX = 1568;

/** Quality factor for JPEG output. 85 is the standard for "indistinguishable from original". */
const JPEG_QUALITY = 85;

/** Above this size we MUST shrink; below it we still pass through sharp for safety/EXIF strip. */
const SOFT_TARGET_BYTES = 4.5 * 1024 * 1024;       // a bit under Anthropic's 5 MB hard cap

/** Anthropic-supported image MIMEs. */
export type AnthropicImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export interface PreprocessResult {
  buffer: Buffer;
  mimeType: AnthropicImageMime;
  sizeBytes: number;
  width: number;
  height: number;
  /** True if we changed the buffer; false if we passed it through unchanged. */
  reencoded: boolean;
  /** Diagnostic — what the original looked like. */
  original: { sizeBytes: number; mimeType: string };
}

/**
 * Preprocess an image buffer for sending to the model's vision API.
 *
 * @param buffer  raw image bytes from upload
 * @param mime    upload-declared mime (e.g. "image/jpeg" from a phone photo)
 * @returns       a buffer + mime safe to send as a base64 content block
 *
 * NEVER throws — falls back to original buffer on any sharp error.
 */
export async function preprocessImageForAnthropic(
  buffer: Buffer,
  mime: string,
): Promise<PreprocessResult> {
  const originalSize = buffer.length;
  const originalMime = mime;

  // Fast-path: small, already-supported PNG/JPEG. We still rotate + strip
  // EXIF, but skip the heavy resize step.
  const isAlreadyTiny = originalSize < 512 * 1024;
  const isHeicOrUnusual = /heic|heif|tiff|bmp|avif/i.test(mime);

  try {
    let pipeline = sharp(buffer, { failOn: 'none' }).rotate(); // rotate() respects EXIF

    const meta = await pipeline.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    const needsResize = w > MAX_EDGE_PX || h > MAX_EDGE_PX;
    const needsRecompress = isHeicOrUnusual || originalSize > SOFT_TARGET_BYTES;

    if (!needsResize && !needsRecompress && isAlreadyTiny && (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp' || mime === 'image/gif')) {
      // Cheap pass-through still through sharp (rotate + EXIF strip) but keep format
      const out = await pipeline.withMetadata({ orientation: 1 }).toBuffer();
      return {
        buffer: out,
        mimeType: mime as AnthropicImageMime,
        sizeBytes: out.length,
        width: w,
        height: h,
        reencoded: false,
        original: { sizeBytes: originalSize, mimeType: originalMime },
      };
    }

    if (needsResize) {
      pipeline = pipeline.resize({
        width:  w >= h ? MAX_EDGE_PX : undefined,
        height: h >  w ? MAX_EDGE_PX : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Choose output format:
    //   - HEIC/HEIF/TIFF/BMP/AVIF → re-encode as JPEG (smaller, universal)
    //   - PNG → keep PNG if image is < 2 MB after resize (preserves text crispness)
    //   - Otherwise → JPEG
    let outputMime: AnthropicImageMime;
    let out: Buffer;
    if (mime === 'image/png' && !isHeicOrUnusual) {
      // Try PNG first, fall back to JPEG if still too big
      const pngOut = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      if (pngOut.length <= SOFT_TARGET_BYTES) {
        out = pngOut;
        outputMime = 'image/png';
      } else {
        out = await sharp(buffer, { failOn: 'none' })
          .rotate()
          .resize({
            width:  w >= h ? MAX_EDGE_PX : undefined,
            height: h >  w ? MAX_EDGE_PX : undefined,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        outputMime = 'image/jpeg';
      }
    } else {
      out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      outputMime = 'image/jpeg';
    }

    const outMeta = await sharp(out).metadata();

    return {
      buffer: out,
      mimeType: outputMime,
      sizeBytes: out.length,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
      reencoded: true,
      original: { sizeBytes: originalSize, mimeType: originalMime },
    };
  } catch (err) {
    // Sharp failed — return the original buffer. Caller decides what to do
    // if it's over Anthropic's limit (typically: skip the image, keep text).
    // eslint-disable-next-line no-console
    console.warn('[image-preprocess] sharp failed, returning original:', err);
    // Map non-Anthropic mime to closest supported
    const fallbackMime: AnthropicImageMime =
      mime === 'image/jpg' ? 'image/jpeg' :
      (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime) ? mime : 'image/jpeg') as AnthropicImageMime;
    return {
      buffer,
      mimeType: fallbackMime,
      sizeBytes: originalSize,
      width: 0,
      height: 0,
      reencoded: false,
      original: { sizeBytes: originalSize, mimeType: originalMime },
    };
  }
}

/** Detect by mime + extension whether something is image-like. */
export function isImageMimeOrExt(mime: string, filename: string): boolean {
  if (mime.startsWith('image/')) return true;
  const ext = (filename.split('.').pop() ?? '').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'tiff', 'bmp', 'avif'].includes(ext);
}
