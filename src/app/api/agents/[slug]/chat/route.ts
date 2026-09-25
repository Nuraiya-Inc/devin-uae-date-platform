/**
 * Chat route — POST /api/agents/[slug]/chat
 *
 * The runtime that makes agents actually work. Flow per turn:
 *
 *   1. Auth + access check (CEO/MD or branch-allowed user).
 *   2. Load agent + thread + last N messages.
 *   3. Persist the user's message FIRST (survives 502s).
 *   4. Build the system prompt:
 *        - Cached prefix: SAFA hard rules + agent's static system prompt
 *        - Dynamic suffix: cross-thread awareness + per-turn context
 *      → cache_control:'ephemeral' on the prefix block for Anthropic prompt caching.
 *   5. Bounded tool-use loop (MAX_TOOL_ROUNDS = 10, MAX_CONSULTATIONS = 3):
 *        - Call Anthropic with the conversation + tools
 *        - If stop_reason='tool_use', execute the tool(s), append results, recurse
 *        - Otherwise stop, persist the assistant message + audit
 *   6. Return the final assistant message text + transparency data.
 *
 * Closed gaps vs reference architecture: Anthropic 5xx retry + Opus→Sonnet
 * fallback via callAnthropicWithFallback (lib/anthropic.ts). Per-message
 * audit log with token counts (incl. cache hits). Strict consult_agent
 * recursion depth.
 *
 * Phase 2 will add: streaming SSE, approval-queue gating for sensitive
 * actions, brainstorm mode, document attachments, web tools, generation
 * tools, WhatsApp inbound.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAnthropicClient, callAnthropicWithFallback } from '@/lib/anthropic';
import { canChatWithAgent } from '@/lib/access';
import { buildCachedPrefix } from '@/lib/safa-constants';
import { buildCurrentDateBlock, buildCurrentThemeBlock } from '@/facts';
import { buildCrossThreadContext } from '@/lib/agent-context';
import {
  ALL_TOOLS,
  CONSULT_AGENT_TOOL,
  toolsForAgent,
  executeGetPartnerProfile,
  executeUpdatePartnerProfile,
  executeListPartners,
  executeListPartnerReports,
  executeStartOrGetReport,
  executeResolveQuantity,
  executeRecordProduction,
  executeRecordWaste,
  executeSubmitReport,
  executeGetReportDetail,
  executeSetValidationResult,
  executeApproveReport,
  executeRequestTierChange,
  executeGetRegionalBenchmark,
  executeGetFacts,
  executeQuerySectorMetrics,
  executeListDocuments,
  executeReadDocument,
  executeCreateTask,
  executeUpdateTaskStatus,
  executeListTasks,
  executeCreateCollectionTicket,
  executeSubmitApplication,
  executeLogSuggestion,
  executeBulkRegisterPartners,
  type ToolExecuteContext,
  type ToolResult,
} from '@/lib/tool-catalog';
import {
  ALL_GENERATION_TOOLS,
  executeGenerateFile,
  type GenerationKind,
} from '@/lib/generation-tools';
import { persistUpload, readStoredFile, StorageError } from '@/lib/storage';
import { extractContent } from '@/lib/document-extract';
import { preprocessImageForAnthropic } from '@/lib/image-preprocess';
import { analyzeDocument } from '@/lib/document-analysis';
import type { AgentBranch } from '@prisma/client';
import type Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 270; // 4.5 min — for chained consult_agent calls

// Per-turn cap on Anthropic round-trips inside the tool-use loop.
// One round can fire multiple parallel tool_use blocks, so 10 rounds
// is meaningfully more than 10 tool calls in practice. Bumped from 6
// after agents kept running out mid-task (e.g. generate_xlsx + a
// couple of list_documents + promote_to_dataroom = ~5 rounds before
// you even hit the "all done" turn).
const MAX_TOOL_ROUNDS = 10;
const MAX_CONSULTATIONS_PER_TURN = 3;
const MAX_CONSULT_DEPTH = 2;
const HISTORY_MESSAGE_CAP = 40;

/**
 * Per-round output cap. Both Opus & Sonnet support 8192 tokens of output
 * by default. The earlier 4096 cap caused agents like Marcus to truncate
 * mid-generation when producing complex multi-sheet xlsx tool calls (the
 * JSON for an 8-sheet workbook with 50+ rows can easily exceed 4k tokens
 * just for the tool input). 8192 gives meaningful headroom while still
 * surfacing a truncation footer if the agent tries to write a novel.
 */
