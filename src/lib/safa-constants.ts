/**
 * UPN constants shim.
 *
 * Historical filename kept so the inherited runtime's imports keep working
 * (chat route, agent-run, responders). The real source of truth is the
 * UPN fact graph in `@/facts`.
 *
 * TODO(rename): move importers to `@/lib/upn-constants` once the runtime
 * stabilizes, then delete this file.
 */

import { UPN_FACTS, buildCachedFactsPrefix } from '@/facts';

export const PLATFORM = {
  nameEn: UPN_FACTS.identity.platformNameEn,
  nameAr: UPN_FACTS.identity.platformNameAr,
  authority: UPN_FACTS.identity.authority,
  brand: UPN_FACTS.brand,
} as const;

export const HARD_RULES_MD = UPN_FACTS.hardRules
  .map((r) => `[${r.id} · ${r.severity}] ${r.rule}`)
  .join('\n');

/** Cached prefix — network hard rules + taxonomy + baseline, prepended to every agent prompt. */
export function buildCachedPrefix(): string {
  return buildCachedFactsPrefix();
}
