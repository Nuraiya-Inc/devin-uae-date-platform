/**
 * File generation tools — the layer that makes agents producers, not just advisors.
 *
 * Five tools:
 *   - generate_xlsx
 *   - generate_docx
 *   - generate_pdf
 *   - generate_pptx
 *   - edit_xlsx     (opens an uploaded xlsx, applies cell changes, saves as new)
 *
 * Each output:
 *   - Saves to /app/uploads/documents/<docId>/original.<ext>
 *   - Creates a Document row with:
 *       · entity = the user's entity
 *       · allowedBranches = [agent's branch]  (so peer agents in the same branch can also read)
 *       · ipSensitivity = sensible default by agent branch
 *       · tags = ['generated', ...]
 *   - Skips the AI classifier (the agent already knows what it made)
 *   - Returns text for the tool result + a structured `effect` so the chat
 *     route can attach the doc ids to the assistant message bubble.
 */

import { prisma } from './db';
import { persistUpload, readStoredFile } from './storage';
import { generateXlsx, editXlsx, type GenerateXlsxInput, type SheetEdit } from './generators/xlsx';
import { generateDocx, type GenerateDocxInput, type DocxSection } from './generators/docx';
import { generatePdf, type GeneratePdfInput } from './generators/pdf';
import { generatePptx, type GeneratePptxInput, type SlideSpec } from './generators/pptx';
import type { Agent, User, IpSensitivity, DocumentKind, AgentBranch, Prisma } from '@prisma/client';
import type { ToolDefinition } from './tool-catalog';

// ─────────────────────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────────────────────

export const GENERATE_XLSX_TOOL: ToolDefinition = {
  name: 'generate_xlsx',
  description: `Build a BRAND-NEW Excel spreadsheet from scratch. Use ONLY when there is no existing xlsx to start from — e.g. "build me a pipeline tracker", "give me a comparison table of these vendors", "draft an action list".

DO NOT use this tool if you are MODIFYING an existing xlsx. That includes:
  • a file the user attached in chat,
  • a doc id you found via list_documents,
  • the document linked to a data room entry,
  • a spreadsheet another agent shipped earlier and handed off to you.
For ALL of those, call \`edit_xlsx\` instead. \`generate_xlsx\` starts from a blank workbook and will destroy the user's headers, sheet names, column order, formulas, and formatting.

Each sheet has headers + rows. To use a formula in a cell, prefix the value with "=" (e.g. "=SUM(B2:B10)" or "=B3*0.44"). Optional totals_row goes at the bottom (also bold). Column widths auto-fit unless you set them explicitly.

Returns the new document id + a download URL. The file appears as an attachment chip on your reply and in /documents.

For large multi-sheet workbooks (5+ sheets, dense rows): consider building in TWO calls — first ~half the sheets, then the rest — to avoid hitting the per-round output cap. Tell the user you're staging the build.

Caps: 10 sheets, 200 rows per sheet, 20 columns per row.`,
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Document title (max 80 chars). Used as filename if no filename provided.' },
      filename: { type: 'string', description: 'Filename without extension (defaults to slugified title).' },
      sheets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:    { type: 'string', description: 'Sheet tab name. Max 31 chars.' },
            headers: { type: 'array', items: { type: 'string' } },
            rows:    {
              type: 'array',
              items: { type: 'array', items: { type: ['string', 'number', 'null'] } },
              description: 'Data rows. Strings starting with "=" become formulas.',
            },
            totals_row: {
              type: 'array', items: { type: ['string', 'number', 'null'] },
              description: 'Optional bold totals row at the bottom; use "=" prefix for formulas.',
            },
            column_widths: { type: 'array', items: { type: 'number' }, description: 'Optional explicit widths (8-60).' },
          },
          required: ['name', 'headers', 'rows'],
        },
      },
    },
    required: ['title', 'sheets'],
  },
};

