/**
 * Gmail client — service-account-based access to agent mailboxes.
 *
 * Auth flow:
 *   1. Load the service account JSON from GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var
 *   2. Use it to mint a JWT that impersonates the target mailbox owner
 *   3. Exchange the JWT for an OAuth access token
 *   4. Pass the token to the Gmail API client
 *
 * The service account itself has no mailbox — domain-wide delegation lets
 * it ACT AS any user in the Workspace domain (gated by the scopes we
 * authorized in admin.google.com → API controls).
 *
 * Tokens are cached per-user for ~50 minutes (Google issues 60-min tokens;
 * we refresh slightly early). The cache is in-process and goes away on
 * server restart — fine for our scale.
 */

import { google, type gmail_v1 } from 'googleapis';
import { JWT } from 'google-auth-library';

/** Scopes — must match what's authorized in admin.google.com domain-wide delegation. */
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

interface ServiceAccountJson {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  [k: string]: unknown;
}

let cachedKey: ServiceAccountJson | null = null;

function loadServiceAccountKey(): ServiceAccountJson {
  if (cachedKey) return cachedKey;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
  if (!raw) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY_JSON env var is not set. Gmail integration requires the service account JSON.',
    );
  }
  try {
    cachedKey = JSON.parse(raw) as ServiceAccountJson;
    return cachedKey;
  } catch (err) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_KEY_JSON is set but not valid JSON: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}

// Per-mailbox JWT client cache (avoid re-creating the same client on every call).
const jwtCache = new Map<string, JWT>();

/**
 * Return an authenticated Gmail v1 client that acts AS the given mailbox.
 * Caller must pass a real Workspace email address (e.g. layla@safabioworks.com).
 */
export function getGmailClientFor(userEmail: string): gmail_v1.Gmail {
  const key = loadServiceAccountKey();
  let jwt = jwtCache.get(userEmail);
  if (!jwt) {
    jwt = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: SCOPES,
      subject: userEmail, // ← this is the impersonation: act as this user
    });
    jwtCache.set(userEmail, jwt);
  }
  return google.gmail({ version: 'v1', auth: jwt });
}

// ─────────────────────────────────────────────────────────────
// High-level helpers — used by the agent tools in tool-catalog.ts
// ─────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

/**
 * List recent messages in the user's inbox. Default: 15 most recent threads,
 * INBOX label only (not sent / drafts / spam). Returns lightweight metadata —
 * use readThread() to get the full body of a specific thread.
 */
export async function listInbox(
  userEmail: string,
  opts?: { limit?: number; query?: string },
): Promise<InboxMessage[]> {
  const gmail = getGmailClientFor(userEmail);
  const limit = Math.min(opts?.limit ?? 15, 50);
  const query = opts?.query ?? 'in:inbox';

  // Step 1: list message IDs matching the query
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: limit,
  });
  const msgs = listRes.data.messages ?? [];
  if (msgs.length === 0) return [];

  // Step 2: fetch headers + snippet for each — parallel
  const details = await Promise.all(
    msgs.map(async (m) => {
      const res = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });
      const msg = res.data;
      const headers = new Map(
        (msg.payload?.headers ?? []).map((h) => [h.name?.toLowerCase() ?? '', h.value ?? '']),
      );
      return {
        id: msg.id ?? '',
        threadId: msg.threadId ?? '',
        from: headers.get('from') ?? '',
        to: headers.get('to') ?? '',
        subject: headers.get('subject') ?? '(no subject)',
        snippet: msg.snippet ?? '',
        date: headers.get('date') ?? '',
        unread: (msg.labelIds ?? []).includes('UNREAD'),
      } as InboxMessage;
    }),
  );
  return details;
}

/** Read the full body of a thread. Returns plain text only; HTML is decoded best-effort. */
export async function readThread(
  userEmail: string,
  threadId: string,
): Promise<{ subject: string; messages: Array<{ from: string; to: string; date: string; body: string }> }> {
  const gmail = getGmailClientFor(userEmail);
  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });
  const msgs = res.data.messages ?? [];
  let subject = '(no subject)';
  const out: Array<{ from: string; to: string; date: string; body: string }> = [];

  for (const m of msgs) {
    const headers = new Map(
      (m.payload?.headers ?? []).map((h) => [h.name?.toLowerCase() ?? '', h.value ?? '']),
    );
    if (headers.get('subject') && subject === '(no subject)') {
      subject = headers.get('subject') ?? subject;
    }
    out.push({
      from: headers.get('from') ?? '',
      to: headers.get('to') ?? '',
      date: headers.get('date') ?? '',
      body: extractPlainTextBody(m.payload),
    });
  }
  return { subject, messages: out };
}

/**
 * One file to attach to an email — name, MIME type, raw bytes.
 * The caller is responsible for reading the file from storage; this lib
 * just MIME-encodes whatever it gets.
 */
export interface EmailAttachment {
  filename: string;
  mimeType: string;
  /** Raw file bytes — will be base64-encoded into the MIME part. */
  content: Buffer;
}

