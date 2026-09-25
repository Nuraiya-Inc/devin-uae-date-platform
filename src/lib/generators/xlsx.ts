/**
 * XLSX generator + editor for agent file output.
 *
 * Two flows:
 *   - generateXlsx({sheets, ...})    → create fresh
 *   - editXlsx({sourceBuffer, ...})  → open an uploaded xlsx, apply changes, save as NEW
 *
 * Both return a Buffer that gets persisted as a Document.
 *
 * Schema choices:
 *   - Headers row is automatically bold + brand-coloured.
 *   - Cell values: prefix with "=" for formulas (e.g. "=SUM(B2:B10)"), else literal.
 *   - Optional totals_row at the bottom (also bold).
 *   - Column widths auto-fit from header + max cell length.
 */

import ExcelJS from 'exceljs';
import { BRAND, withArgb } from './brand';

const MAX_SHEETS = 10;
const MAX_ROWS_PER_SHEET = 200;
const MAX_COLS_PER_SHEET = 20;

export interface SheetSpec {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
  totals_row?: Array<string | number | null>;
  column_widths?: number[];
}

export interface GenerateXlsxInput {
  title: string;
  filename: string;
  sheets: SheetSpec[];
}

const BRAND_GREEN = withArgb(BRAND.green);
const LIME       = withArgb(BRAND.lime);

export async function generateXlsx(input: GenerateXlsxInput): Promise<Buffer> {
  if (input.sheets.length === 0) {
    throw new Error('At least one sheet is required.');
  }
  if (input.sheets.length > MAX_SHEETS) {
    throw new Error(`Max ${MAX_SHEETS} sheets per workbook.`);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Safa Platform · AI agent';
  wb.created = new Date();
  wb.title = input.title.slice(0, 200);

  for (const spec of input.sheets) {
    if (spec.rows.length > MAX_ROWS_PER_SHEET) {
      throw new Error(`Sheet "${spec.name}": max ${MAX_ROWS_PER_SHEET} rows.`);
    }
    if (spec.headers.length > MAX_COLS_PER_SHEET) {
      throw new Error(`Sheet "${spec.name}": max ${MAX_COLS_PER_SHEET} columns.`);
    }
    addSheet(wb, spec);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = await wb.xlsx.writeBuffer() as any;
  return Buffer.from(arr);
}

function addSheet(wb: ExcelJS.Workbook, spec: SheetSpec): void {
  const safeName = (spec.name || 'Sheet1').replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
  const ws = wb.addWorksheet(safeName);

  // Headers
  const headerRow = ws.addRow(spec.headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: LIME } } };
  });
  headerRow.height = 22;

  // Data rows
  for (const row of spec.rows) {
    const r = ws.addRow(row.map(coerce));
    r.eachCell((cell, colNumber) => {
      const raw = row[colNumber - 1];
      if (typeof raw === 'string' && raw.startsWith('=')) {
        cell.value = { formula: raw.slice(1) };
      }
      cell.alignment = { vertical: 'middle' };

      // ── G/A/R conditional formatting ──
      //
      // Auto-colors any cell whose value matches the common risk-status
      // tokens. Investor-grade registers (Phase 1 equipment, Open
      // Contracts, UAE Government Status, etc.) become visually scannable
      // — a reviewer's eye lands on red rows immediately.
      //
      // No schema change required — agents can keep using their natural
      // "G" / "A" / "R" or "Green" / "Amber" / "Red" / emoji tokens.
      if (typeof raw === 'string') {
        const tone = riskTone(raw);
        if (tone) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: tone.fill },
          };
          cell.font = { color: { argb: tone.fg }, bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });
  }

  // Totals row
  if (spec.totals_row && spec.totals_row.length > 0) {
    const t = ws.addRow(spec.totals_row.map(coerce));
    t.eachCell((cell, colNumber) => {
      const raw = spec.totals_row![colNumber - 1];
      if (typeof raw === 'string' && raw.startsWith('=')) {
        cell.value = { formula: raw.slice(1) };
      }
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin', color: { argb: BRAND_GREEN } } };
    });
  }

  // Column widths — explicit > auto
  if (spec.column_widths) {
    spec.column_widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = Math.max(8, Math.min(60, w));
    });
  } else {
    spec.headers.forEach((header, i) => {
      const headerLen = String(header).length;
      const dataMax = Math.max(
        ...spec.rows.map((r) => String(r[i] ?? '').length),
        ...(spec.totals_row ? [String(spec.totals_row[i] ?? '').length] : []),
      );
      ws.getColumn(i + 1).width = Math.max(10, Math.min(40, Math.max(headerLen, dataMax) + 3));
    });
  }

  // Freeze header
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter on the header row — every register becomes sortable /
  // filterable by reviewers. One line, big UX win.
  if (spec.headers.length > 0 && spec.rows.length > 0) {
    const lastCol = String.fromCharCode(64 + spec.headers.length); // A=65 → header.length=1 → "A"
    ws.autoFilter = {
      from: 'A1',
      to: `${lastCol}${spec.rows.length + 1}`,
    };
  }
}

function coerce(v: string | number | null | undefined): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  // Strings starting with "=" become formulas (handled after addRow); pass through as-is here.
  return String(v);
}

/**
 * Maps risk-tone tokens to their fill + foreground colors.
 *
 * Recognized tokens (case-insensitive, trimmed): "G", "A", "R",
 * "Green", "Amber", "Red", and the emoji 🟢 🟡 🔴.
 *
 * Returns null when the cell doesn't carry a risk-tone token — leaving
 * normal cell rendering untouched.
 *
 * Colors chosen to be Word/Sheets-renderer-portable + accessible.
 */
function riskTone(raw: string): { fill: string; fg: string } | null {
  const t = raw.trim().toLowerCase();
  if (t === 'g' || t === 'green' || t === '🟢') {
    return { fill: 'FFCFE6CB', fg: 'FF1E4620' }; // sage fill, deep green ink
  }
  if (t === 'a' || t === 'amber' || t === 'yellow' || t === '🟡') {
    return { fill: 'FFFCEFC1', fg: 'FF6B4F00' }; // warm amber fill, deep amber ink
  }
  if (t === 'r' || t === 'red' || t === '🔴') {
    return { fill: 'FFF6CFCB', fg: 'FF730E04' }; // soft red fill, deep red ink
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Editor — open existing xlsx, apply cell changes, save as new
// ─────────────────────────────────────────────────────────────

export interface CellChange {
  cell: string;            // e.g. "B3"
  value?: string | number; // literal value
  formula?: string;        // alternative — formula without leading "="
}

export interface SheetEdit {
  sheet: string;
  cell_changes: CellChange[];
}

export interface EditXlsxInput {
  sourceBuffer: Buffer;
  modifications: SheetEdit[];
  newTitle: string;
}

export async function editXlsx(input: EditXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(input.sourceBuffer as any);
  wb.title = input.newTitle.slice(0, 200);
  wb.modified = new Date();

  for (const mod of input.modifications) {
    const ws = wb.getWorksheet(mod.sheet);
    if (!ws) {
      throw new Error(`Sheet "${mod.sheet}" not found in source workbook. Available: ${wb.worksheets.map((s) => s.name).join(', ')}`);
    }
    for (const change of mod.cell_changes) {
      const cell = ws.getCell(change.cell);
      if (change.formula !== undefined) {
        cell.value = { formula: change.formula };
      } else if (change.value !== undefined) {
        cell.value = change.value;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = await wb.xlsx.writeBuffer() as any;
  return Buffer.from(arr);
}
