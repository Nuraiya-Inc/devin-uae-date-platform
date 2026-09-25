---
description: "UAE Palm Network standing rules (UPN governance invariants)"
trigger: always_on
---

# Standing rules — non-negotiable across every task

- **UPN-2 (draft, not authority):** agents may only *create* an `ApprovalRequest`; tier/certification/registry/publication changes are applied by a human via a separate route. Never let an agent apply one directly.
- **UPN-3 (confidentiality + aggregation floor):** never expose one partner's figures to another; every aggregate requires ≥ 3 partners (`MIN_AGGREGATE = 3`), enforced in code, not just prompts.
- **UPN-7 (baseline honesty):** only Abu Dhabi's sector baseline is surveyed; all other emirates are **indicative** placeholders. Never render indicative data as measured.
- **ESG honesty:** all carbon/ESG figures are **indicative estimates** from a stated factor, never audited.
- **UPN-1 (neutrality):** the platform is neutral infrastructure. Do not favor the technology/operating partner in shared/public surfaces. (`safaRelevance` and directory contact blocks are staff-only.)
- **Arabic-first** partner communications; Latin numerals in both languages.
- **Authority lives in the tool layer, not the prompt.** Agents affect the world only through tool executors that enforce identity, approval, and aggregation.
