/**
 * DOCX generator. Built on `docx` library.
 *
 * Schema:
 *   {
 *     title: "Memo: Series A pre-money conditionality",
 *     filename: "series_a_premoney_memo",
 *     sections: [
 *       { heading: "Summary", paragraphs: ["..."] },
 *       { heading: "Comparison", table: { headers: [...], rows: [...] }, paragraphs: ["..."] },
 *     ],
 *     footer?: "Safa BioWorks FZE · Confidential"
 *   }
 *
 * Section ordering: heading → paragraphs → table (if present). Each section
 * is followed by a blank line.
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  Footer, PageNumber, ShadingType, BorderStyle, ImageRun,
  LevelFormat, convertInchesToTwip,
} from 'docx';
import { BRAND, DEFAULT_FOOTER, getLogoPng } from './brand';

const MAX_SECTIONS = 50;
const MAX_PARAGRAPHS_PER_SECTION = 50;
const MAX_TABLE_ROWS = 100;
const MAX_BULLETS_PER_LIST = 30;

/**
 * Rich docx section. Backwards compatible — `heading` + optional
 * `paragraphs` / `table` still works. Three new fields:
 *
 *   bullets / numberedBullets: render as proper docx lists, not
 *   bare paragraphs. Each string is one list item.
 *
 *   style: 'callout' renders the whole section as a brand-tinted
 *   callout box (for Executive Summary, Headline, Recommendation,
 *   etc.). Default rendering is unchanged.
 *
 *   quote: renders as an indented block-quote with a brand-lime
 *   left border. For source citations or pulled-quote moments.
 *
 * Paragraphs and bullets support inline **bold** via markdown-style
 * `**text**` syntax — agents can emphasize within prose without
 * needing a richer schema.
 */
export interface DocxSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  numberedBullets?: string[];
  quote?: string;
  table?: { headers: string[]; rows: string[][] };
  style?: 'default' | 'callout';
}

export interface GenerateDocxInput {
  title: string;
  filename: string;
  sections: DocxSection[];
  footer?: string;
}

const BRAND_GREEN = BRAND.green;
const LIME = BRAND.lime;

export async function generateDocx(input: GenerateDocxInput): Promise<Buffer> {
  if (input.sections.length === 0) throw new Error('At least one section required.');
  if (input.sections.length > MAX_SECTIONS) throw new Error(`Max ${MAX_SECTIONS} sections.`);

  const children: (Paragraph | Table)[] = [];

  // Letterhead logo (if the asset is available). Scaled from 600×207 to a
  // tidy header size; degrades gracefully to no-logo if the file is missing.
  const logo = getLogoPng();
  if (logo) {
    children.push(new Paragraph({
      children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 150, height: 52 } })],
      spacing: { after: 160 },
    }));
  }

  // Doc title (large, brand-coloured)
  children.push(new Paragraph({
    children: [new TextRun({ text: input.title, bold: true, size: 36, color: BRAND_GREEN })],
    spacing: { after: 240 },
  }));

  // Date stamp
  children.push(new Paragraph({
    children: [new TextRun({ text: new Date().toISOString().slice(0, 10), color: '6B7470', size: 18 })],
    spacing: { after: 360 },
  }));

  for (const s of input.sections) {
    if (s.paragraphs && s.paragraphs.length > MAX_PARAGRAPHS_PER_SECTION) {
      throw new Error(`Section "${s.heading}": max ${MAX_PARAGRAPHS_PER_SECTION} paragraphs.`);
    }
    if (s.bullets && s.bullets.length > MAX_BULLETS_PER_LIST) {
      throw new Error(`Section "${s.heading}": max ${MAX_BULLETS_PER_LIST} bullets.`);
    }
    if (s.numberedBullets && s.numberedBullets.length > MAX_BULLETS_PER_LIST) {
      throw new Error(`Section "${s.heading}": max ${MAX_BULLETS_PER_LIST} numbered bullets.`);
    }

    const isCallout = s.style === 'callout';

    // Heading. Callout sections get a distinct brand-tinted backdrop on
    // the heading paragraph so they read as a stand-out block.
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      shading: isCallout
        ? { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF3EB' }
        : undefined,
      border: isCallout
        ? { left: { style: BorderStyle.SINGLE, size: 24, color: BRAND_GREEN, space: 8 } }
        : undefined,
      children: [
        new TextRun({
          text: s.heading,
          bold: true,
          color: BRAND_GREEN,
          size: isCallout ? 24 : 26,
        }),
      ],
      spacing: { before: 360, after: 180 },
    }));

    // Paragraphs (with inline bold support via **text**)
    for (const p of s.paragraphs ?? []) {
      children.push(new Paragraph({
        shading: isCallout
          ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F8F2' }
          : undefined,
        border: isCallout
          ? { left: { style: BorderStyle.SINGLE, size: 24, color: BRAND_GREEN, space: 8 } }
          : undefined,
        children: renderInline(p, { size: 22 }),
        spacing: { after: 120 },
      }));
    }

    // Bulleted list
    if (s.bullets && s.bullets.length > 0) {
      for (const b of s.bullets) {
        children.push(new Paragraph({
          children: renderInline(b, { size: 22 }),
          bullet: { level: 0 },
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.25) },
        }));
      }
      // Trailing spacer
      children.push(new Paragraph({ spacing: { after: 120 } }));
    }

    // Numbered list
    if (s.numberedBullets && s.numberedBullets.length > 0) {
      for (const b of s.numberedBullets) {
        children.push(new Paragraph({
          children: renderInline(b, { size: 22 }),
          numbering: { reference: 'numbered-list', level: 0 },
          spacing: { after: 60 },
          indent: { left: convertInchesToTwip(0.25) },
        }));
      }
      children.push(new Paragraph({ spacing: { after: 120 } }));
    }

    // Block quote (for source citations, pulled quotes)
    if (s.quote && s.quote.trim()) {
      children.push(new Paragraph({
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F5F8F2' },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: LIME, space: 8 } },
        children: [
          new TextRun({
            text: s.quote.trim(),
            italics: true,
            size: 22,
            color: BRAND.muted,
          }),
        ],
        spacing: { after: 180, before: 60 },
        indent: { left: convertInchesToTwip(0.3) },
      }));
    }

    // Table
    if (s.table && s.table.rows.length > 0) {
      if (s.table.rows.length > MAX_TABLE_ROWS) {
        throw new Error(`Section "${s.heading}": table max ${MAX_TABLE_ROWS} rows.`);
      }
      children.push(buildTable(s.table.headers, s.table.rows));
      children.push(new Paragraph({ spacing: { after: 240 } }));
    }
  }

  const doc = new Document({
    creator: 'Safa Platform · AI agent',
    title: input.title.slice(0, 200),
    // Numbered-list configuration. Required for `numbering: { reference }`
    // to render properly in Word; without it numbered lists fall back to
    // bare paragraphs with no auto-numbering.
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } },
              },
            },
          ],
        },
      ],
    },
    sections: [{
      properties: {},
      children,
      // Footer is always rendered — defaults to the confidentiality marker so
      // every investor-facing document is marked, even when the agent omits one.
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: (input.footer ?? DEFAULT_FOOTER) + '  ·  Page ', size: 16, color: BRAND.muted }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: BRAND.muted }),
              new TextRun({ text: ' of ', size: 16, color: BRAND.muted }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: BRAND.muted }),
            ],
          })],
        }),
      },
    }],
  });

  return Packer.toBuffer(doc);
}

