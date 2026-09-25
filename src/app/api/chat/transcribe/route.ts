/**
 * POST /api/chat/transcribe
 *
 * Voice-to-chat support. Accepts a short audio recording from the
 * browser's MediaRecorder API (webm/opus or mp4/aac) and returns the
 * transcribed text via OpenAI's Whisper API.
 *
 * Auth-gated to logged-in users. Capped at 25 MB per request (Whisper's
 * own limit) and ~10 minutes of audio (sanity bound).
 *
 * Failure modes handled:
 *   - No OPENAI_API_KEY configured        → 503 with helpful message
 *   - Audio too large or wrong type       → 400
 *   - Whisper returns an error            → forwarded to client with detail
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { persistUpload, StorageError } from '@/lib/storage';
import { buildSttPrompt } from '@/lib/arabic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;          // Whisper hard limit
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm', 'audio/webm;codecs=opus',
  'audio/mp4',  'audio/m4a',  'audio/x-m4a',
  'audio/mpeg', 'audio/mp3',
  'audio/wav',  'audio/x-wav',
  'audio/ogg',  'audio/ogg;codecs=opus',
  'audio/flac',
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice transcription is not configured on this server. Ask your admin to set OPENAI_API_KEY in Coolify.' },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Could not parse multipart body.' }, { status: 400 });
  }

  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'No audio provided.' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `Audio too large (${(audio.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.` },
      { status: 400 },
    );
  }
  // The browser sometimes sends without a mime type (or with "application/octet-stream").
  // Accept anything that LOOKS like audio, since the user can't easily change it.
  const mime = audio.type ?? '';
  if (mime && !ALLOWED_AUDIO_MIMES.has(mime) && !mime.startsWith('audio/')) {
    return NextResponse.json(
      { error: `Unsupported audio type "${mime}". Use webm, mp4, mp3, wav, or m4a.` },
      { status: 400 },
    );
  }

  // ── Persist the audio FIRST — voice notes are evidence, not ephemera.
  // Without this the audit trail ends at the transcript and the original
  // farmer utterance is unrecoverable. Document is tagged 'voice-note';
  // the chat route attaches the agent's branch when the client sends it
  // as an attachment (attachedDocIds), same as any upload.
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 401 });

  const audioDoc = await prisma.document.create({
    data: {
      title: `Voice note — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      kind: 'GENERAL',
      ipSensitivity: 'INTERNAL',
      entity: dbUser.entity,
      allowedBranches: [],
      tags: ['voice-note'],
      uploaderId: dbUser.id,
      mimeType: mime || 'audio/webm',
    },
  });
  let audioDocId: string | null = null;
  try {
    const persisted = await persistUpload(audioDoc.id, audio);
    await prisma.document.update({
      where: { id: audioDoc.id },
      data: { storagePath: persisted.storagePath, sizeBytes: persisted.sizeBytes, mimeType: persisted.mimeType },
    });
    audioDocId = audioDoc.id;
  } catch (err) {
    await prisma.document.delete({ where: { id: audioDoc.id } }).catch(() => undefined);
    const status = err instanceof StorageError ? 400 : 500;
    return NextResponse.json(
      { error: `Could not store voice note: ${err instanceof Error ? err.message : 'unknown'}` },
      { status },
    );
  }

  // Forward to Whisper. We pass the user's audio file straight through —
  // no transcoding, no buffering beyond the FormData boundary.
  const whisperForm = new FormData();
  whisperForm.append('file', audio, audio.name || 'recording.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('response_format', 'json');
  // Domain hint built from the SAME Arabic lexicon the resolver uses —
  // Arabic script (جريد/وايت/بيكة/كرب) so Whisper preserves dialect
  // spellings instead of transliterating them into Latin.
  whisperForm.append('prompt', buildSttPrompt());

  const start = Date.now();
  let whisperRes: Response;
  try {
    whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ error: `Whisper request failed: ${msg}` }, { status: 502 });
  }

  const elapsedMs = Date.now() - start;

  if (!whisperRes.ok) {
    let detail = '';
    try {
      const errBody = await whisperRes.json();
      detail = errBody?.error?.message ?? JSON.stringify(errBody);
    } catch {
      detail = await whisperRes.text();
    }
    return NextResponse.json(
      { error: `Whisper returned ${whisperRes.status}: ${detail.slice(0, 500)}` },
      { status: 502 },
    );
  }

  let data: { text?: string };
  try {
    data = await whisperRes.json();
  } catch {
    return NextResponse.json({ error: 'Whisper returned non-JSON response.' }, { status: 502 });
  }

  const text = (data.text ?? '').trim();
  if (!text) {
    return NextResponse.json({ error: 'No speech detected in the recording.', docId: audioDocId }, { status: 400 });
  }

  // Link the transcript back to the audio Document — the audit trail is
  // figure → resolution → transcript → original voice note.
  if (audioDocId) {
    await prisma.document.update({
      where: { id: audioDocId },
      data: { extractedText: text.slice(0, 8000) },
    }).catch(() => undefined);
  }

  // Quiet audit log — useful to track cost + usage patterns without blowing up the log volume
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'chat.transcribe',
      summary: `${session.user.name} transcribed ${(audio.size / 1024).toFixed(0)} KB of audio (${text.length} chars)`,
      metadata: { sizeBytes: audio.size, mimeType: audio.type || null, chars: text.length, elapsedMs },
    },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, text, docId: audioDocId });
}
