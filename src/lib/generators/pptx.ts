/**
 * PPTX generator. Builds a clean Safa-branded deck with cover + content slides.
 *
 * Schema:
 *   {
 *     title: "Series A — Vickers update",
 *     filename: "vickers_update.pptx",
 *     slides: [
 *       { layout: "cover", title: "Series A update", subtitle: "Safa BioWorks · May 2026" },
 *       { layout: "bullets", title: "Status", bullets: ["...", "..."] },
 *       { layout: "body", title: "The ask", body: "..." },
 *       { layout: "table", title: "Pipeline", table: { headers: [...], rows: [...] } },
 *     ]
 *   }
 *
 * Slide width default: 13.333 (widescreen). All slides include the brand
 * green left accent bar + Safa identity in the corner.
 */

import pptxgen from 'pptxgenjs';
import { BRAND, getLightLogoDataUrl } from './brand';

const MAX_SLIDES = 30;
const BRAND_GREEN = BRAND.green;
const MID_GREEN = BRAND.midGreen;
const LIME = BRAND.lime;
const CREAM = BRAND.cream;
const INK = BRAND.ink;
const MUTED = BRAND.muted;

export type SlideLayout = 'cover' | 'bullets' | 'body' | 'table';

export interface SlideSpec {
  layout: SlideLayout;
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  speaker_notes?: string;
}

export interface GeneratePptxInput {
  title: string;
  filename: string;
  slides: SlideSpec[];
}

export async function generatePptx(input: GeneratePptxInput): Promise<Buffer> {
  if (input.slides.length === 0) throw new Error('At least one slide required.');
  if (input.slides.length > MAX_SLIDES) throw new Error(`Max ${MAX_SLIDES} slides.`);

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = input.title.slice(0, 200);
  pres.author = 'Safa Platform · AI agent';
  pres.company = 'Safa BioWorks';

  for (const s of input.slides) {
    const slide = pres.addSlide();
    addBrandAccent(slide);

    if (s.layout === 'cover') {
      addCover(slide, s);
    } else if (s.layout === 'bullets') {
      addBullets(slide, s);
    } else if (s.layout === 'body') {
      addBody(slide, s);
    } else if (s.layout === 'table') {
      addTable(slide, s);
    }

    if (s.speaker_notes) {
      slide.addNotes(s.speaker_notes);
    }
  }

  // pptxgenjs returns a base64 / blob / arraybuffer depending on call.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = (await pres.write({ outputType: 'nodebuffer' })) as any;
  return Buffer.isBuffer(arr) ? arr : Buffer.from(arr);
}

function addBrandAccent(slide: pptxgen.Slide): void {
  // Thin lime accent bar on the left edge
  slide.addShape('rect', { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: LIME }, line: { color: LIME } });
  // Subtle Safa identity in the bottom-right
  slide.addText('Safa BioWorks', {
    x: 11.5, y: 7.05, w: 1.7, h: 0.3, fontSize: 9, color: MUTED,
    align: 'right', fontFace: 'Helvetica',
  });
}

function addCover(slide: pptxgen.Slide, s: SlideSpec): void {
  slide.background = { color: BRAND_GREEN };
  // Light logo top-left (shows on the green background). Degrades gracefully
  // if the asset is missing.
  const lightLogo = getLightLogoDataUrl();
  if (lightLogo) {
    // 2.4in wide keeps the 600×207 ratio → ~0.83in tall.
    slide.addImage({ data: lightLogo, x: 0.8, y: 0.7, w: 2.4, h: 0.83 });
  }
  // Remove brand accent for cover (whole slide is brand)
  slide.addText(s.title ?? '', {
    x: 0.8, y: 2.8, w: 11.5, h: 1.6,
    fontSize: 44, bold: true, color: 'FFFFFF', fontFace: 'Helvetica',
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: 0.8, y: 4.6, w: 11.5, h: 0.6,
      fontSize: 18, color: LIME, fontFace: 'Helvetica',
    });
  }
}

function addBullets(slide: pptxgen.Slide, s: SlideSpec): void {
  if (s.title) {
    slide.addText(s.title, {
      x: 0.5, y: 0.5, w: 12, h: 0.8,
      fontSize: 28, bold: true, color: BRAND_GREEN, fontFace: 'Helvetica',
    });
  }
  const bullets = (s.bullets ?? []).slice(0, 12);
  slide.addText(
    bullets.map((b) => ({ text: b, options: { bullet: { code: '25CF' } } })),
    {
      x: 0.7, y: 1.6, w: 12, h: 5.5,
      fontSize: 18, color: INK, fontFace: 'Helvetica', paraSpaceAfter: 12, lineSpacingMultiple: 1.2,
    },
  );
}

function addBody(slide: pptxgen.Slide, s: SlideSpec): void {
  if (s.title) {
    slide.addText(s.title, {
      x: 0.5, y: 0.5, w: 12, h: 0.8,
      fontSize: 28, bold: true, color: BRAND_GREEN, fontFace: 'Helvetica',
    });
  }
  if (s.body) {
    slide.addText(s.body, {
      x: 0.7, y: 1.6, w: 12, h: 5.5,
      fontSize: 18, color: INK, fontFace: 'Helvetica', lineSpacingMultiple: 1.3, valign: 'top',
    });
  }
}

function addTable(slide: pptxgen.Slide, s: SlideSpec): void {
  if (s.title) {
    slide.addText(s.title, {
      x: 0.5, y: 0.5, w: 12, h: 0.7,
      fontSize: 24, bold: true, color: BRAND_GREEN, fontFace: 'Helvetica',
    });
  }
  if (s.table && s.table.rows.length > 0) {
    const headerRow = s.table.headers.map((h) => ({
      text: h,
      options: { bold: true, color: 'FFFFFF', fill: { color: BRAND_GREEN }, fontSize: 12 },
    }));
    const dataRows = s.table.rows.map((r, idx) =>
      r.map((c) => ({
        text: String(c ?? ''),
        options: { color: INK, fill: { color: idx % 2 === 0 ? 'FFFFFF' : CREAM }, fontSize: 11 },
      })),
    );
    slide.addTable([headerRow, ...dataRows], {
      x: 0.5, y: 1.4, w: 12.3, h: 5.5,
      fontFace: 'Helvetica',
      border: { type: 'solid', pt: 0.5, color: 'E5E8E2' },
    });
  }
}
