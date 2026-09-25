/**
 * Document text extraction.
 *
 * Strategy by mime type:
 *   - PDF        → sent NATIVE to the model via document content block (no extraction)
 *   - DOCX       → mammoth → plain text
 *   - XLSX/XLSM  → exceljs → markdown tables (one per sheet)
 *   - CSV/TSV    → read utf-8 (already tabular)
 *   - text/*     → read utf-8
 *   - JSON       → read utf-8
 *   - images     → sent NATIVE to the model via image content block (no extraction)
 *   - other      → no extraction, AI works from filename + metadata only
 *
 * For files we don't extract here, the analysis module sends the raw buffer
 * (PDF/image) or falls back to filename-only classification.
 */

import mammoth from 'mammoth';
import ExcelJS from 'exceljs';

// Soft caps to keep extracted text reasonable for the model
const MAX_TEXT_CHARS = 80_000;        // ~20k tokens
const MAX_CELLS_PER_SHEET = 5_000;    // huge sheets get truncated
const MAX_SHEETS = 20;

export const NATIVE_PDF_MIME = 'application/pdf';
export const NATIVE_IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
]);

export const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // some uploaders send octet-stream for docx; we also match by extension later
]);

export const XLSX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

export const TEXTUAL_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values',
  'application/json', 'application/xml', 'text/xml', 'text/html',
]);

/** Result discriminator for the analyzer. */
export type ExtractedContent =
  | { kind: 'native_pdf'; buffer: Buffer; mimeType: string }
  | { kind: 'native_image'; buffer: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' }
  | { kind: 'text'; text: string }
  | { kind: 'meta_only'; reason: string };

export async function extractContent(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractedContent> {
  const ext = (filename.split('.').pop() ?? '').toLowerCase();

  // 1. PDF — send native
  if (mimeType === NATIVE_PDF_MIME || ext === 'pdf') {
    return { kind: 'native_pdf', buffer, mimeType: NATIVE_PDF_MIME };
  }

  // 2. Images — send native (mapped to supported the model vision types)
  if (NATIVE_IMAGE_MIMES.has(mimeType)) {
    const mapped =
      mimeType === 'image/jpg' ? 'image/jpeg' : (mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp');
    return { kind: 'native_image', buffer, mimeType: mapped };
  }

  // 3. DOCX — mammoth
  if (DOCX_MIMES.has(mimeType) || ext === 'docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = truncate(result.value);
      return { kind: 'text', text };
    } catch (err) {
      return { kind: 'meta_only', reason: `docx extraction failed: ${(err as Error).message}` };
    }
  }

  // 4. XLSX — exceljs → markdown tables
  if (XLSX_MIMES.has(mimeType) || ext === 'xlsx' || ext === 'xlsm') {
    try {
      const wb = new ExcelJS.Workbook();
      // Cast: ExcelJS's older Buffer type vs Node 22's Buffer<ArrayBufferLike>.
      // Runtime accepts a Node Buffer fine — type mismatch is purely a TS-strict issue.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buffer as any);

      const sheets: string[] = [];
      let sheetCount = 0;
      wb.eachSheet((ws) => {
        if (sheetCount >= MAX_SHEETS) return;
        sheetCount++;
        sheets.push(`## Sheet: ${ws.name}\n${sheetToMarkdown(ws)}`);
      });

      const text = truncate(sheets.join('\n\n'));
      return { kind: 'text', text };
    } catch (err) {
      return { kind: 'meta_only', reason: `xlsx extraction failed: ${(err as Error).message}` };
    }
  }

  // 5. Textual — read utf-8
  if (TEXTUAL_MIMES.has(mimeType) || ['txt', 'md', 'csv', 'tsv', 'json', 'xml', 'html'].includes(ext)) {
    try {
      const text = truncate(buffer.toString('utf-8'));
      return { kind: 'text', text };
    } catch {
      return { kind: 'meta_only', reason: 'binary content where text was expected' };
    }
  }

  // 6. Fall back — AI works from filename + size + mime
  return { kind: 'meta_only', reason: `no extractor for ${mimeType || ext}` };
}

function truncate(s: string): string {
  if (s.length <= MAX_TEXT_CHARS) return s;
  return s.slice(0, MAX_TEXT_CHARS) + `\n\n[... truncated at ${MAX_TEXT_CHARS} chars]`;
}

function sheetToMarkdown(ws: ExcelJS.Worksheet): string {
  const rows: string[][] = [];
  let cellCount = 0;
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (cellCount >= MAX_CELLS_PER_SHEET) return;
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cellCount++;
      const v = cell.value;
      if (v == null) cells.push('');
      else if (typeof v === 'object' && 'result' in v) cells.push(String((v as { result?: unknown }).result ?? ''));
      else if (typeof v === 'object' && 'richText' in v) {
        const rt = v as { richText: Array<{ text: string }> };
        cells.push(rt.richText.map((r) => r.text).join(''));
      }
      else if (v instanceof Date) cells.push(v.toISOString().slice(0, 10));
      else cells.push(String(v));
    });
    rows.push(cells);
  });

  if (rows.length === 0) return '(empty sheet)';

  // Render as pipe-delimited markdown
  const width = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => {
    const out = [...r];
    while (out.length < width) out.push('');
    return out;
  });

  const lines = [
    padded[0].map((c) => c || ' ').join(' | '),
    Array(width).fill('---').join(' | '),
    ...padded.slice(1).map((r) => r.map((c) => c.replace(/\|/g, '\\|') || ' ').join(' | ')),
  ];
  return lines.join('\n');
}