// Bumped from 8192 → 16384 to take advantage of Fable 5's headroom on
// long-form artifacts (sovereign IC pack, full strategic briefs, multi-sheet
// xlsx tool inputs). Fable 5 supports up to 32K output; 16K is the sweet
// spot for our typical chat turns without bleeding cost on routine asks.
const MAX_OUTPUT_TOKENS_PER_ROUND = 16384;

const bodySchema = z.object({
  threadId: z.string().optional(),
  message: z.string().min(1).max(8000),
  /**
   * Two-step upload path: client uploads files via /api/chat/upload-attachment
   * first (streaming, no multipart pressure), then sends the chat message as a
   * tiny JSON body referencing the resulting Document.ids. The chat route
   * loads each doc from storage and feeds it into the same attachment pipeline
   * as if it had been uploaded inline.
   */
  attachedDocIds: z.array(z.string()).max(8).optional(),
});

// Per-turn caps. 8 attachments handles multi-page photo uploads (e.g. 4-page
// scanned contract = 4 phone photos, or 2-page bank statement). The total-size
// cap matches lib/storage.ts (50 MB per file × 8). The image preprocessor
// downscales each image before sending to Anthropic, so we can be generous
// here at the upload boundary.
const MAX_ATTACHMENTS_PER_TURN = 8;
const MAX_TOTAL_ATTACHMENT_BYTES = 80 * 1024 * 1024;

// ────────────────────────────────────────────────────────────────
// Type aliases for Anthropic message blocks
// ────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface MessageParam {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

// ────────────────────────────────────────────────────────────────
// Per-attachment tool-routing hints (task #24)
// ────────────────────────────────────────────────────────────────

/** True for the OOXML spreadsheet mime + the legacy .xls + an honest
 *  filename hint (some clients upload xlsx with octet-stream mime). */
function isXlsxMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    m === 'application/vnd.ms-excel' ||
    m === 'application/x-vnd.ms-excel'
  );
}

function isDocxMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m === 'application/msword'
  );
}

function isPptxMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    m === 'application/vnd.ms-powerpoint'
  );
}

/**
 * Returns the one-line "right tool to reach for" hint for an attachment,
 * or null if no specific guidance applies. The hint is inserted into the
 * attachment summary text so it sits right next to the doc id the model
 * needs to pass into the tool.
 *
 * Spreadsheets are the headline case (#24): edit_xlsx accepts uploads,
 * so the agent has a real choice and historically picks wrong. DOCX/PPTX
 * include a note about the no-edit-uploads constraint so the agent
 * doesn't waste a tool round attempting edit_docx/edit_pptx on an upload.
 */
function attachmentToolHint(mime: string, filenameOrTitle: string): string | null {
  const name = filenameOrTitle.toLowerCase();

  if (isXlsxMime(mime) || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return 'SPREADSHEET — to modify, call edit_xlsx({source_document_id: <id>, modifications: [...]}). NEVER regenerate via generate_xlsx unless the user explicitly asked to start fresh.';
  }
  if (isDocxMime(mime) || name.endsWith('.docx')) {
    return 'WORD DOC (uploaded) — edit_docx only works on agent-generated docs, so for an upload you must regenerate via generate_docx if modifications are needed. Use read_document first to pull the content.';
  }
  if (isPptxMime(mime) || name.endsWith('.pptx')) {
    return 'POWERPOINT (uploaded) — edit_pptx only works on agent-generated decks. For an upload, regenerate via generate_pptx if modifications are needed.';
  }
  return null;
}