export const EDIT_XLSX_TOOL: ToolDefinition = {
  name: 'edit_xlsx',
  description: `Open an EXISTING xlsx and apply targeted cell changes. Saves the result as a NEW document — the original is preserved.

**ALWAYS use this tool (not generate_xlsx) whenever you are MODIFYING an existing xlsx** — whether the user attached it in chat, you found the doc id via list_documents, it's linked to a data room entry, or another agent passed you the id. Preserve the existing structure EXACTLY — do NOT rename sheets, reorder columns, change headers, or add/remove rows unless the user explicitly asked for that change. Touch only the specific cells they asked about.

If you think the structure should change, say so in chat first: "I'd recommend reorganising X — want me to do that?" — then wait for confirmation before making structural changes.

Cell refs are A1-style (e.g. "B3", "AB12"). Use \`formula\` to write a formula (omit the leading "="); use \`value\` for a literal.

You must list the sheet name explicitly per change set — multi-sheet edits batch in one call.

If you don't know the existing cell layout (sheet names, header row, where the figure you want to change lives), CALL \`read_document\` on the source_document_id FIRST so your cell refs are accurate. Guessing cell positions and writing the wrong cells is worse than not editing at all.`,
  input_schema: {
    type: 'object',
    properties: {
      source_document_id: { type: 'string', description: 'Document id of the source xlsx (from list_documents or an earlier attachment).' },
      modifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sheet: { type: 'string' },
            cell_changes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cell:    { type: 'string', description: 'A1 ref e.g. "B3".' },
                  value:   { type: ['string', 'number'], description: 'Literal value. Use formula instead for formulas.' },
                  formula: { type: 'string', description: 'Formula WITHOUT the leading "=" (e.g. "B3*0.44").' },
                },
                required: ['cell'],
              },
            },
          },
          required: ['sheet', 'cell_changes'],
        },
      },
      new_title:    { type: 'string', description: 'Title for the new (modified) document.' },
      new_filename: { type: 'string', description: 'Filename without extension (optional).' },
    },
    required: ['source_document_id', 'modifications', 'new_title'],
  },
};

export const GENERATE_DOCX_TOOL: ToolDefinition = {
  name: 'generate_docx',
  description: `Build a Word document (memo, briefing, report) and deliver it to the user. Use for narrative documents — board memos, decision briefings, strategic briefs, partner status, investor-facing one-pagers, DD responses.

Each section has a heading + optional paragraphs + optional bullets / numberedBullets + optional table + optional quote. Sections render in order, footer (optional) shows on every page with page numbers.

**For investor-grade output:**
- Use \`bullets\` for unordered lists (each string is one item) — far cleaner than running bullets in paragraphs.
- Use \`numberedBullets\` for ordered lists / step sequences.
- Use \`style: "callout"\` for Executive Summary, Headline, Recommendation sections — renders as a brand-tinted box with green left rule, visually distinct.
- Use \`quote\` for inline source citations or pulled quotes — renders as an indented italic block with lime left rule.
- Use \`**bold spans**\` inside any paragraph or bullet text to emphasize specific names, numbers, or terms (markdown-style **double-asterisks**, parsed at render time).

Structure briefs as: callout section (Headline / Executive Summary) → bulleted sections (key findings) → numbered section (decisions / recommendations) → table (evidence) → quote (source citations).`,
  input_schema: {
    type: 'object',
    properties: {
      title:    { type: 'string', description: 'Document title (appears at the top, max 200 chars).' },
      filename: { type: 'string', description: 'Filename without extension.' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading:    { type: 'string' },
            paragraphs: { type: 'array', items: { type: 'string' }, description: 'Prose paragraphs. Supports inline **bold** via markdown-style double-asterisks.' },
            bullets:    { type: 'array', items: { type: 'string' }, description: 'Unordered list items. Each string renders as one bullet. Supports inline **bold**.' },
            numberedBullets: { type: 'array', items: { type: 'string' }, description: 'Ordered list items (1., 2., 3., ...). Each string renders as one numbered item. Supports inline **bold**.' },
            quote: { type: 'string', description: 'Block quote for source citations or pulled quotes. Renders italic, indented, with brand-lime left rule.' },
            style: { type: 'string', enum: ['default', 'callout'], description: '"callout" renders the section as a brand-tinted box with green left rule — use for Executive Summary, Headline, Recommendation. Defaults to "default".' },
            table: {
              type: 'object',
              properties: {
                headers: { type: 'array', items: { type: 'string' } },
                rows:    { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['headers', 'rows'],
            },
          },
          required: ['heading'],
        },
      },
      footer: { type: 'string', description: 'Optional footer line (rendered on every page next to page number).' },
    },
    required: ['title', 'sections'],
  },
};

