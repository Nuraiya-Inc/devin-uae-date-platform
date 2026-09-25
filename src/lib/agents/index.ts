/**
 * Agent registry — single source of truth for the UAE Palm Network
 * agent team (v0 roster, 7 agents).
 *
 *   ABD-00  Abdullah — Agentic Director (partner-facing orchestrator)
 *   ├─ INT-01  Intake & Polishing
 *   ├─ VAL-01  Validation
 *   ├─ ANA-01  Analytics
 *   ├─ CER-01  Certification & Tiers
 *   ├─ ENG-01  Engagement
 *   └─ REG-01  Registry
 *
 * Partners only ever meet Abdullah. The backend six are consulted via
 * consult_agent and surfaced through his voice.
 */

import type { AgentSpec } from './types';

import { abd00 } from './abd-00';
import { int01 } from './int-01';
import { val01 } from './val-01';
import { ana01 } from './ana-01';
import { cer01 } from './cer-01';
import { eng01 } from './eng-01';
import { reg01 } from './reg-01';

export const AGENT_SPECS: AgentSpec[] = [abd00, int01, val01, ana01, cer01, eng01, reg01];

export const AGENT_BY_SLUG: Record<string, AgentSpec> = Object.fromEntries(
  AGENT_SPECS.map((a) => [a.slug, a]),
);

export type { AgentSpec } from './types';
