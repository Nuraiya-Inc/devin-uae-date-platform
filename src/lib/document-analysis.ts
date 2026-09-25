/**
 * AI document classification.
 *
 * Called fire-and-forget after upload. Pulls the file from disk, extracts
 * (or sends native for PDFs/images), calls the model with a `classify_document`
 * tool to return structured output, and applies it to the Document row.
 *
 * Safa-specific hard rules embedded in the system prompt:
 *  - Strain / pretreatment / downstream chemistry → IP_CRITICAL + TECHNOLOGY
 *  - Investor terms / cap table → INVESTOR_RESTRICTED + FINANCE
 *  - Partner commercials (Emirates Biotech / Agthia / Almarai / QEERI) → COMMERCIAL_SENSITIVE + COMMERCIAL
 *  - Chemplax-related → entity=CHEMPLAX (separation wall)
 *  - Anything publishable → PUBLIC
 */

import { prisma } from './db';
import { getAnthropicClient, callAnthropicWithFallback } from './anthropic';
import { readStoredFile } from './storage';
import { extractContent } from './document-extract';
import { preprocessImageForAnthropic } from './image-preprocess';
import { buildCachedPrefix } from './safa-constants';
import { buildCurrentDateBlock, buildCurrentThemeBlock } from '@/facts';
import type Anthropic from '@anthropic-ai/sdk';

// ─────────────────────────────────────────────────────────────
// Classifier tool definition
// ─────────────────────────────────────────────────────────────

const CLASSIFY_DOCUMENT_TOOL = {
  name: 'classify_document',
  description: 'Return your structured classification for this document. Always call this — never reply in plain text.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Clear, concise title (max 80 chars). Strip cruft like "_FINAL_FINAL_v3". e.g. "Q4 2026 Board Pack" not "boardpack_v3.pdf".',
      },
      kind: {
        type: 'string',
        enum: [
          'PITCH_DECK', 'BUSINESS_PLAN', 'FINANCIAL_MODEL', 'INVESTOR_UPDATE',
          'TERM_SHEET', 'CONTRACT', 'LOI', 'NDA',
          'REGULATORY_DOSSIER', 'SCIENTIFIC_MEMO', 'SOP', 'HSE_REPORT',
          'BOARD_PACK', 'LEGAL_OPINION', 'POLICY', 'GENERAL',
        ],
        description: 'Pick exactly one.',
      },
      ipSensitivity: {
        type: 'string',
        enum: ['PUBLIC', 'INTERNAL', 'COMMERCIAL_SENSITIVE', 'IP_CRITICAL', 'INVESTOR_RESTRICTED'],
        description: 'Default to INTERNAL when unclear. See the hard rules in the system prompt.',
      },
      entity: {
        type: 'string',
        enum: ['FZE', 'INC', 'GROUP', 'CHEMPLAX'],
        description: 'Default FZE. Only set to CHEMPLAX if the doc is explicitly about Chemplax LLC — that triggers the separation wall.',
      },
      allowedBranches: {
        type: 'array',
        items: { type: 'string', enum: ['EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS'] },
        description: 'Branches whose agents should be granted EXPLICIT access (additive on top of the sensitivity ladder). Default behaviour by sensitivity is already correct — only add branches here if they need access beyond the default. e.g. an HSE report should set OPERATIONS in addition to its TECHNOLOGY default.',
      },
      projectSlug: {
        type: 'string',
        description: 'OPTIONAL — the slug of the Project this document belongs to. Look at the AVAILABLE PROJECTS section in the user content. Choose the best-fit slug (e.g. "safa-buildout"). If no project clearly fits, leave blank / omit.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '3-7 lowercase tags. e.g. ["series-a", "emirates-biotech", "strain-evaluation", "q4-2026"].',
      },
      summary: {
        type: 'string',
        description: 'One-sentence summary, max 200 chars. WHAT this doc is and WHO would care about it. Not a content rehash.',
      },
    },
    required: ['title', 'kind', 'ipSensitivity', 'entity', 'allowedBranches', 'tags', 'summary'],
  },
};