export const GENERATE_PDF_TOOL: ToolDefinition = {
  name: 'generate_pdf',
  description: `Build a PDF and deliver it to the user. Currently supports a SUBSET of generate_docx's schema: heading + paragraphs + table. PDF does NOT render bullets / numberedBullets / quote / style ("callout") fields — those are docx-only.

**For investor-grade rich layouts, use \`generate_docx\` instead.** PDF is best for: simple read-only outputs, one-pagers without rich formatting, distribution copies of an already-finalized document.`,
  input_schema: {
    // Same structure as generate_docx
    type: 'object',
    properties: {
      title:    { type: 'string' },
      filename: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading:    { type: 'string' },
            paragraphs: { type: 'array', items: { type: 'string' } },
            table: {
              type: 'object',
              properties: {
                headers: { type: 'array', items: { type: 'string' } },
                rows:    { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['headers', 'rows'],
            },
          },
          required: ['heading'],
        },
      },
      footer: { type: 'string' },
    },
    required: ['title', 'sections'],
  },
};

export const GENERATE_PPTX_TOOL: ToolDefinition = {
  name: 'generate_pptx',
  description: `Build a PowerPoint deck and deliver it to the user. Use for pitch / status / IC presentation work.

Each slide has a layout: "cover" (title+subtitle on brand green), "bullets" (title + bullet list), "body" (title + free text), or "table" (title + table). Optional speaker_notes per slide.`,
  input_schema: {
    type: 'object',
    properties: {
      title:    { type: 'string' },
      filename: { type: 'string' },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['cover', 'bullets', 'body', 'table'] },
            title:    { type: 'string' },
            subtitle: { type: 'string' },
            body:     { type: 'string' },
            bullets:  { type: 'array', items: { type: 'string' } },
            table: {
              type: 'object',
              properties: {
                headers: { type: 'array', items: { type: 'string' } },
                rows:    { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['headers', 'rows'],
            },
            speaker_notes: { type: 'string' },
          },
          required: ['layout'],
        },
      },
    },
    required: ['title', 'slides'],
  },
};

export const EDIT_DOCX_TOOL: ToolDefinition = {
  name: 'edit_docx',
  description: `Revise an EXISTING agent-generated Word document by applying targeted section changes — then save as a NEW document. Use this instead of generate_docx when iterating on a doc you (or another agent) already generated, so you don't re-type the whole thing and risk drift.

How it works: the document's original structure is loaded, your changes are applied section-by-section, and it's regenerated on the same branded template. Only works on docs generated by the platform (not uploaded Word files — those have no editable structure; regenerate them with generate_docx).

- section_updates: for each, if a section with that exact heading exists it's REPLACED (paragraphs + table); if no match, it's APPENDED as a new section.
- remove_headings: sections to delete.
- new_footer: replace the footer line.`,
  input_schema: {
    type: 'object',
    properties: {
      source_document_id: { type: 'string', description: 'Document id of the agent-generated docx to revise.' },
      new_title: { type: 'string', description: 'Title for the revised document.' },
      new_filename: { type: 'string', description: 'Filename without extension (optional).' },
      section_updates: {
        type: 'array',
        description: 'Sections to replace (by matching heading) or append (if new). Same shape as generate_docx sections — supports bullets / numberedBullets / quote / style ("callout") in addition to paragraphs and table.',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            paragraphs: { type: 'array', items: { type: 'string' }, description: 'Prose paragraphs. Supports inline **bold** via markdown-style double-asterisks.' },
            bullets: { type: 'array', items: { type: 'string' }, description: 'Unordered list items.' },
            numberedBullets: { type: 'array', items: { type: 'string' }, description: 'Ordered list items.' },
            quote: { type: 'string', description: 'Block quote for source citation or pulled quote.' },
            style: { type: 'string', enum: ['default', 'callout'], description: '"callout" renders as brand-tinted box. Use for Executive Summary / Headline / Recommendation.' },
            table: {
              type: 'object',
              properties: {
                headers: { type: 'array', items: { type: 'string' } },
                rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['headers', 'rows'],
            },
          },
          required: ['heading'],
        },
      },
      remove_headings: { type: 'array', items: { type: 'string' }, description: 'Headings of sections to remove.' },
      new_footer: { type: 'string', description: 'Optional new footer line.' },
    },
    required: ['source_document_id', 'new_title'],
  },
};