// ────────────────────────────────────────────────────────────────
// POST /api/agents/[slug]/chat
// ────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;

  // ────────────────────────────────────────────────────────────────
  // Parse the body. Two acceptable shapes:
  //   - application/json     → { threadId?, message }
  //   - multipart/form-data  → fields: message, files (multiple)
  // ────────────────────────────────────────────────────────────────
  let messageText: string;
  let attachedFiles: File[] = [];
  /**
   * Pre-uploaded Document.ids from the two-step upload flow
   * (POST /api/chat/upload-attachment, then the chat message references the
   * returned docIds). This path bypasses formData() entirely so it isn't
   * subject to proxy/multipart size caps.
   */
  let preUploadedDocIds: string[] = [];
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Could not parse multipart body.' }, { status: 400 });
    }
    messageText = String(formData.get('message') ?? '').trim();
    const fileEntries = formData.getAll('files');
    for (const f of fileEntries) {
      if (f instanceof File && f.size > 0) attachedFiles.push(f);
    }
    if (attachedFiles.length > MAX_ATTACHMENTS_PER_TURN) {
      return NextResponse.json({ error: `Max ${MAX_ATTACHMENTS_PER_TURN} attachments per message.` }, { status: 400 });
    }
    const total = attachedFiles.reduce((acc, f) => acc + f.size, 0);
    if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: `Total attachment size exceeds 80 MB.` }, { status: 400 });
    }
  } else {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
    }
    messageText = parsed.data.message;
    preUploadedDocIds = parsed.data.attachedDocIds ?? [];
  }

  if (!messageText || messageText.length < 1) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }
  if (messageText.length > 8000) {
    messageText = messageText.slice(0, 8000);
  }

  const agent = await prisma.agent.findUnique({ where: { slug } });
  if (!agent || !agent.isActive) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Access check
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const allowed = await canChatWithAgent(
    { id: user.id, role: user.role, entity: user.entity, email: user.email, name: user.name },
    { id: agent.id, slug: agent.slug, tier: agent.tier, branch: agent.branch },
  );
  if (!allowed) return NextResponse.json({ error: 'Forbidden — not allowed to chat with this agent' }, { status: 403 });

  // Load or create thread (one per (user, agent) by schema unique constraint)
  let thread = await prisma.chatThread.findUnique({
    where: { userId_agentId: { userId: user.id, agentId: agent.id } },
  });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: { userId: user.id, agentId: agent.id, title: `Chat with ${agent.name}` },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // Persist attached files as Document rows. Each gets the agent's branch
  // added to allowedBranches so the agent can read it via list_documents
  // in future turns. Fire-and-forget the AI classifier for each.
  // ────────────────────────────────────────────────────────────────
  const attachedDocIds: string[] = [];
  const attachedDocBuffers: Array<{ docId: string; buffer: Buffer; mimeType: string; title: string }> = [];

  for (const file of attachedFiles) {
    try {
      // Create the Document row first to mint the id
      const doc = await prisma.document.create({
        data: {
          title: file.name || 'Chat attachment',
          kind: 'GENERAL',
          ipSensitivity: 'INTERNAL',
          entity: user.entity,
          allowedBranches: [agent.branch as AgentBranch],
          uploaderId: user.id,
          notes: `Attached in chat with ${agent.slug}`,
        },
      });
      const persisted = await persistUpload(doc.id, file);
      const updated = await prisma.document.update({
        where: { id: doc.id },
        data: {
          storagePath: persisted.storagePath,
          sizeBytes: persisted.sizeBytes,
          mimeType: persisted.mimeType,
        },
      });

      // Read the buffer back for inclusion in the current turn
      const buffer = await readStoredFile(persisted.storagePath);
      attachedDocIds.push(updated.id);
      attachedDocBuffers.push({
        docId: updated.id,
        buffer,
        mimeType: updated.mimeType ?? 'application/octet-stream',
        title: updated.title,
      });

      // Fire-and-forget classifier so the doc gets proper kind/sensitivity/tags
      analyzeDocument(updated.id).catch((err) => {
        console.error(`[chat] classifier failed for ${updated.id}:`, err);
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'document.upload',
          entityType: 'Document',
          entityId: updated.id,
          summary: `${user.name} attached "${updated.title}" in chat with ${agent.slug}`,
          metadata: { viaChat: true, agentSlug: agent.slug, sizeBytes: updated.sizeBytes, mimeType: updated.mimeType },
        },
      });
    } catch (err) {
      const msg = err instanceof StorageError ? err.message : err instanceof Error ? err.message : 'unknown';
      return NextResponse.json({ error: `Attachment failed: ${msg}` }, { status: 400 });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Load any PRE-UPLOADED documents (from the two-step streaming flow)
  // and feed them into the same attachedDocBuffers array. Caller already
  // owns these (created by /api/chat/upload-attachment with the user's id),
  // we re-validate ownership before loading.
  // ────────────────────────────────────────────────────────────────
  if (preUploadedDocIds.length > 0) {
    for (const docId of preUploadedDocIds) {
      try {
        const doc = await prisma.document.findUnique({ where: { id: docId } });
        if (!doc || !doc.storagePath) {
          return NextResponse.json({ error: `Attached doc ${docId} not found.` }, { status: 400 });
        }
        if (doc.uploaderId !== user.id) {
          // Could relax later (e.g. allow re-attaching docs the user can read),
          // but for now: the uploader is the only one who can reference it
          // in chat via the two-step path. Prevents id-guessing attacks.
          return NextResponse.json({ error: `Not authorised to attach doc ${docId}.` }, { status: 403 });
        }

        // Add the agent's branch to the doc's allowlist so it can be read
        // by list_documents / read_document in subsequent turns
        if (!doc.allowedBranches.includes(agent.branch as AgentBranch)) {
          await prisma.document.update({
            where: { id: doc.id },
            data: { allowedBranches: { push: agent.branch as AgentBranch } },
          });
        }

        const buffer = await readStoredFile(doc.storagePath);
        attachedDocIds.push(doc.id);
        attachedDocBuffers.push({
          docId: doc.id,
          buffer,
          mimeType: doc.mimeType ?? 'application/octet-stream',
          title: doc.title,
        });

        // Fire-and-forget classifier (if not already done)
        if (doc.aiAnalysisPending) {
          analyzeDocument(doc.id).catch((err) => {
            console.error(`[chat] classifier failed for ${doc.id}:`, err);
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        return NextResponse.json({ error: `Could not load attached doc ${docId}: ${msg}` }, { status: 500 });
      }
    }
  }

  // Persist user message BEFORE the Anthropic call — survives 502s
  const userMessage = await prisma.message.create({
    data: {
      threadId: thread.id,
      role: 'USER',
      content: messageText,
      userId: user.id,
      channel: 'web',
      attachmentDocIds: attachedDocIds,
    },
  });

  // Load conversation history (excluding the just-persisted user message)
  const history = await prisma.message.findMany({
    where: { threadId: thread.id, id: { not: userMessage.id } },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_MESSAGE_CAP,
  });
  history.reverse(); // chronological

  // Build message array for Anthropic
  const messages: MessageParam[] = history.map((m) => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
  }));

  // ────────────────────────────────────────────────────────────────
  // Build the current user turn — text + any attachments. PDFs and images
  // go as native content blocks; DOCX/XLSX/text get extracted and inlined.
  //
  // CRITICAL: every attached file is prefixed with a text marker that
  // includes its Document.id, so the agent can reference it in tools like
  // promote_to_dataroom(document_id=...) without guessing.
  // ────────────────────────────────────────────────────────────────
  const currentTurnBlocks: ContentBlock[] = [{ type: 'text', text: messageText }];
  const textualAttachmentBlobs: string[] = [];

  // If we have any attachments, also append a top-level summary mentioning each
  // doc id so the agent sees them clearly in the text block.
  //
  // For each attachment we ALSO emit a per-mime "right tool to reach for" hint.
  // Without these, agents have a strong tendency to regenerate uploaded
  // spreadsheets from scratch via generate_xlsx, blowing away formulas and
  // formatting. The hint makes the correct tool the obvious call.
  if (attachedDocBuffers.length > 0) {
    const summary = attachedDocBuffers.map((a) => {
      const hint = attachmentToolHint(a.mimeType, a.title);
      return `  - "${a.title}" (mime: ${a.mimeType}) → Document.id = ${a.docId}${hint ? `\n      → ${hint}` : ''}`;
    }).join('\n');

    const hasXlsx = attachedDocBuffers.some((a) => isXlsxMime(a.mimeType));
    const headerNote = hasXlsx
      ? `[Attached files in this turn — use these Document.ids in tool calls.\n` +
        ` HARD RULE for any .xlsx attachment: if the user is asking you to modify it, you MUST call edit_xlsx(source_document_id="<the id>", ...). Do NOT regenerate it via generate_xlsx — that destroys the user's formulas, formatting, and sheet structure. Only use generate_xlsx if the user explicitly asked you to start a NEW spreadsheet from scratch.`
      : `[Attached files in this turn — use these Document.ids in tool calls (e.g. read_document, promote_to_dataroom):`;

    (currentTurnBlocks[0] as { type: 'text'; text: string }).text =
      `${messageText}\n\n${headerNote}\n${summary}]`;
  }

  for (const a of attachedDocBuffers) {
    const extracted = await extractContent(a.buffer, a.mimeType, a.title);
    // Always include an inline marker right before the native/text content so
    // the model associates the document id with the actual content.
    const marker = `\n\n📎 Attachment: "${a.title}" · Document.id = ${a.docId} · mime: ${a.mimeType}`;

    if (extracted.kind === 'native_pdf') {
      currentTurnBlocks.push({ type: 'text', text: marker });
      currentTurnBlocks.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.buffer.toString('base64') } } as any,
      );
    } else if (extracted.kind === 'native_image') {
      // Preprocess: rotate per EXIF, downscale to ≤1568px, recompress, strip EXIF.
      // Anthropic has a hard 5 MB cap per image content block; phone photos
      // routinely blow past it. This step makes uploads "just work" at any
      // input size up to MAX_TOTAL_ATTACHMENT_BYTES.
      const processed = await preprocessImageForAnthropic(a.buffer, a.mimeType);
      currentTurnBlocks.push({
        type: 'text',
        text:
          marker +
          (processed.reencoded
            ? `\n   (image preprocessed: ${processed.original.sizeBytes} B → ${processed.sizeBytes} B, ${processed.width}×${processed.height})`
            : ''),
      });
      currentTurnBlocks.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: 'image', source: { type: 'base64', media_type: processed.mimeType, data: processed.buffer.toString('base64') } } as any,
      );
    } else if (extracted.kind === 'text') {
      textualAttachmentBlobs.push(
        `\n\n--- Attached file: "${a.title}" · Document.id = ${a.docId} · ${a.mimeType} ---\n${extracted.text}\n--- end of file ---`,
      );
    } else {
      textualAttachmentBlobs.push(
        `\n\n--- Attached file: "${a.title}" · Document.id = ${a.docId} · ${a.mimeType} · ${a.buffer.length} bytes — no text extraction available; metadata only ---`,
      );
    }
  }

  if (textualAttachmentBlobs.length > 0) {
    // Append extracted text to the first text block (after the summary line)
    (currentTurnBlocks[0] as { type: 'text'; text: string }).text += textualAttachmentBlobs.join('');
  }

  messages.push({
    role: 'user',
    content: attachedDocBuffers.length > 0 ? currentTurnBlocks : messageText,
  });

  // Build system prompt — cached prefix + dynamic suffix
  const cachedPrefix = `${buildCachedPrefix()}\n\n---\n\n# Your agent profile\n\n${agent.systemPrompt}`;
  const crossThread = await buildCrossThreadContext(agent);
  const now = new Date();
  const dynamicSuffix = [
    `# Per-turn context`,
    `Current date/time: ${now.toISOString()} (${now.toUTCString()})`,
    `Current user: ${user.name} <${user.email}> (role: ${user.role}, entity: ${user.entity})`,
    `Thread id: ${thread.id}`,
    `Mode: CHAT (interactive — a human is waiting on the other end).`,
    '',
    `# CHAT MODE DISCIPLINE (overrides default verbosity)`,
    `You are in chat, not a daily run. A human is reading your response in real time. Apply these rules:`,
    ``,
    `1. **Default brief.** Simple question → 1–3 sentences. A single number or yes/no answer is often the right response. Long responses are EARNED by the question's complexity, not by your discomfort with being terse.`,
    ``,
    `2. **Take a position when asked.** If the user asks "what should we do" / "what do you recommend" / "which option" — give ONE recommendation, then ONE strongest-counter line. Format: "Recommendation: X. Strongest counter: Y." Do not list options as if equally weighted. If your confidence is below ~70%, say so explicitly ("low confidence — would value your read on X") rather than fence-sitting.`,
    ``,
    `3. **Read-first before claiming facts.** If the user references a Data Room entry, a document, a RAID item, or any platform artifact — call \`read_document\` / \`list_dataroom\` / \`list_raid\` FIRST, then answer. Do not paraphrase from memory. The user can verify what you read.`,
    ``,
    `4. **Surface human blockers via the tool.** If the chat surfaces something only a specific human can resolve (and it ties to a data-room entry), call \`tag_human_dependency\` after answering. Don't just say "Nima needs to decide" in prose and leave it floating — make it a tracked item so it lands in /needs-you.`,
    ``,
    `5. **No corporate filler.** Skip "Great question.", "I'll help you with that.", "Let me know if you have any other questions." The user knows why they messaged you. Open with the answer.`,
    ``,
    `6. **Long form requires permission.** A 1000-word response is a violation unless the user asked for depth ("walk me through", "give me the long version", "I want detail on X"). Default to terse; expand when invited.`,
    ``,
    `7. **End with a hook only when there's a real next step.** "Want me to draft the email?" is good. "Hope that helps!" is filler — cut it.`,
    `# File-editing discipline (applies whenever a user attaches a file)`,
    `- If the user attached an EXISTING xlsx/docx and asked you to update it, you MUST use \`edit_xlsx\` (or the appropriate edit tool) — NOT \`generate_xlsx\`. Generating from scratch destroys their structure.`,
    `- Preserve their headers, sheet names, column order, and row structure EXACTLY. Only change cells they explicitly asked you to change.`,
    `- If you think the structure needs improvement, SAY so in chat ("I'd suggest reorganising X to Y — want me to do that?") — do NOT silently restructure.`,
    `- For multi-sheet outputs, prefer ONE \`generate_xlsx\` call only when building fresh. If the model is at risk of running out of output budget, build sheet-by-sheet across multiple calls and tell the user you're staging the build.`,
    '',
    crossThread || '_(no cross-thread context yet — this may be your first turn on the platform)_',
  ].join('\n');

  // Tool-use context
  const ctx: ToolExecuteContext = {
    agent,
    user,
    threadId: thread.id,
    consultationDepth: 0,
    // Provenance for resolve_quantity → QuantityResolution rows:
    // figure → the farmer's message → the media it arrived in.
    currentMessageId: userMessage.id,
    currentAttachmentDocIds: attachedDocIds,
  };

  // ────────────────────────────────────────────────────────────────
  // Tool-use loop
  // ────────────────────────────────────────────────────────────────

  let consultationsUsed = 0;
  const generatedDocIds: string[] = [];
  const transparency: {
    tools: Array<{ name: string; ok: boolean; summary: string }>;
    consultations: Array<{ slug: string; question: string }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effects: Record<string, any[]>;
    errors: string[];
  } = { tools: [], consultations: [], effects: {}, errors: [] };

  let finalText = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCachedIn = 0;
  let modelUsedFinal = agent.model;
  // Weekly theme block — fetched once per chat turn (helper is cached in-memory).
  const themeBlock = await buildCurrentThemeBlock();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Message;
    try {
      const result = await callAnthropicWithFallback(
        async (model: string) =>
          getAnthropicClient().messages.create({
            model,
            max_tokens: MAX_OUTPUT_TOKENS_PER_ROUND,
            temperature: agent.temperature,
            system: [
              { type: 'text', text: cachedPrefix, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: buildCurrentDateBlock() },
              ...(themeBlock ? [{ type: 'text', text: themeBlock }] : []),
              { type: 'text', text: dynamicSuffix },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any,
            tools: [...toolsForAgent(agent.slug), ...ALL_GENERATION_TOOLS],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
          }),
        agent.model,
      );
      response = result.result;
      modelUsedFinal = result.modelUsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown Anthropic error';
      transparency.errors.push(`Anthropic call failed: ${msg}`);
      finalText = `_(I hit an upstream error contacting the model: ${msg}. The user message is saved; you can retry.)_`;
      break;
    }

    totalTokensIn += response.usage.input_tokens ?? 0;
    totalTokensOut += response.usage.output_tokens ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalCachedIn += (response.usage as any).cache_read_input_tokens ?? 0;

    // Collect text + tool_use blocks
    const textBlocks: string[] = [];
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const block of response.content) {
      if (block.type === 'text') textBlocks.push(block.text);
      else if (block.type === 'tool_use') {
        toolUses.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    // Append the assistant turn (with tool_use blocks if any)
    messages.push({
      role: 'assistant',
      content: response.content as ContentBlock[],
    });

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      finalText = textBlocks.join('\n').trim() || '_(empty response)_';
      // If we hit the per-round output cap, the model was cut off mid-sentence.
      // Surface it so the user knows to ask for a shorter version, rather than
      // silently sending a half-finished answer.
      if (response.stop_reason === 'max_tokens') {
        finalText +=
          '\n\n_(Response truncated — hit the per-round output cap. Ask me to continue, or break the request into smaller pieces.)_';
      }
      break;
    }

    // Execute each tool, append results
    const toolResults: ContentBlock[] = [];
    for (const tu of toolUses) {
      let result: ToolResult;
      try {
        if (tu.name === 'consult_agent') {
          if (consultationsUsed >= MAX_CONSULTATIONS_PER_TURN) {
            result = { text: `Error: max consultations per turn (${MAX_CONSULTATIONS_PER_TURN}) reached.`, isError: true };
          } else if (ctx.consultationDepth >= MAX_CONSULT_DEPTH) {
            result = { text: `Error: max consultation depth (${MAX_CONSULT_DEPTH}) reached.`, isError: true };
          } else {
            consultationsUsed++;
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            result = await executeConsultAgent(
              tu.input as { agent_slug: string; question: string },
              ctx,
            );
            transparency.consultations.push({
              slug: (tu.input as { agent_slug: string }).agent_slug,
              question: (tu.input as { question: string }).question,
            });
          }
        } else if (tu.name === 'create_task') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeCreateTask(tu.input as any, ctx);
        } else if (tu.name === 'update_task_status') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeUpdateTaskStatus(tu.input as any, ctx);
        } else if (tu.name === 'list_tasks') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeListTasks(tu.input as any, ctx);
        } else if (tu.name === 'get_partner_profile') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeGetPartnerProfile(tu.input as any, ctx);
        } else if (tu.name === 'update_partner_profile') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeUpdatePartnerProfile(tu.input as any, ctx);
        } else if (tu.name === 'list_partners') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeListPartners(tu.input as any, ctx);
        } else if (tu.name === 'list_partner_reports') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeListPartnerReports(tu.input as any, ctx);
        } else if (tu.name === 'start_or_get_report') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeStartOrGetReport(tu.input as any, ctx);
        } else if (tu.name === 'resolve_quantity') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeResolveQuantity(tu.input as any, ctx);
        } else if (tu.name === 'record_production') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeRecordProduction(tu.input as any, ctx);
        } else if (tu.name === 'record_waste') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeRecordWaste(tu.input as any, ctx);
        } else if (tu.name === 'submit_report') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeSubmitReport(tu.input as any, ctx);
        } else if (tu.name === 'get_report_detail') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeGetReportDetail(tu.input as any, ctx);
        } else if (tu.name === 'set_validation_result') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeSetValidationResult(tu.input as any, ctx);
        } else if (tu.name === 'approve_report') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeApproveReport(tu.input as any, ctx);
        } else if (tu.name === 'request_tier_change') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeRequestTierChange(tu.input as any, ctx);
        } else if (tu.name === 'get_regional_benchmark') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeGetRegionalBenchmark(tu.input as any, ctx);
        } else if (tu.name === 'get_facts') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeGetFacts(tu.input as any, ctx);
        } else if (tu.name === 'query_sector_metrics') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeQuerySectorMetrics(tu.input as any, ctx);
        } else if (tu.name === 'list_documents') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeListDocuments(tu.input as any, ctx);
        } else if (tu.name === 'read_document') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeReadDocument(tu.input as any, ctx);
        } else if (tu.name === 'create_collection_ticket') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeCreateCollectionTicket(tu.input as any, ctx);
        } else if (tu.name === 'submit_application') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeSubmitApplication(tu.input as any, ctx);
        } else if (tu.name === 'log_suggestion') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeLogSuggestion(tu.input as any, ctx);
        } else if (tu.name === 'bulk_register_partners') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result = await executeBulkRegisterPartners(tu.input as any, ctx);
        } else if (
          tu.name === 'generate_xlsx' ||
          tu.name === 'edit_xlsx' ||
          tu.name === 'generate_docx' ||
          tu.name === 'edit_docx' ||
          tu.name === 'generate_pdf' ||
          tu.name === 'generate_pptx' ||
          tu.name === 'edit_pptx'
        ) {
          const kind: GenerationKind =
            tu.name === 'generate_xlsx' ? 'xlsx' :
            tu.name === 'edit_xlsx'     ? 'edit_xlsx' :
            tu.name === 'generate_docx' ? 'docx' :
            tu.name === 'edit_docx'     ? 'edit_docx' :
            tu.name === 'generate_pdf'  ? 'pdf' :
            tu.name === 'generate_pptx' ? 'pptx' : 'edit_pptx';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const genResult = await executeGenerateFile(kind, tu.input as any, { agent, user });
          if (genResult.documentId) generatedDocIds.push(genResult.documentId);
          result = {
            text: genResult.text,
            isError: genResult.isError,
            effects: genResult.effects,
          };
        } else {
          result = { text: `Error: unknown tool "${tu.name}"`, isError: true };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        result = { text: `Tool ${tu.name} threw: ${msg}`, isError: true };
      }

      transparency.tools.push({
        name: tu.name,
        ok: !result.isError,
        summary: result.text.slice(0, 200),
      });
      if (result.effects) {
        for (const [k, v] of Object.entries(result.effects)) {
          (transparency.effects[k] ||= []).push(...(Array.isArray(v) ? v : [v]));
        }
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result.text,
        is_error: result.isError,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Bounded loop hit its limit without a final text answer
  if (!finalText) {
    finalText = '_(I ran out of tool-use rounds without reaching a final answer. State is preserved — you can ask me to continue or simplify the request.)_';
  }

  // Persist assistant message + transparency data + any generated docs
  const assistantMessage = await prisma.message.create({
    data: {
      threadId: thread.id,
      role: 'ASSISTANT',
      content: finalText,
      agentId: agent.id,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cachedTokensIn: totalCachedIn,
      modelUsed: modelUsedFinal,
      channel: 'web',
      mode: 'execute',
      toolsUsed: JSON.parse(JSON.stringify(transparency)),
      attachmentDocIds: generatedDocIds,
    },
  });

  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      agentId: agent.id,
      userId: user.id,
      action: 'agent.message',
      entityType: 'Message',
      entityId: assistantMessage.id,
      summary: `${user.name} ↔ ${agent.slug}`,
      metadata: {
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        cachedIn: totalCachedIn,
        model: modelUsedFinal,
        toolCalls: transparency.tools.length,
        consultations: transparency.consultations.length,
      },
    },
  });

  // Look up metadata for any generated docs so the UI can render attachment chips
  const generatedDocsMeta = generatedDocIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: generatedDocIds } },
        select: { id: true, title: true, mimeType: true, sizeBytes: true },
      })
    : [];

  return NextResponse.json({
    threadId: thread.id,
    messageId: assistantMessage.id,
    content: finalText,
    transparency,
    attachments: generatedDocsMeta,
    usage: {
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      cachedIn: totalCachedIn,
      model: modelUsedFinal,
    },
  });
}

