/**
 * Agent specification — the canonical "job description" for an AI agent
 * in the UAE Palm Network platform.
 *
 * These specs are the source of truth that gets seeded into the database
 * via prisma/seed.ts. Editing the spec here and re-running `npm run db:seed`
 * refreshes the agent (idempotent).
 *
 * Tier 0 = Orchestrator (MD)
 * Tier 1 = Executive branch heads (CFO / CTO / CCO / CMO / COO)
 * Tier 2 = Functional specialists (FIN-01, TECH-04, etc.)
 */

export type AgentTier = 'ORCHESTRATOR' | 'EXECUTIVE' | 'FUNCTIONAL';

export type AgentBranch =
  | 'EXECUTIVE'
  | 'FINANCE'
  | 'TECHNOLOGY'
  | 'COMMERCIAL'
  | 'MARKETING'
  | 'OPERATIONS';

export interface AgentSpec {
  /** URL-friendly id — used in routes and DB primary lookup. From the registry: "md-00", "fin-01" etc. */
  slug: string;
  /** Display name — "Managing Director", "Fundraising & Capital Strategy" */
  name: string;
  /** Short title shown in cards / chips */
  title: string;
  tier: AgentTier;
  branch: AgentBranch;
  /** Slug of the agent this one reports to. Null for the MD. */
  reportsToSlug: string | null;
  /** One-sentence mandate */
  mission: string;
  /** Markdown — decision rights vs approval-required */
  decisionRights: string;
  /** Markdown — day-to-day workstream */
  responsibilities: string;
  /** Markdown — numeric, dated KPIs */
  kpis: string;
  /** Markdown — tool / MCP inventory the agent has access to */
  tools: string;
  /** Verbatim system prompt fed to the Anthropic API */
  systemPrompt: string;
  /** Optional override for the daily-cron brief (Phase 2 feature) */
  dailyRunBrief?: string;
  /** Anthropic model id */
  model?: string;
  /** Sampling temperature — lower for finance/legal, higher for marketing/creative */
  temperature?: number;
  /** Deployment phase (1 = ship now, 2 = post-Series A, 3 = scale-up) */
  deployPhase: 1 | 2 | 3;
}