export const EDIT_PPTX_TOOL: ToolDefinition = {
  name: 'edit_pptx',
  description: `Revise an EXISTING agent-generated PowerPoint deck by applying targeted slide changes — then save as a NEW document. Use this instead of generate_pptx when iterating on a deck you already generated.

How it works: the deck's original slides are loaded, your changes applied, and it's regenerated on the same branded template. Only works on decks generated by the platform (not uploaded .pptx).

- slide_updates: replace fields on the slide at the given 1-based index (merges — only the fields you pass change).
- add_slides: new slides appended to the end.
- remove_indices: 1-based slide numbers to remove.
Operations apply in this order: updates, then removes, then adds (so indices refer to the original deck).`,
  input_schema: {
    type: 'object',
    properties: {
      source_document_id: { type: 'string', description: 'Document id of the agent-generated pptx to revise.' },
      new_title: { type: 'string', description: 'Title for the revised deck.' },
      new_filename: { type: 'string', description: 'Filename without extension (optional).' },
      slide_updates: {
        type: 'array',
        description: 'Slides to modify, by 1-based index. Only the fields you pass are changed.',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number', description: '1-based slide number to modify.' },
            layout: { type: 'string', enum: ['cover', 'bullets', 'body', 'table'] },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            body: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
            table: {
              type: 'object',
              properties: {
                headers: { type: 'array', items: { type: 'string' } },
                rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['headers', 'rows'],
            },
            speaker_notes: { type: 'string' },
          },
          required: ['index'],
        },
      },
      add_slides: {
        type: 'array',
        description: 'New slides appended to the end.',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['cover', 'bullets', 'body', 'table'] },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            body: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
            table: {
              type: 'object',
              properties: {
                headers: { type: 'array', items: { type: 'string' } },
                rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
              },
              required: ['headers', 'rows'],
            },
            speaker_notes: { type: 'string' },
          },
          required: ['layout'],
        },
      },
      remove_indices: { type: 'array', items: { type: 'number' }, description: '1-based slide numbers to remove.' },
    },
    required: ['source_document_id', 'new_title'],
  },
};

export const ALL_GENERATION_TOOLS = [
  GENERATE_XLSX_TOOL,
  EDIT_XLSX_TOOL,
  GENERATE_DOCX_TOOL,
  EDIT_DOCX_TOOL,
  GENERATE_PDF_TOOL,
  GENERATE_PPTX_TOOL,
  EDIT_PPTX_TOOL,
];

// ─────────────────────────────────────────────────────────────
// Spec-edit helpers — apply targeted changes to a stored generation
// spec, returning a new spec to regenerate from.
// ─────────────────────────────────────────────────────────────

interface EditDocxInput {
  source_document_id: string;
  new_title: string;
  new_filename?: string;
  section_updates?: DocxSection[];
  remove_headings?: string[];
  new_footer?: string;
}

function applyDocxEdits(spec: GenerateDocxInput, input: EditDocxInput): GenerateDocxInput {
  const norm = (s: string) => s.trim().toLowerCase();
  let sections = [...(spec.sections ?? [])];

  // Remove requested headings first.
  if (input.remove_headings?.length) {
    const toRemove = new Set(input.remove_headings.map(norm));
    sections = sections.filter((s) => !toRemove.has(norm(s.heading)));
  }

  // Replace-or-append each update.
  for (const upd of input.section_updates ?? []) {
    const idx = sections.findIndex((s) => norm(s.heading) === norm(upd.heading));
    if (idx >= 0) sections[idx] = upd;
    else sections.push(upd);
  }

  return {
    title: input.new_title,
    filename: input.new_filename || spec.filename || input.new_title,
    sections,
    footer: input.new_footer ?? spec.footer,
  };
}

interface EditPptxInput {
  source_document_id: string;
  new_title: string;
  new_filename?: string;
  slide_updates?: Array<Partial<SlideSpec> & { index: number }>;
  add_slides?: SlideSpec[];
  remove_indices?: number[];
}

function applyPptxEdits(spec: GeneratePptxInput, input: EditPptxInput): GeneratePptxInput {
  const remove = new Set((input.remove_indices ?? []).map((n) => n - 1)); // to 0-based
  const updatesByIdx = new Map<number, Partial<SlideSpec>>();
  for (const u of input.slide_updates ?? []) {
    const { index, ...fields } = u;
    updatesByIdx.set(index - 1, fields); // 0-based
  }

  const slides: SlideSpec[] = [];
  (spec.slides ?? []).forEach((slide, i) => {
    if (remove.has(i)) return; // drop removed slides
    const upd = updatesByIdx.get(i);
    slides.push(upd ? { ...slide, ...upd } : slide);
  });

  // Append new slides.
  for (const s of input.add_slides ?? []) slides.push(s);

  return {
    title: input.new_title,
    filename: input.new_filename || spec.filename || input.new_title,
    slides,
  };
}

