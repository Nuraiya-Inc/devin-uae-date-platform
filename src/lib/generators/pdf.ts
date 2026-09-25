/**
 * PDF generator using PDFKit. Same input schema as docx, rendered as a
 * tidy A4 document with the Safa brand header.
 */

import PDFDocument from 'pdfkit';
import { BRAND, DEFAULT_FOOTER, withHash, getLogoPng } from './brand';

const BRAND_GREEN = withHash(BRAND.green);
const LIME = withHash(BRAND.lime);
const INK = withHash(BRAND.ink);
const MUTED = withHash(BRAND.muted);

const MAX_SECTIONS = 50;
const MAX_PARAGRAPHS_PER_SECTION = 50;

export interface PdfSection {
  heading: string;
  paragraphs?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export interface GeneratePdfInput {
  title: string;
  filename: string;
  sections: PdfSection[];
  footer?: string;
}

export function generatePdf(input: GeneratePdfInput): Promise<Buffer> {
  if (input.sections.length === 0) throw new Error('At least one section required.');
  if (input.sections.length > MAX_SECTIONS) throw new Error(`Max ${MAX_SECTIONS} sections.`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 64, right: 64 },
      info: {
        Title: input.title.slice(0, 200),
        Author: 'Safa Platform · AI agent',
        Creator: 'UAE Palm Network',
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Letterhead logo (if available) — drawn at the top-left, content flows below.
    const logo = getLogoPng();
    if (logo) {
      const logoW = 130; // scales height ~45px from the 600×207 source
      doc.image(logo, doc.page.margins.left, doc.y, { width: logoW });
      doc.y += 56; // advance past the logo so the title doesn't overlap
    }

    // Title
    doc.fillColor(BRAND_GREEN).fontSize(22).font('Helvetica-Bold').text(input.title, { paragraphGap: 6 });
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(new Date().toISOString().slice(0, 10), { paragraphGap: 12 });

    // Lime accent rule
    doc.moveTo(64, doc.y).lineTo(531, doc.y).strokeColor(LIME).lineWidth(2).stroke();
    doc.moveDown(0.8);

    for (const s of input.sections) {
      if (s.paragraphs && s.paragraphs.length > MAX_PARAGRAPHS_PER_SECTION) {
        return reject(new Error(`Section "${s.heading}": max ${MAX_PARAGRAPHS_PER_SECTION} paragraphs.`));
      }

      // Avoid orphaned headings near page bottom
      if (doc.y > doc.page.height - 160) doc.addPage();

      // Heading
      doc.fillColor(BRAND_GREEN).fontSize(14).font('Helvetica-Bold').text(s.heading, { paragraphGap: 8 });

      // Paragraphs
      doc.fillColor(INK).fontSize(11).font('Helvetica');
      for (const p of s.paragraphs ?? []) {
        doc.text(p, { paragraphGap: 6, align: 'left' });
      }

      // Table
      if (s.table && s.table.rows.length > 0) {
        renderTable(doc, s.table.headers, s.table.rows);
      }

      doc.moveDown(0.6);
    }

    // Footer — always rendered; defaults to the confidentiality marker so
    // every investor-facing PDF is marked even when the agent omits one.
    {
      const footerText = input.footer ?? DEFAULT_FOOTER;
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = doc.page.height - 50;
        doc.fillColor(MUTED).fontSize(8).font('Helvetica')
          .text(`${footerText}  ·  Page ${i + 1} of ${range.count}`, 64, bottom, {
            width: doc.page.width - 128, align: 'center', lineBreak: false,
          });
      }
    }

    doc.end();
  });
}

function renderTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
): void {
  const margin = 64;
  const tableLeft = margin;
  const tableWidth = doc.page.width - margin * 2;
  const colWidth = tableWidth / headers.length;
  const rowHeight = 22;

  // Pre-check: paginate before drawing
  const neededHeight = rowHeight * (rows.length + 1) + 20;
  if (doc.y + neededHeight > doc.page.height - 80) doc.addPage();

  let y = doc.y + 6;

  // Header
  doc.rect(tableLeft, y, tableWidth, rowHeight).fill(BRAND_GREEN);
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(String(h), tableLeft + i * colWidth + 8, y + 6, {
      width: colWidth - 16, height: rowHeight - 6, ellipsis: true, lineBreak: false,
    });
  });
  y += rowHeight;

  // Body
  doc.fillColor(INK).fontSize(10).font('Helvetica');
  for (let r = 0; r < rows.length; r++) {
    if (y + rowHeight > doc.page.height - 72) {
      doc.addPage();
      y = 72;
    }
    if (r % 2 === 1) {
      doc.rect(tableLeft, y, tableWidth, rowHeight).fill('#F7F4EC');
      doc.fillColor(INK).fontSize(10).font('Helvetica');
    }
    rows[r].forEach((cell, i) => {
      doc.text(String(cell ?? ''), tableLeft + i * colWidth + 8, y + 6, {
        width: colWidth - 16, height: rowHeight - 6, ellipsis: true, lineBreak: false,
      });
    });
    y += rowHeight;
  }

  // Bottom rule
  doc.moveTo(tableLeft, y).lineTo(tableLeft + tableWidth, y).strokeColor(LIME).lineWidth(1).stroke();
  doc.moveDown(0.6);
  doc.y = y + 8;
}
