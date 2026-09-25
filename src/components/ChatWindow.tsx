'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Mic,
  Square,
  Loader2,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileType,
  Presentation,
  File as FileIconLucide,
} from 'lucide-react';
import { agentAvatar } from '@/lib/avatar';
import { getAgentPhotoUrl } from '@/lib/team-avatars';
import MarkdownText from './MarkdownText';

interface AttachmentMeta {
  id: string;
  title: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

/**
 * Frontend representation of a staged chat attachment. Files upload
 * immediately on selection (no waiting for send), and progress is reflected
 * per-slot in the UI. Status moves: uploading → uploaded | error.
 */
interface Attachment {
  /** Local id (used as React key + for removal). */
  localId: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  status: 'uploading' | 'uploaded' | 'error';
  /** Server-side Document.id once upload completes. */
  docId?: string;
  /** Error message if upload failed. */
  errorMessage?: string;
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  modelUsed?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  cachedTokensIn?: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolsUsed?: any;
  attachmentDocIds?: string[];
  attachments?: AttachmentMeta[];
}

interface ChatWindowProps {
  agentSlug: string;
  agentName: string;
  /** Tier controls whether the agent gets an avatar (only ORCHESTRATOR + EXECUTIVE) */
  agentTier?: string;
  initialMessages: Message[];
  initialPrefill?: string;
}

const MAX_FILES = 8;
const MAX_TOTAL_MB = 80;

export default function ChatWindow({ agentSlug, agentName, agentTier, initialMessages, initialPrefill }: ChatWindowProps) {
  const showAvatar = agentTier === 'ORCHESTRATOR' || agentTier === 'EXECUTIVE';
  const agentAv = showAvatar ? agentAvatar(agentName) : null;
  const agentPhotoUrl = showAvatar ? getAgentPhotoUrl(agentSlug) : null;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState(initialPrefill ?? '');
  /**
   * Attachment slots. Each is a single file the user has staged for the
   * next message. Files are uploaded IMMEDIATELY (two-step pattern) so the
   * actual chat POST is a tiny JSON body — bypasses proxy multipart caps.
   */
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /**
   * Outbound queue — when the user sends faster than the agent thinks,
   * extra messages park here and get drained sequentially.
   */
  const [queue, setQueue] = useState<Array<{ text: string; docIds: string[] }>>([]);
  /** Voice-to-chat state. */
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (initialPrefill && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(initialPrefill.length, initialPrefill.length);
    }
  }, [initialPrefill]);

  // ─────────────────────────────────────────────────────────────
  // Voice recording — MediaRecorder API → /api/chat/transcribe
  // ─────────────────────────────────────────────────────────────

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick the best supported mime; Whisper accepts both
      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supported = candidateTypes.find((t) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
      );
      const mr = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        // Stop the mic stream tracks so the OS indicator clears
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: supported ?? 'audio/webm' });
        audioChunksRef.current = [];
        if (blob.size === 0) {
          setError('No audio captured.');
          return;
        }
        await transcribeBlob(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          // Auto-stop at 10 minutes — Whisper sanity bound
          if (s >= 600) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'microphone error';
      // Common: NotAllowedError when permission denied
      setError(`Could not start recording: ${msg}`);
      setRecording(false);
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
  }

  async function transcribeBlob(blob: Blob) {
    setTranscribing(true);
    try {
      const ext = blob.type.includes('webm') ? 'webm'
        : blob.type.includes('mp4') ? 'm4a'
        : blob.type.includes('ogg') ? 'ogg'
        : 'webm';
      const fd = new FormData();
      fd.append('audio', new File([blob], `recording.${ext}`, { type: blob.type || 'audio/webm' }));
      const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Append (don't replace) so the user can build on existing text
      setInput((curr) => {
        const sep = curr && !curr.endsWith(' ') && !curr.endsWith('\n') ? ' ' : '';
        return curr + sep + data.text;
      });
      // Re-focus the textarea so the user can immediately edit / send
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'transcription failed';
      setError(msg);
    } finally {
      setTranscribing(false);
    }
  }

  // Clean up timer if component unmounts mid-recording
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  /**
   * Stage new files and kick off streaming upload for each. The /api/chat/upload-attachment
   * endpoint streams body → disk (no multipart parsing) so this works at any
   * size up to MAX_TOTAL_MB without the proxy cap that breaks formData uploads.
   */
  function addFiles(incoming: FileList | File[]) {
    setError(null);
    const list = Array.from(incoming);
    const existingBytes = attachments.reduce((acc, a) => acc + a.sizeBytes, 0);
    let totalBytes = existingBytes;
    const newAttachments: Attachment[] = [];

    for (const f of list) {
      if (attachments.length + newAttachments.length >= MAX_FILES) {
        setError(`Max ${MAX_FILES} attachments per message.`);
        break;
      }
      if (totalBytes + f.size > MAX_TOTAL_MB * 1024 * 1024) {
        setError(`Total attachment size exceeds ${MAX_TOTAL_MB} MB.`);
        break;
      }
      const localId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      newAttachments.push({
        localId,
        name: f.name,
        sizeBytes: f.size,
        mimeType: f.type || 'application/octet-stream',
        status: 'uploading',
      });
      totalBytes += f.size;
      // Kick off upload (fire-and-forget; updates state when done)
      void uploadAttachment(localId, f);
    }
    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  }

  async function uploadAttachment(localId: string, file: File): Promise<void> {
    try {
      const res = await fetch('/api/chat/upload-attachment', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed (HTTP ${res.status})`);

      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId
            ? { ...a, status: 'uploaded', docId: data.docId }
            : a,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setAttachments((prev) =>
        prev.map((a) =>
          a.localId === localId
            ? { ...a, status: 'error', errorMessage: msg }
            : a,
        ),
      );
    }
  }

  function removeAttachment(localId: string) {
    setAttachments((prev) => prev.filter((a) => a.localId !== localId));
  }

  /**
   * Make the actual API call for a single message. Always JSON now — files
   * were already streamed up via /api/chat/upload-attachment, so we just
   * reference their Document.ids here. Tiny body, no proxy size pressure.
   */
  async function postMessage(text: string, docIds: string[]): Promise<void> {
    try {
      const res = await fetch(`/api/agents/${agentSlug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          ...(docIds.length > 0 ? { attachedDocIds: docIds } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        messageId: string;
        content: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transparency: any;
        attachments?: AttachmentMeta[];
        usage: { tokensIn: number; tokensOut: number; cachedIn: number; model: string };
      };

      const assistant: Message = {
        id: data.messageId,
        role: 'ASSISTANT',
        content: data.content,
        createdAt: new Date().toISOString(),
        modelUsed: data.usage.model,
        tokensIn: data.usage.tokensIn,
        tokensOut: data.usage.tokensOut,
        cachedTokensIn: data.usage.cachedIn,
        toolsUsed: data.transparency,
        attachments: data.attachments ?? [],
      };
      setMessages((prev) => [...prev, assistant]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(msg);
      throw err;
    }
  }

  /**
   * User-facing send. Always optimistic — the USER message appears in the
   * thread immediately. If any attachments are still uploading, refuses
   * with a clear error rather than dropping them. If the agent is still
   * working on a previous turn, this message gets queued and dispatched
   * in order when the agent frees up.
   */
  function send() {
    const text = input.trim();
    if (!text) return;
    setError(null);

    // Guard: don't send while any attachment is mid-upload or errored
    const stillUploading = attachments.some((a) => a.status === 'uploading');
    if (stillUploading) {
      setError('Wait — attachment is still uploading.');
      return;
    }
    const failed = attachments.find((a) => a.status === 'error');
    if (failed) {
      setError(`Attachment "${failed.name}" failed to upload — remove it or retry.`);
      return;
    }

    const uploadedDocIds = attachments
      .filter((a): a is Attachment & { docId: string } => a.status === 'uploaded' && !!a.docId)
      .map((a) => a.docId);

    const optimistic: Message = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'USER',
      content: text,
      createdAt: new Date().toISOString(),
      attachments: attachments.map((a) => ({
        id: a.docId ?? a.localId,
        title: a.name,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setAttachments([]);

    if (busy) {
      setQueue((q) => [...q, { text, docIds: uploadedDocIds }]);
      setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    setBusy(true);
    postMessage(text, uploadedDocIds).finally(() => setBusy(false));
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  /**
   * Drain the queue whenever the agent becomes free.
   */
  useEffect(() => {
    if (busy || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setBusy(true);
    postMessage(next.text, next.docIds).finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, queue.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave() {
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  const firstNameOfAgent = agentName.split('—')[0].trim();
  const totalAttachmentSize = attachments.reduce((acc, a) => acc + a.sizeBytes, 0);
  const uploadingCount = attachments.filter((a) => a.status === 'uploading').length;

  return (
    <div
      className="flex flex-col h-[calc(100vh-5rem)] bg-white rounded-xl border border-line shadow-card relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-10 bg-lime/10 border-2 border-dashed border-brand rounded-xl flex items-center justify-center pointer-events-none">
          <div className="text-brand font-medium">Drop files to attach</div>
        </div>
      )}

      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div>
          <div className="font-medium text-brand">{agentName}</div>
          <div className="text-xs text-muted">Chat — drop files anywhere on this panel to attach.</div>
        </div>
        <div className="text-xs text-muted font-mono">{agentSlug}</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted text-sm py-12">
            Start the conversation. Attach files, ask anything in scope of this agent's role.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} agentAvatar={agentAv} agentPhotoUrl={agentPhotoUrl} agentName={agentName} />
        ))}
        {busy && (
          <div className="text-sm text-muted italic">
            {firstNameOfAgent} is thinking…
            {queue.length > 0 && (
              <span className="ml-2 text-xs not-italic text-brand">
                · {queue.length} message{queue.length === 1 ? '' : 's'} queued
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">
          Error: {error}
        </div>
      )}

      {/* Attachment chips — show per-slot upload status */}
      {attachments.length > 0 && (
        <div className="px-5 py-2 border-t border-line bg-mist/40 flex flex-wrap gap-2 text-xs">
          <span className="text-muted self-center">
            {attachments.length} attachment{attachments.length === 1 ? '' : 's'} · {(totalAttachmentSize / 1024 / 1024).toFixed(1)} MB
            {uploadingCount > 0 && <span className="text-amber-700 ml-1">· {uploadingCount} uploading…</span>}
          </span>
          {attachments.map((a) => (
            <span
              key={a.localId}
              className={`inline-flex items-center gap-2 border rounded-md px-2 py-1 ${
                a.status === 'uploaded' ? 'bg-white border-line' :
                a.status === 'uploading' ? 'bg-amber-50 border-amber-200 animate-pulse' :
                'bg-red-50 border-red-300'
              }`}
              title={a.status === 'error' ? a.errorMessage : undefined}
            >
              <FileIcon mime={a.mimeType} />
              <span className="text-ink truncate max-w-[200px]">{a.name}</span>
              <span className="text-[10px] opacity-60">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
              {a.status === 'uploaded' && <span className="text-green-700 text-[10px]" title="Uploaded">✓</span>}
              {a.status === 'uploading' && <span className="text-amber-700 text-[10px]">⏳</span>}
              {a.status === 'error' && <span className="text-red-700 text-[10px]" title={a.errorMessage}>!</span>}
              <button
                type="button"
                onClick={() => removeAttachment(a.localId)}
                className="text-muted hover:text-red-600"
                title="Remove attachment"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-line/60 px-5 py-4 bg-white">
        <div className="rounded-2xl border border-line/70 bg-white shadow-card focus-within:border-brand-200 focus-within:ring-2 focus-within:ring-lime/20 transition-shadow">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              busy
                ? `${firstNameOfAgent} is still thinking — fire away, I'll queue and send in order.`
                : 'Message — Enter to send, Shift+Enter for a new line'
            }
            rows={2}
            className="w-full px-5 pt-4 pb-2 text-sm bg-transparent focus:outline-none resize-none leading-relaxed placeholder:text-muted/70"
          />
          <div className="flex justify-between items-center px-3 pb-2.5 pt-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={recording || transcribing}
                className="text-xs px-2.5 py-1.5 rounded-full hover:bg-mist text-muted hover:text-brand flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                title="Attach files (any type, max 8 files, 80 MB total). Phone photos auto-resized for the agent."
              >
                <Paperclip className="w-4 h-4" strokeWidth={1.8} />
                <span className="hidden sm:inline">Attach</span>
              </button>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 disabled:opacity-50 transition-colors ${
                  recording
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 animate-pulse'
                    : transcribing
                    ? 'bg-amber-50 text-amber-700'
                    : 'hover:bg-mist text-muted hover:text-brand'
                }`}
                title={
                  recording
                    ? 'Click to stop recording'
                    : transcribing
                    ? 'Transcribing…'
                    : 'Hold to dictate (uses your microphone; transcribed via Whisper). Click once to start, click again to stop.'
                }
              >
                {recording ? (
                  <Square className="w-4 h-4" strokeWidth={2} />
                ) : transcribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <Mic className="w-4 h-4" strokeWidth={1.8} />
                )}
                <span className="hidden sm:inline">
                  {recording ? `Rec ${formatSeconds(recordingSeconds)}` : transcribing ? 'Transcribing…' : 'Dictate'}
                </span>
              </button>
            </div>
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-5 py-2 rounded-full text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-card-hover"
              style={{ background: '#004923' }}
              title={busy ? 'Agent is mid-thought — your message will queue and send in order.' : 'Send message'}
            >
              {busy && queue.length > 0 ? `Queue +${queue.length + 1}` : busy ? 'Queue +1' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSeconds(s: number): string {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function MessageBubble({
  message, agentAvatar: av, agentPhotoUrl, agentName,
}: { message: Message; agentAvatar?: { initials: string; color: string } | null; agentPhotoUrl?: string | null; agentName?: string }) {
  const isUser = message.role === 'USER';
  const toolCount = message.toolsUsed?.tools?.length ?? 0;
  const consultCount = message.toolsUsed?.consultations?.length ?? 0;
  const atts = message.attachments ?? [];

  return (
    <div className={`flex items-start gap-2.5 animate-msg-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && av && (
        agentPhotoUrl ? (
          <span
            className="inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 mt-1"
            style={{ width: 32, height: 32 }}
            aria-label={agentName ?? 'agent'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={agentPhotoUrl}
              alt={agentName ?? av.initials}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </span>
        ) : (
          <span
            className="inline-flex items-center justify-center rounded-full text-white font-medium flex-shrink-0 mt-1 text-[11px]"
            style={{ width: 32, height: 32, background: av.color, letterSpacing: '-0.02em' }}
            aria-label={agentName ?? 'agent'}
          >
            {av.initials}
          </span>
        )
      )}
      <div className={`max-w-[78%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
        isUser ? 'bg-brand text-white' : 'bg-white border border-line/70 text-ink'
      }`}>
        {atts.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 mb-2 ${isUser ? '' : ''}`}>
            {atts.map((a) => (
              <a
                key={a.id}
                href={a.id.startsWith('opt-') ? undefined : `/api/documents/${a.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs rounded px-2 py-1 ${
                  isUser ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white border border-line text-ink hover:border-brand-200'
                }`}
                title={a.mimeType ?? ''}
              >
                <FileIcon mime={a.mimeType ?? ''} small />
                <span className="truncate max-w-[180px]">{a.title}</span>
              </a>
            ))}
          </div>
        )}
        <MarkdownText variant={isUser ? 'inverted' : 'default'}>{message.content}</MarkdownText>
        {!isUser && (toolCount > 0 || consultCount > 0 || message.modelUsed) && (
          <div className={`text-[10px] mt-2 pt-2 border-t flex items-center gap-3 flex-wrap ${
            isUser ? 'text-white/60 border-white/20' : 'text-muted border-line'
          }`}>
            {message.modelUsed && <span>{message.modelUsed}</span>}
            {toolCount > 0 && <span>{toolCount} tool call{toolCount === 1 ? '' : 's'}</span>}
            {consultCount > 0 && <span>{consultCount} consultation{consultCount === 1 ? '' : 's'}</span>}
            {message.tokensIn !== null && message.tokensIn !== undefined && (
              <span>{message.tokensIn}↓ {message.tokensOut}↑ tok</span>
            )}
            {message.cachedTokensIn !== null && message.cachedTokensIn !== undefined && message.cachedTokensIn > 0 && (
              <span className="text-lime-700">cache: {message.cachedTokensIn}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FileIcon({ mime, small }: { mime: string; small?: boolean }) {
  const sz = small ? 'w-3.5 h-3.5' : 'w-4 h-4';
  if (mime.startsWith('image/')) return <ImageIcon className={`${sz} flex-shrink-0`} strokeWidth={1.8} />;
  if (mime === 'application/pdf') return <FileType className={`${sz} flex-shrink-0`} strokeWidth={1.8} />;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet className={`${sz} flex-shrink-0`} strokeWidth={1.8} />;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return <Presentation className={`${sz} flex-shrink-0`} strokeWidth={1.8} />;
  if (mime.includes('word') || mime.includes('document')) return <FileText className={`${sz} flex-shrink-0`} strokeWidth={1.8} />;
  return <FileIconLucide className={`${sz} flex-shrink-0`} strokeWidth={1.8} />;
}