// ─────────────────────────────────────────────────────────────
// Dispatcher — single executor that handles all 5
// ─────────────────────────────────────────────────────────────

export type GenerationKind = 'xlsx' | 'edit_xlsx' | 'docx' | 'edit_docx' | 'pdf' | 'pptx' | 'edit_pptx';

function sensibleSensitivity(branch: AgentBranch): IpSensitivity {
  switch (branch) {
    case 'FINANCE':    return 'INVESTOR_RESTRICTED';
    case 'TECHNOLOGY': return 'IP_CRITICAL';
    case 'COMMERCIAL': return 'COMMERCIAL_SENSITIVE';
    case 'MARKETING':
    case 'OPERATIONS':
    case 'EXECUTIVE':
    default:
      return 'INTERNAL';
  }
}

function kindForGeneration(g: GenerationKind): DocumentKind {
  switch (g) {
    case 'xlsx':
    case 'edit_xlsx': return 'FINANCIAL_MODEL';
    case 'docx':
    case 'edit_docx':
    case 'pdf':       return 'GENERAL';
    case 'pptx':
    case 'edit_pptx': return 'PITCH_DECK';
  }
}

function slugifyFilename(s: string, ext: string): string {
  const base = s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'document';
  return `${base}.${ext}`;
}

interface ExecuteGenerationCtx {
  agent: Agent;
  /**
   * The user whose chat triggered this generation. Null when called from
   * an autonomous agent run — in that case we fall back to the CEO user
   * (Document.uploaderId is required; the CEO is the closest "system" user).
   */
  user: User | null;
}

interface ExecuteGenerationResult {
  text: string;
  isError?: boolean;
  effects?: {
    generated?: Array<{ id: string; title: string; mimeType: string; kind: string }>;
  };
  /** Document id of the new file (so the chat route can attach to the assistant message). */
  documentId?: string;
}

