/**
 * Agent photo registry — slug → public image path.
 *
 * To add a headshot for an agent:
 *   1. Drop the image into `/public/team/` (jpg or png, ~400x400, square-cropped works best)
 *   2. Add a line below mapping the agent slug to the path
 *   3. The Avatar component will pick it up automatically — no DB change needed
 *
 * If an agent's slug isn't in this map, the UI falls back to the deterministic
 * brand-coloured monogram initials (see `lib/avatar.ts`).
 */

export const AGENT_PHOTOS: Record<string, string> = {
  // Orchestrator
  'md-00':  '/team/layla-mansour.png',     // Layla Mansour — Managing Director
  // C-suite (Tier 1)
  'cfo-00': '/team/John-Albright.jpg',     // John Albright — CFO
  'cto-00': '/team/Marcus-Chen.jpg',       // Marcus Chen — CTO
  'cco-00': '/team/Priya-Khatri.jpg',      // Priya Khatri — CCO
  'cmo-00': '/team/Ashley-Morgan.jpg',     // Ashley Morgan — CMO
  'coo-00': '/team/Omar-Al-Rashid.jpg',    // Omar Al-Rashid — COO
};

/** Returns the image path for an agent slug, or null if no photo is registered. */
export function getAgentPhotoUrl(slug: string): string | null {
  return AGENT_PHOTOS[slug] ?? null;
}