/**
 * Default usable width inside an A4 page with 1-inch margins, expressed in
 * DXA (twentieths of a point). A4 = 11906 DXA wide; with 1440 DXA margins
 * on each side, the content area is 9026 DXA. Distributing this across
 * columns gives each cell a sensible default width — without explicit
 * cell widths, Word renderers fall back to MINIMUM cell sizes (often a
 * single character wide, which is what produced the character-per-line
 * table rendering bug).
 */
const USABLE_WIDTH_DXA = 9026;

function buildTable(headers: string[], rows: string[][]): Table {
  const colCount = Math.max(headers.length, 1);
  const colDxa = Math.floor(USABLE_WIDTH_DXA / colCount);
  const columnWidths = Array(colCount).fill(colDxa);
  const cellWidth = { size: colDxa, type: WidthType.DXA } as const;

  const headerCells = headers.map((h) =>
    new TableCell({
      width: cellWidth,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: BRAND_GREEN },
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })],
      })],
    }),
  );

  // Pad short rows to colCount so we don't accidentally create rows with
  // fewer cells than the header — this keeps Word's column alignment intact.
  const dataRows = rows.map((r) => {
    const padded = r.length === colCount
      ? r
      : [...r, ...Array(Math.max(0, colCount - r.length)).fill('')].slice(0, colCount);
    return new TableRow({
      children: padded.map((cell) =>
        new TableCell({
          width: cellWidth,
          children: [new Paragraph({
            children: [new TextRun({ text: String(cell ?? ''), size: 20 })],
          })],
        }),
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: LIME },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LIME },
      left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E8E2' },
      insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
  });
}

/**
 * Markdown-light inline renderer. Parses **bold** segments inside a text
 * string and emits the equivalent run sequence. Anything not wrapped in
 * **double-asterisks** renders as plain text.
 *
 * Agents have been writing things like "**ENTRY 1 — Series A** etc..."
 * in their content already; previously this rendered as literal asterisks.
 * Now it actually bolds the wrapped span.
 *
 * Trade-offs: deliberately tiny parser. Doesn't handle italics, links,
 * code, nested formatting, or escapes. Keeps the schema simple; agents
 * who need richer formatting use bullets / quote / callout sections.
 */
function renderInline(
  text: string,
  opts: { size?: number } = {},
): TextRun[] {
  const size = opts.size ?? 22;
  const runs: TextRun[] = [];
  // Match **bold spans**. Greedy across the string but lazy inside.
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, m.index), size }));
    }
    runs.push(new TextRun({ text: m[1], bold: true, size }));
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size }));
  }
  return runs.length ? runs : [new TextRun({ text, size })];
}
