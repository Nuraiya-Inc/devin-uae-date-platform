import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic client — lazy singleton with retry / backoff.
 *
 * Two improvements over the reference architecture:
 *  - explicit retry on 5xx / overloaded_error (not yet wired here — see
 *    callAnthropicWithFallback below for the wrapper to use in the chat route)
 *  - 75s timeout + 2 SDK-level retries for transient network blips
 */

if (!process.env.ANTHROPIC_API_KEY && process.env.NODE_ENV !== 'test') {
  // Don't throw at import — that breaks `prisma generate` during build.
  // Throw at first use instead (see getAnthropicClient).
  console.warn('[anthropic] ANTHROPIC_API_KEY is not set; chat will fail at request time.');
}

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in Coolify env vars.');
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Opus replies with high max_tokens (8192) + multi-round tool use can
      // exceed 75s on complex requests (Ashley building a fully-branded
      // social-media calendar with grid mock-up — image input, dense
      // structured output). 150s gives meaningful headroom.
      //
      // We set SDK maxRetries: 0 because callAnthropicWithFallback already
      // implements exponential-backoff retries with Opus→Sonnet fallback.
      // Double-retrying (SDK + wrapper) was making hung calls last 7+ min
      // and ultimately failing past the route's 270s maxDuration anyway.
      timeout: 150_000,
      maxRetries: 0,
    });
  }
  return client;
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

/**
 * Fallback chain when the desired model is overloaded:
 *   Fable 5 → Opus 4.8 → Sonnet 4.6
 *
 * Fable 5 is the agent default since 2026-06-09 (Mythos-class, strongest
 * finance-first model, 1M context). Opus 4.8 is the documented Fable
 * safety-route target. Sonnet 4.6 is the final fallback if both higher
 * tiers are overloaded.
 */
export const FABLE_FALLBACK_MODEL = 'claude-opus-4-8';
export const OPUS_FALLBACK_MODEL = 'claude-sonnet-4-6';

/** Returns the next model in the fallback chain, or null if already at the bottom. */
function nextFallbackModel(current: string): string | null {
  if (current.includes('fable')) return FABLE_FALLBACK_MODEL;
  if (current.includes('opus'))  return OPUS_FALLBACK_MODEL;
  return null;
}

/**
 * Retry wrapper that handles transient Anthropic failures:
 *  - 5xx / overloaded_error / api_error → exponential backoff
 *  - Falls back from Opus to Sonnet on `overloaded_error` after 2 retries
 *
 * Use this in the chat route + agent runner instead of calling
 * client.messages.create directly.
 */
export async function callAnthropicWithFallback<T>(
  fn: (model: string) => Promise<T>,
  desiredModel: string,
  options?: { maxRetries?: number; baseDelayMs?: number },
): Promise<{ result: T; modelUsed: string; attempts: number }> {
  // 2 attempts = worst case 2 × 150s = 300s. We accept slightly over the
  // route's 270s maxDuration because the second attempt typically hits a
  // fast failure (overloaded_error) within seconds rather than another
  // full timeout.
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelay = options?.baseDelayMs ?? 800;

  let lastErr: unknown;
  let attempts = 0;
  let modelUsed = desiredModel;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    attempts++;
    try {
      const result = await fn(modelUsed);
      return { result, modelUsed, attempts };
    } catch (err: unknown) {
      lastErr = err;
      const e = err as { status?: number; error?: { type?: string } };

      const status = e?.status;
      const errType = e?.error?.type;

      const isTransient =
        (typeof status === 'number' && status >= 500 && status < 600) ||
        errType === 'overloaded_error' ||
        errType === 'api_error';

      if (!isTransient) throw err;

      // After 2 attempts on overloaded_error, step down the fallback chain.
      // Fable 5 → Opus 4.8 → Sonnet 4.6.
      if (errType === 'overloaded_error' && attempt >= 1) {
        const next = nextFallbackModel(modelUsed);
        if (next) {
          console.warn(`[anthropic] ${modelUsed} overloaded, falling back to ${next}`);
          modelUsed = next;
          continue;
        }
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}
