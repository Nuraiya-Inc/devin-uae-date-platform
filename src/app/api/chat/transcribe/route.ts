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

  // Forward to Whisper. We pass the user's audio file straight through —
  // no transcoding, no buffering beyond the FormData boundary.
  const whisperForm = new FormData();
  whisperForm.append('file', audio, audio.name || 'recording.webm');
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('response_format', 'json');
  // Optional hint to Whisper for better domain-specific recognition.
  whisperForm.append(
    'prompt',
    'UAE Palm Network, dates, date palm, Khalas, Lulu, Fard, Khenaizi, Barhi, Dabbas, Medjool, Al Ain, Liwa, Al Dhafra, Ras Al Khaimah, Fujairah, fronds, saaf, karab, leef, tons, quarterly report, recycling, compost, biochar.',
  );

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
    return NextResponse.json({ error: 'No speech detected in the recording.' }, { status: 400 });
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

  return NextResponse.json({ ok: true, text });
}