const CLASSIFIER_SYSTEM_PROMPT = `You are the document classifier for the UAE Palm Network platform.

Your job: receive a document and call the \`classify_document\` tool with precise structured output. Never reply in plain text — always use the tool.

# Document kinds — pick exactly one
- **PITCH_DECK**: investor presentation deck (slides for raising)
- **BUSINESS_PLAN**: long-form business plan / one-pager
- **FINANCIAL_MODEL**: Excel model with projections (P&L, CAPEX, cash, etc.)
- **INVESTOR_UPDATE**: periodic update letter to investors
- **TERM_SHEET**: investment term sheet — auto INVESTOR_RESTRICTED
- **CONTRACT**: signed or in-negotiation commercial / vendor contract
- **LOI**: letter of intent (often precedes a contract)
- **NDA**: non-disclosure agreement
- **REGULATORY_DOSSIER**: REACH, FDA, MOIAT, ADCAB submissions
- **SCIENTIFIC_MEMO**: strain selection, pretreatment, downstream chemistry — auto IP_CRITICAL
- **SOP**: standard operating procedure
- **HSE_REPORT**: incident report, audit, HSE training record
- **BOARD_PACK**: board materials (agenda, minutes, resolutions, packs)
- **LEGAL_OPINION**: counsel memo / legal opinion
- **POLICY**: internal policy document
- **GENERAL**: anything that doesn't fit

# IP sensitivity — pick exactly one
- **PUBLIC**: marketing materials, press releases, anything publishable. No restriction.
- **INTERNAL** (default for unclear): standard internal docs, ops, comms, contracts in negotiation.
- **COMMERCIAL_SENSITIVE**: partner negotiations, pricing data, commercial trade secrets, Emirates Biotech / Agthia / Almarai / QEERI specifics.
- **IP_CRITICAL**: strain identity, fermentation conditions, pretreatment chemistry, downstream chemistry. The moat. Default for SCIENTIFIC_MEMO.
- **INVESTOR_RESTRICTED**: term sheets, cap table, investor DD packs, valuation specifics. Default for TERM_SHEET.

# Hard rules (non-negotiable)
1. Document mentions strain selection, fermentation strain, pretreatment process, lignocellulose chemistry, downstream chemistry → **IP_CRITICAL** + add **TECHNOLOGY** to allowedBranches.
2. Document mentions Series A specifics ($14M raise, staged stack, cap table, valuation, use of funds), term sheets, investor DD answers → **INVESTOR_RESTRICTED** + **FINANCE**.
3. Document mentions Emirates Biotech / Agthia / Almarai / QEERI in commercial context (volumes, prices, contract terms) → **COMMERCIAL_SENSITIVE** + **COMMERCIAL**.
4. Document is a press release / website copy / LinkedIn post / public marketing → **PUBLIC**.
5. Document is about Chemplax LLC (Tennessee biopolymer facility) → **entity=CHEMPLAX** (separation wall).
6. HSE-related document → set allowedBranches to include both **TECHNOLOGY** AND **OPERATIONS** (HSE lives on the line between).

# Branches
- **EXECUTIVE**: CEO + MD + C-suite (always have access regardless)
- **FINANCE**: CFO, FIN-* (fundraising, FP&A, IR, grants, ops, risk, tax)
- **TECHNOLOGY**: CTO, TECH-* (science, HSE, regulatory, IT/IP, KM)
- **COMMERCIAL**: CCO, COMM-* (BD, sales, partnerships, customer tech service, market intel)
- **MARKETING**: CMO, MKT-* (PR, brand, content, ESG comms)
- **OPERATIONS**: COO, OPS-* (procurement, HR, legal, Dubai PRO, governance, facilities)

# Title rules
- Max 80 chars.
- Strip dates and version markers unless meaningful.
- Strip "FINAL", "FINAL_FINAL", "v3", etc.
- Capitalise like a headline.
- Be specific: "Emirates Biotech LOI draft v0.1" not "loi.docx".

# Tags
- 3-7 lowercase tags, hyphenated.
- Useful for search. Examples: \`series-a\`, \`emirates-biotech\`, \`strain-evaluation\`, \`hazop\`, \`q4-2026\`, \`reach\`, \`board-october\`.

# Summary
- One sentence, max 200 chars.
- WHAT this doc is + WHO would care.
- Not a content rehash.

The current date is provided in the user turn. Treat the content with discretion — sensitive material classifications stick downstream as ACLs.`;

