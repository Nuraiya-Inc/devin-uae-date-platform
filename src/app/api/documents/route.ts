/**
 * Documents API.
 *
 * POST /api/documents   — multipart upload + metadata. Any authenticated user.
 * GET  /api/documents   — list visible documents (server-side ACL applied).
 *
 * AI summary + text extraction (mammoth for docx, pdf-parse, xlsx) ship next
 * slice. For now we store the file + metadata; agents will get a `read_document`
 * tool in the next iteration that respects the IP-sensitivity gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userCanReadDocument, isExec } from '@/lib/access';
import { persistUpload, StorageError } from '@/lib/storage';
import { analyzeDocument } from '@/lib/document-analysis';
import type { DocumentKind, IpSensitivity, SafaEntity, AgentBranch } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS = [
  'PITCH_DECK', 'BUSINESS_PLAN', 'FINANCIAL_MODEL', 'INVESTOR_UPDATE',
  'TERM_SHEET', 'CONTRACT', 'LOI', 'NDA',
  'REGULATORY_DOSSIER', 'SCIENTIFIC_MEMO', 'SOP', 'HSE_REPORT',
  'BOARD_PACK', 'LEGAL_OPINION', 'POLICY', 'GENERAL',
] as const;

const VALID_SENSITIVITIES = [
  'PUBLIC', 'INTERNAL', 'COMMERCIAL_SENSITIVE', 'IP_CRITICAL', 'INVESTOR_RESTRICTED',
] as const;

const VALID_ENTITIES = ['FZE', 'INC', 'GROUP', 'CHEMPLAX'] as const;

const VALID_BRANCHES = ['EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS'] as const;

// ────────────────────────────────────────────────────────────────
// POST /api/documents
// ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not parse multipart form.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file field provided.' }, { status: 400 });
  }

  const title = String(formData.get('title') ?? '').trim() || file.name || 'Untitled';
  const kindRaw = String(formData.get('kind') ?? 'GENERAL');
  const sensitivityRaw = String(formData.get('ipSensitivity') ?? 'INTERNAL');
  const entityRaw = String(formData.get('entity') ?? session.user.entity);
  const projectSlug = String(formData.get('projectSlug') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const tagsRaw = String(formData.get('tags') ?? '').trim();
  const allowedBranchesRaw = formData.getAll('allowedBranches').map(String);

  // Validate enums
  const kind: DocumentKind = VALID_KINDS.includes(kindRaw as DocumentKind) ? (kindRaw as DocumentKind) : 'GENERAL';
  const ipSensitivity: IpSensitivity = VALID_SENSITIVITIES.includes(sensitivityRaw as IpSensitivity)
    ? (sensitivityRaw as IpSensitivity) : 'INTERNAL';
  const entity: SafaEntity = VALID_ENTITIES.includes(entityRaw as SafaEntity) ? (entityRaw as SafaEntity) : session.user.entity;
  const allowedBranches: AgentBranch[] = allowedBranchesRaw.filter((b): b is AgentBranch =>
    VALID_BRANCHES.includes(b as AgentBranch),
  );

  // CHEMPLAX docs require exec — separation rule
  if (entity === 'CHEMPLAX' && !isExec(session.user.role)) {
    return NextResponse.json({ error: 'Only CEO/MD can tag a document as CHEMPLAX entity.' }, { status: 403 });
  }

  // Resolve optional project
  let projectId: string | null = null;
  if (projectSlug) {
    const proj = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (proj) projectId = proj.id;
    else return NextResponse.json({ error: `Project "${projectSlug}" not found.` }, { status: 400 });
  }

  // Parse tags (comma-separated, lowercase, max 10)
  const tags = tagsRaw
    .split(',').map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 30)
    .slice(0, 10);

  // Create the row WITHOUT a storage path first so we have its id
  let created;
  try {
    created = await prisma.document.create({
      data: {
        title: title.slice(0, 200),
        kind,
        ipSensitivity,
        entity,
        allowedBranches,
        tags,
        notes,
        projectId,
        uploaderId: session.user.id,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: `DB error: ${msg}` }, { status: 500 });
  }

  // Persist the file using the new doc's id as folder
  let persisted: { storagePath: string; sizeBytes: number; mimeType: string };
  try {
    persisted = await persistUpload(created.id, file);
  } catch (err) {
    // Rollback the row — we don't want orphaned metadata
    await prisma.document.delete({ where: { id: created.id } }).catch(() => undefined);
    const msg = err instanceof StorageError ? err.message : err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Update the row with the actual storage path + mime + size
  const doc = await prisma.document.update({
    where: { id: created.id },
    data: {
      storagePath: persisted.storagePath,
      sizeBytes: persisted.sizeBytes,
      mimeType: persisted.mimeType,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'document.upload',
      entityType: 'Document',
      entityId: doc.id,
      summary: `${session.user.name} uploaded "${doc.title}" (${kind}, ${ipSensitivity})`,
      metadata: {
        kind, ipSensitivity, entity, sizeBytes: doc.sizeBytes, mimeType: doc.mimeType, projectId,
      },
    },
  });

  // Fire-and-forget AI classification. The Document row is already saved;
  // analyzeDocument() updates it with AI title/kind/sensitivity/branches
  // when it finishes (typically 5-15 seconds for a normal upload). The UI
  // shows aiAnalysisPending=true until then.
  analyzeDocument(doc.id).catch((err) => {
    console.error(`[documents] analysis failed for ${doc.id}:`, err);
  });

  return NextResponse.json({
    ok: true,
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    ipSensitivity: doc.ipSensitivity,
    sizeBytes: doc.sizeBytes,
    aiAnalysisPending: true,
  });
}

// ────────────────────────────────────────────────────────────────
// GET /api/documents — paged + ACL-filtered list
// ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind');
  const projectSlug = url.searchParams.get('project');

  const where: Record<string, unknown> = {};
  if (kind && VALID_KINDS.includes(kind as DocumentKind)) where.kind = kind;
  if (projectSlug) {
    const p = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (p) where.projectId = p.id;
  }

  const docs = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { uploader: { select: { name: true } } },
  });

  // ACL filter
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { reportsToAgent: { select: { branch: true } } },
  });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 401 });

  const visible = docs.filter((d) =>
    userCanReadDocument(
      { role: dbUser.role, entity: dbUser.entity, canAccessAllEntities: dbUser.canAccessAllEntities },
      dbUser.reportsToAgent?.branch ?? null,
      { ipSensitivity: d.ipSensitivity, entity: d.entity, allowedBranches: d.allowedBranches },
    ),
  );

  return NextResponse.json({ count: visible.length, total: docs.length, docs: visible });
}
