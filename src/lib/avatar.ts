/**
 * Avatar helpers — clean monogram initials with deterministic brand colours.
 *
 * No external service. No cartoons. The avatar is computed entirely from the
 * name + a small palette of in-brand colours, chosen deterministically by
 * hashing the seed string. Each name → consistent (initials, colour) pair.
 *
 * Override path: if a user has `avatarUrl` set in the DB, we expose it via
 * `userAvatarUrl()` — the rendering layer can use it as an <img> instead of
 * the initials. Future: same `Agent.avatarUrl` for custom portraits.
 */

/** Curated brand-aligned background colours. Each is paired with white text. */
const PALETTE = [
  '#004923', // brand deep green (primary)
  '#006950', // brand mid green
  '#2C8255', // lighter green
  '#005338', // dark brand
  '#6E710F', // olive/lime-dark
  '#7A5C0B', // amber-dark
];

/** Get up to 2 initials from a name. Strips chunks after " — " (we use that for titles). */
export function initialsFor(name: string): string {
  if (!name) return '?';
  // Split off the role suffix if present ("Layla Mansour — Managing Director" → "Layla Mansour")
  const cleanName = name.split('—')[0].trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic colour from name — same name always gets same colour. */
export function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Returns a {initials, color} pair for an agent. */
export function agentAvatar(name: string): { initials: string; color: string } {
  return { initials: initialsFor(name), color: colorFor(name) };
}

/** Returns the user's custom avatarUrl if set; otherwise null (caller renders initials).
 *  Accepts either an absolute http(s) URL or a local path served from public/
 *  (e.g. "/team/nima-vakili.jpg"). Local paths must start with "/". */
export function userAvatarUrl(user: { avatarUrl?: string | null }): string | null {
  if (!user.avatarUrl) return null;
  if (user.avatarUrl.startsWith('http')) return user.avatarUrl;
  if (user.avatarUrl.startsWith('/')) return user.avatarUrl;
  return null;
}

/** Returns {initials, color} for a user. */
export function userAvatar(user: { name: string; email: string }): { initials: string; color: string } {
  // Seed on name + email so two "Sara"s get different colours
  const seed = `${user.name} ${user.email}`;
  return { initials: initialsFor(user.name), color: colorFor(seed) };
}