// ─────────────────────────────────────────────────────────────
// Main entry point — fire-and-forget from the upload route
// ─────────────────────────────────────────────────────────────

export async function analyzeDocument(documentId: string): Promise<void> {
  // Mark pending so the UI can show a spinner
  await prisma.document.update({
    where: { id: documentId },
    data: { aiAnalysisPending: true },
  });

  try {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || !doc.storagePath) {
      await failGracefully(documentId, 'document or storagePath missing');
      return;
    }

    const buffer = await readStoredFile(doc.storagePath);
    const extracted = await extractContent(buffer, doc.mimeType ?? 'application/octet-stream', doc.title);

    // Pull available projects so the classifier can suggest one
    const projects = await prisma.project.findMany({
      select: { slug: true, name: true, description: true },
      orderBy: { createdAt: 'asc' },
    });
    const projectsBlock = projects.length === 0
      ? '(no projects defined yet)'
      : projects.map((p) =>
          `  - slug: "${p.slug}" — ${p.name}${p.description ? ` (${p.description.slice(0, 120)})` : ''}`,
        ).join('\n');

    // Build the user content block for the model
    let userContent: Anthropic.MessageParam['content'];

    const filenameHint = `Filename uploaded: ${doc.title}\nMIME type: ${doc.mimeType ?? 'unknown'}\nSize: ${doc.sizeBytes ?? 0} bytes`;
    const userNotes = doc.notes ? `\n\nUploader's note: ${doc.notes}` : '';
    const projectsHint = `\n\nAVAILABLE PROJECTS (pick projectSlug if the document clearly belongs to one):\n${projectsBlock}`;
    const header = `Classify this document. Call the \`classify_document\` tool with structured output.\n\n${filenameHint}${userNotes}${projectsHint}`;

    if (extracted.kind === 'native_pdf') {
      userContent = [
        { type: 'text', text: header },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } } as any,
      ];
    } else if (extracted.kind === 'native_image') {
      // Auto-rotate + downscale to ≤1568px + recompress. Lets the classifier
      // handle phone photos at any input size without Anthropic 5 MB rejections.
      const processed = await preprocessImageForAnthropic(buffer, extracted.mimeType);
      userContent = [
        { type: 'text', text: header },
        { type: 'image', source: { type: 'base64', media_type: processed.mimeType, data: processed.buffer.toString('base64') } },
      ];
    } else if (extracted.kind === 'text') {
      const trimmed = extracted.text.slice(0, 80_000);
      userContent = [
        { type: 'text', text: `${header}\n\n# Document content\n\n${trimmed}` },
      ];
    } else {
      // meta_only — AI works from filename only
      userContent = [
        { type: 'text', text: `${header}\n\n(No content extraction available — ${extracted.reason}. Classify from filename + MIME + uploader note alone.)` },
      ];
    }

    // Call the model with the classify tool, forcing tool use
    const themeBlock = await buildCurrentThemeBlock();
    const result = await callAnthropicWithFallback(
      async (model: string) =>
        getAnthropicClient().messages.create({
          model,
          max_tokens: 1024,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          system: [
            { type: 'text', text: buildCachedPrefix(), cache_control: { type: 'ephemeral' } },
            { type: 'text', text: buildCurrentDateBlock() },
            ...(themeBlock ? [{ type: 'text', text: themeBlock }] : []),
            { type: 'text', text: CLASSIFIER_SYSTEM_PROMPT },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
          tools: [CLASSIFY_DOCUMENT_TOOL],
          tool_choice: { type: 'tool', name: 'classify_document' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: [{ role: 'user', content: userContent as any }],
        }),
      'claude-sonnet-4-6',
    );

    const toolUse = result.result.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'classify_document',
    );

    if (!toolUse) {
      await failGracefully(documentId, 'classifier returned no tool_use block');
      return;
    }

    const cls = toolUse.input as {
      title: string;
      kind: string;
      ipSensitivity: string;
      entity: string;
      allowedBranches: string[];
      projectSlug?: string;
      tags: string[];
      summary: string;
    };

    // Save extracted text only for searchable types (not native PDF/image)
    const extractedText = extracted.kind === 'text' ? extracted.text : null;

    // Resolve project slug → id (only if the doc isn't already pinned to a project)
    let projectIdToSet: string | null | undefined = undefined;  // undefined = don't touch
    if (cls.projectSlug && cls.projectSlug.length > 0 && !doc.projectId) {
      const matchedProject = await prisma.project.findUnique({
        where: { slug: cls.projectSlug },
        select: { id: true },
      });
      if (matchedProject) projectIdToSet = matchedProject.id;
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        aiAnalysisPending: false,
        aiAnalyzedAt: new Date(),
        aiTitleSuggestion: cls.title.slice(0, 200),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aiKindSuggestion: cls.kind as any,
        aiSummary: cls.summary.slice(0, 400),
        extractedText,
        tags: cls.tags.slice(0, 10).map((t) => t.toLowerCase().slice(0, 30)),
        // Auto-apply the AI's classification — title, kind, sensitivity, entity, branches
        title: cls.title.slice(0, 200),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind: cls.kind as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ipSensitivity: cls.ipSensitivity as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entity: cls.entity as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        allowedBranches: cls.allowedBranches as any[],
        // Only set projectId when AI matched one AND the doc wasn't already pinned
        ...(projectIdToSet !== undefined ? { projectId: projectIdToSet } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'document.classified',
        entityType: 'Document',
        entityId: documentId,
        summary: `AI classified: ${cls.kind} / ${cls.ipSensitivity} / branches=[${cls.allowedBranches.join(',') || '—'}]${cls.projectSlug ? ` / project=${cls.projectSlug}` : ''}`,
        metadata: {
          kind: cls.kind,
          ipSensitivity: cls.ipSensitivity,
          entity: cls.entity,
          allowedBranches: cls.allowedBranches,
          projectSlug: cls.projectSlug ?? null,
          tags: cls.tags,
          model: result.modelUsed,
          tokensIn: result.result.usage.input_tokens,
          tokensOut: result.result.usage.output_tokens,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    await failGracefully(documentId, msg);
  }
}

async function failGracefully(documentId: string, reason: string): Promise<void> {
  await prisma.document
    .update({
      where: { id: documentId },
      data: {
        aiAnalysisPending: false,
        aiSummary: `[Analysis failed] ${reason.slice(0, 200)}`,
      },
    })
    .catch(() => undefined);

  await prisma.auditLog
    .create({
      data: {
        action: 'document.classify_failed',
        entityType: 'Document',
        entityId: documentId,
        summary: `AI classification failed: ${reason.slice(0, 200)}`,
      },
    })
    .catch(() => undefined);
}

/**
 * Periodic safety net for docs that got stuck in aiAnalysisPending state
 * (e.g. container restart mid-analysis). Marks them as not-pending so the
 * UI can re-prompt the user to retry or accept defaults. Called from the
 * documents page load (cheap self-heal pattern from the reference arch).
 */
export async function clearStuckPending(thresholdMinutes: number = 5): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const result = await prisma.document.updateMany({
    where: { aiAnalysisPending: true, createdAt: { lt: cutoff } },
    data: {
      aiAnalysisPending: false,
      aiSummary: '[Analysis abandoned] container restart mid-flight; click to retry',
    },
  });
  return result.count;
}