// ────────────────────────────────────────────────────────────────
// consult_agent — recursive but bounded
// ────────────────────────────────────────────────────────────────

async function executeConsultAgent(
  input: { agent_slug: string; question: string },
  ctx: ToolExecuteContext,
): Promise<ToolResult> {
  if (!input.agent_slug || !input.question) {
    return { text: 'Error: consult_agent requires both agent_slug and question.', isError: true };
  }

  const target = await prisma.agent.findUnique({ where: { slug: input.agent_slug } });
  if (!target || !target.isActive) {
    return { text: `Error: agent "${input.agent_slug}" not found or inactive.`, isError: true };
  }
  if (target.id === ctx.agent.id) {
    return { text: 'Error: cannot consult yourself.', isError: true };
  }

  try {
    const cachedPrefix = `${buildCachedPrefix()}\n\n---\n\n# Your agent profile\n\n${target.systemPrompt}`;
    const crossThread = await buildCrossThreadContext(target);
    const dynamicSuffix = [
      `# Consultation context`,
      `You are being consulted by ${ctx.agent.name} (${ctx.agent.slug}) on behalf of ${ctx.user?.name ?? 'an autonomous run'}.`,
      `Be concise. Answer in ≤ 200 words. Take a position — don't list options as if equally weighted. Cite specifics. Note caveats only when material.`,
      ``,
      crossThread || '',
    ].join('\n');

    const consultThemeBlock = await buildCurrentThemeBlock();
    const result = await callAnthropicWithFallback(
      async (model: string) =>
        getAnthropicClient().messages.create({
          model,
          max_tokens: 600,
          temperature: target.temperature,
          system: [
            { type: 'text', text: cachedPrefix, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: buildCurrentDateBlock() },
            ...(consultThemeBlock ? [{ type: 'text', text: consultThemeBlock }] : []),
            { type: 'text', text: dynamicSuffix },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
          messages: [{ role: 'user', content: input.question }],
        }),
      target.model,
    );

    const text =
      result.result.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim() || '_(consulted agent had nothing to add)_';

    await prisma.auditLog.create({
      data: {
        agentId: ctx.agent.id,
        userId: ctx.user?.id,
        action: 'agent.consult',
        entityType: 'Agent',
        entityId: target.id,
        summary: `${ctx.agent.slug} consulted ${target.slug}`,
        metadata: {
          question: input.question.slice(0, 200),
          tokensIn: result.result.usage.input_tokens,
          tokensOut: result.result.usage.output_tokens,
        },
      },
    });

    return {
      text: `[Reply from ${target.name} (${target.slug})]\n${text}`,
      effects: { consultations: [{ slug: target.slug, name: target.name }] },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return { text: `Error consulting ${target.slug}: ${msg}`, isError: true };
  }
}