/**
 * Send a message AS the given mailbox. Supports plain-text body + an
 * optional array of file attachments. When attachments are present, the
 * message is built as multipart/mixed with one part per attachment.
 *
 * Returns the new message id on success.
 */
export async function sendMessage(
  fromUserEmail: string,
  opts: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    threadId?: string;
    attachments?: EmailAttachment[];
  },
): Promise<{ messageId: string; threadId: string }> {
  const gmail = getGmailClientFor(fromUserEmail);

  const raw = buildMimeMessage(fromUserEmail, opts);
  const encoded = base64UrlEncode(raw);

  const sendRes = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encoded,
      threadId: opts.threadId,
    },
  });
  return {
    messageId: sendRes.data.id ?? '',
    threadId: sendRes.data.threadId ?? '',
  };
}

/**
 * Create a draft (NOT send). Lands in the mailbox's Drafts folder, ready for
 * the operator to review on phone or web Gmail and hit send manually. This is
 * the "safer" alternative to sendMessage() — agents can prepare external mail
 * for review without it going out the door.
 */
export async function createDraft(
  fromUserEmail: string,
  opts: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    threadId?: string;
    attachments?: EmailAttachment[];
  },
): Promise<{ draftId: string; messageId: string }> {
  const gmail = getGmailClientFor(fromUserEmail);

  const raw = buildMimeMessage(fromUserEmail, opts);
  const encoded = base64UrlEncode(raw);

  const draftRes = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encoded,
        threadId: opts.threadId,
      },
    },
  });
  return {
    draftId: draftRes.data.id ?? '',
    messageId: draftRes.data.message?.id ?? '',
  };
}

// ─────────────────────────────────────────────────────────────
// MIME construction — proper UTF-8 handling so em-dashes, accents,
// Arabic, emoji, etc. survive the round trip.
// ─────────────────────────────────────────────────────────────

/**
 * Build a complete RFC-2822 message with proper encoding for non-ASCII content.
 *
 * Two paths:
 *   - No attachments → single text/plain part with base64 transfer encoding
 *   - With attachments → multipart/mixed; first part is the body, then one
 *     part per attachment with proper Content-Disposition + base64 encoding
 *
 * Subject line uses MIME encoded-word (RFC 2047) so non-ASCII survives.
 */
function buildMimeMessage(
  fromUserEmail: string,
  opts: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: EmailAttachment[];
  },
): string {
  const baseHeaders = [
    `From: ${fromUserEmail}`,
    `To: ${opts.to}`,
  ];
  if (opts.cc) baseHeaders.push(`Cc: ${opts.cc}`);
  if (opts.bcc) baseHeaders.push(`Bcc: ${opts.bcc}`);
  baseHeaders.push(`Subject: ${encodeMimeWord(opts.subject)}`);
  baseHeaders.push('MIME-Version: 1.0');

  const hasAttachments = opts.attachments && opts.attachments.length > 0;

  // ─── No attachments: single-part text/plain ──────────────────────
  if (!hasAttachments) {
    baseHeaders.push('Content-Type: text/plain; charset=UTF-8');
    baseHeaders.push('Content-Transfer-Encoding: base64');
    const bodyB64 = Buffer.from(opts.body, 'utf-8').toString('base64').replace(/(.{76})/g, '$1\r\n');
    return `${baseHeaders.join('\r\n')}\r\n\r\n${bodyB64}`;
  }

  // ─── Multipart/mixed with attachments ────────────────────────────
  const boundary = `safa_mime_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  baseHeaders.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts: string[] = [];

  // Part 1: the body
  const bodyB64 = Buffer.from(opts.body, 'utf-8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  parts.push(
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      bodyB64,
    ].join('\r\n'),
  );

  // Parts 2..N: each attachment
  for (const att of opts.attachments!) {
    const attB64 = att.content.toString('base64').replace(/(.{76})/g, '$1\r\n');
    const safeFilename = encodeMimeWord(att.filename);
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${safeFilename}"`,
        `Content-Disposition: attachment; filename="${safeFilename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        attB64,
      ].join('\r\n'),
    );
  }

  parts.push(`--${boundary}--`);

  return `${baseHeaders.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

/**
 * RFC 2047 MIME encoded-word for header values. Returns the input unchanged
 * if it's pure ASCII; otherwise wraps in =?UTF-8?B?<base64>?= so mail clients
 * decode it correctly. Without this, em-dashes / accents render as mojibake.
 */
function encodeMimeWord(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  const b64 = Buffer.from(s, 'utf-8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

function base64UrlEncode(s: string): string {
  return Buffer.from(s)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Recursively walk message parts and extract the first text/plain body, decoded. */
function extractPlainTextBody(part: gmail_v1.Schema$MessagePart | undefined | null): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const sub of part.parts) {
      const found = extractPlainTextBody(sub);
      if (found) return found;
    }
  }
  // Fallback: try the part's body directly (sometimes a single-part email)
  if (part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  return '';
}

function decodeBase64Url(s: string): string {
  // Gmail uses URL-safe base64; convert to standard then decode
  const normalised = s.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalised, 'base64').toString('utf-8');
}
