/**
 * Shared brand constants + defaults for every generated deliverable.
 *
 * Single source of truth so docx / pdf / pptx / xlsx stay visually consistent.
 * Colours are stored as bare 6-digit hex (no leading '#'). Each generator
 * adapts the format it needs:
 *   - docx / pptx  → bare hex            (use BRAND.green directly)
 *   - pdf (pdfkit) → '#' prefix          (withHash)
 *   - xlsx (exceljs ARGB) → 'FF' prefix  (withArgb)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const BRAND = {
  green: '004923',
  midGreen: '006950',
  lime: 'E1E32A',
  cream: 'F7F4EC',
  ink: '111714',
  muted: '6B7470',
} as const;

export const COMPANY_NAME = 'UAE Palm Network';

/**
 * Default confidentiality footer applied to generated documents when the
 * caller doesn't supply one. Investor-facing deliverables should always be
 * marked confidential — so this is the floor, not an option.
 */
export const DEFAULT_FOOTER = `${COMPANY_NAME} · Confidential`;

/** '#'-prefixed hex for pdfkit. */
export function withHash(hex: string): string {
  return `#${hex}`;
}

/** 'FF'-prefixed ARGB for exceljs. */
export function withArgb(hex: string): string {
  return `FF${hex}`;
}

// ─────────────────────────────────────────────────────────────
// Letterhead logo — a pre-resized PNG (600×207, transparent) lives in
// public/. Read once and cached. Returns null if the asset is missing so
// generators degrade gracefully (never throw) rather than breaking output.
// ─────────────────────────────────────────────────────────────

/** Native pixel dimensions of the logo asset (for aspect-ratio scaling). */
export const LOGO_W = 600;
export const LOGO_H = 207;

let _logoCache: Buffer | null | undefined;

/** The letterhead logo PNG as a Buffer, or null if unavailable. Cached. */
export function getLogoPng(): Buffer | null {
  if (_logoCache !== undefined) return _logoCache;
  try {
    _logoCache = readFileSync(path.join(process.cwd(), 'public', 'upn-logo-color.png'));
  } catch {
    _logoCache = null;
  }
  return _logoCache;
}

/** Logo as a base64 data URL (for pptxgenjs addImage). Null if unavailable. */
export function getLogoDataUrl(): string | null {
  const buf = getLogoPng();
  return buf ? `data:image/png;base64,${buf.toString('base64')}` : null;
}

let _lightLogoCache: string | null | undefined;
/** White/light logo variant as a base64 data URL — for dark/brand backgrounds
 *  (e.g. the pptx cover). Null if unavailable. Cached. */
export function getLightLogoDataUrl(): string | null {
  if (_lightLogoCache !== undefined) return _lightLogoCache;
  try {
    const buf = readFileSync(path.join(process.cwd(), 'public', 'upn-logo-white.png'));
    _lightLogoCache = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    _lightLogoCache = null;
  }
  return _lightLogoCache;
}