const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf:  'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export async function executeGenerateFile(
  kind: GenerationKind,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  ctx: ExecuteGenerationCtx,
): Promise<ExecuteGenerationResult> {
  try {
    let buffer: Buffer;
    let title: string;
    let ext: 'xlsx' | 'docx' | 'pdf' | 'pptx';
    let mimeType: string;
    // For docx/pptx (and their edits), capture the spec to store on the
    // Document so edit_docx / edit_pptx can revise it later without drift.
    let specToStore: GenerateDocxInput | GeneratePptxInput | null = null;

    if (kind === 'xlsx') {
      const i = input as GenerateXlsxInput;
      buffer = await generateXlsx(i);
      title = i.title;
      ext = 'xlsx';
      mimeType = MIME.xlsx;
    } else if (kind === 'edit_xlsx') {
      const i = input as {
        source_document_id: string;
        modifications: SheetEdit[];
        new_title: string;
        new_filename?: string;
      };
      const source = await prisma.document.findUnique({ where: { id: i.source_document_id } });
      if (!source || !source.storagePath) {
        return { text: `Error: source document ${i.source_document_id} not found or has no stored file.`, isError: true };
      }
      const sourceBuffer = await readStoredFile(source.storagePath);
      buffer = await editXlsx({ sourceBuffer, modifications: i.modifications, newTitle: i.new_title });
      title = i.new_title;
      ext = 'xlsx';
      mimeType = MIME.xlsx;
    } else if (kind === 'docx') {
      const i = input as GenerateDocxInput;
      buffer = await generateDocx(i);
      title = i.title;
      ext = 'docx';
      mimeType = MIME.docx;
      specToStore = i;
    } else if (kind === 'edit_docx') {
      const i = input as EditDocxInput;
      const source = await prisma.document.findUnique({
        where: { id: i.source_document_id },
        select: { generationSpec: true, mimeType: true },
      });
      if (!source) return { text: `Error: source document ${i.source_document_id} not found.`, isError: true };
      if (!source.generationSpec || source.mimeType !== MIME.docx) {
        return { text: `Error: document ${i.source_document_id} has no editable docx spec (it may be an upload or was generated before editing was supported). Use generate_docx to create an editable version.`, isError: true };
      }
      const newSpec = applyDocxEdits(source.generationSpec as unknown as GenerateDocxInput, i);
      buffer = await generateDocx(newSpec);
      title = i.new_title;
      ext = 'docx';
      mimeType = MIME.docx;
      specToStore = newSpec;
    } else if (kind === 'pdf') {
      const i = input as GeneratePdfInput;
      buffer = await generatePdf(i);
      title = i.title;
      ext = 'pdf';
      mimeType = MIME.pdf;
    } else if (kind === 'pptx') {
      const i = input as GeneratePptxInput;
      buffer = await generatePptx(i);
      title = i.title;
      ext = 'pptx';
      mimeType = MIME.pptx;
      specToStore = i;
    } else if (kind === 'edit_pptx') {
      const i = input as EditPptxInput;
      const source = await prisma.document.findUnique({
        where: { id: i.source_document_id },
        select: { generationSpec: true, mimeType: true },
      });
      if (!source) return { text: `Error: source document ${i.source_document_id} not found.`, isError: true };
      if (!source.generationSpec || source.mimeType !== MIME.pptx) {
        return { text: `Error: document ${i.source_document_id} has no editable pptx spec (it may be an upload or was generated before editing was supported). Use generate_pptx to create an editable version.`, isError: true };
      }
      const newSpec = applyPptxEdits(source.generationSpec as unknown as GeneratePptxInput, i);
      buffer = await generatePptx(newSpec);
      title = i.new_title;
      ext = 'pptx';
      mimeType = MIME.pptx;
      specToStore = newSpec;
    } else {
      return { text: `Error: unknown generation kind "${kind}".`, isError: true };
    }

    // Persist as a Document row
    // Resolve uploader: use the chat user when present (chat context), or fall
    // back to the CEO user for autonomous runs (no user in the loop).
    let uploaderId: string;
    let uploaderEntity = 'GROUP' as const;
    if (ctx.user) {
      uploaderId = ctx.user.id;
      uploaderEntity = ctx.user.entity as typeof uploaderEntity;
    } else {
      const ceo = await prisma.user.findFirst({
        where: { role: 'CEO' },
        select: { id: true, entity: true },
      });
      if (!ceo) {
        return { text: 'Generation failed: no CEO user found to attribute the document to (autonomous run fallback path).', isError: true };
      }
      uploaderId = ceo.id;
      uploaderEntity = ceo.entity as typeof uploaderEntity;
    }

    const doc = await prisma.document.create({
      data: {
        title: title.slice(0, 200),
        kind: kindForGeneration(kind),
        ipSensitivity: sensibleSensitivity(ctx.agent.branch),
        entity: uploaderEntity,
        allowedBranches: [ctx.agent.branch],
        tags: ['generated', ctx.agent.slug, ext],
        notes: ctx.user ? `Generated by ${ctx.agent.slug} during chat` : `Generated by ${ctx.agent.slug} during autonomous run`,
        uploaderId,
        // Store the structured spec for docx/pptx so edit_docx / edit_pptx
        // can revise it later. Null for xlsx/pdf/edits-of-xlsx.
        generationSpec: specToStore ? (specToStore as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    // Write the file to /app/uploads
    const fakeFile = new File([new Uint8Array(buffer)], slugifyFilename(title, ext), { type: mimeType });
    const persisted = await persistUpload(doc.id, fakeFile);
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
        agentId: ctx.agent.id,
        userId: ctx.user?.id ?? uploaderId,
        action: `document.generate.${kind}`,
        entityType: 'Document',
        entityId: updated.id,
        summary: `${ctx.agent.slug} generated ${ext}: "${title}"${ctx.user ? '' : ' (autonomous run)'}`,
        metadata: { kind, sizeBytes: updated.sizeBytes, mimeType: updated.mimeType },
      },
    });

    return {
      text: `Generated ${ext.toUpperCase()}: "${title}" (id=${updated.id}, ${persisted.sizeBytes} bytes). The user can open it from the attachment chip below your reply, or from /documents/${updated.id}.`,
      effects: {
        generated: [{ id: updated.id, title, mimeType, kind }],
      },
      documentId: updated.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { text: `Generation failed: ${msg}`, isError: true };
  }
}
