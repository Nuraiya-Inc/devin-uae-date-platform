/**
 * Agent → Workspace mailbox map.
 *
 * Each C-suite + MD agent has a real Google Workspace mailbox they own.
 * The platform impersonates these mailboxes via the service account + domain-
 * wide delegation (see lib/gmail.ts). Tier-2 functional agents don't have
 * mailboxes — they route through their branch head's mailbox or stay silent.
 *
 * To add a mailbox for a new agent:
 *   1. Create the Workspace user (admin.google.com)
 *   2. Add a row below
 *   3. No code change needed elsewhere — `gmail_*` tools resolve via this map
 */

export const AGENT_EMAILS: Record<string, string> = {
  'md-00':  'layla@safabioworks.com',     // Layla Mansour — MD
  'cfo-00': 'john@safabioworks.com',      // John Albright — CFO
  'cto-00': 'marcus@safabioworks.com',    // Marcus Chen — CTO
  'cco-00': 'priya@safabioworks.com',     // Priya Khatri — CCO
  'cmo-00': 'ashley@safabioworks.com',    // Ashley Morgan — CMO
  'coo-00': 'omar@safabioworks.com',      // Omar Al-Rashid — COO
};

/** Returns the mailbox for an agent slug, or null if that agent has no mailbox. */
export function getAgentEmail(slug: string): string | null {
  return AGENT_EMAILS[slug] ?? null;
}

/** True if this agent has its own Workspace mailbox. */
export function agentHasMailbox(slug: string): boolean {
  return slug in AGENT_EMAILS;
}
