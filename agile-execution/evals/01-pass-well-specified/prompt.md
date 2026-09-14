---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-204 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-204 — Story — Reorder rules per SKU**
Status: To Do · Labels: `backend`, `repo:inventory-service` · Components: inventory-api
Links: blocks APP-251, APP-253. No "is blocked by" links.

**Description**

As a warehouse planner, I want to define reorder rules on a SKU so that the system reorders stock at the levels I choose.

**Acceptance criteria**

- AC1 — Given a SKU with no rule, when the planner submits `{threshold: 20, reorderQty: 100}`, then a rule row is created and `myReorderRules` returns it.
- AC2 — Given planner A's rule, when planner B queries `myReorderRules` or mutates that rule id, then B sees nothing and the mutation is refused with a typed `Forbidden` error.
- AC3 — Given a SKU with a rule, when the 15-minute sweep computes its candidate set, then that SKU appears exactly once (integration assertion on `get_skus_to_sweep`).
- AC4 — Given `threshold` ≤ 0, when the rule is submitted, then it is refused with a typed `ValidationError` and no row is written.
- AC5 — Given an existing rule, when the planner updates `reorderQty`, then the row is updated in place and `updated_at` advances.
- AC6 — Given a deleted SKU, when the sweep runs, then its rules are excluded and no reorder is emitted.

**Definition of Done**
- Unit tests for all six ACs
- Migration + head-pin bump in the same PR
- Integration value-flow assertions through the real resolvers and the real sweep union
- No new lint or type errors
- Rollback note in the PR body

**Technical notes**
Per ADR §4.2 (Iteration 2, D19/D20): rules live in `inventory.reorder_rules`, owner-scoped by `planner_id`, enum `rule_state ∈ {active, paused}`. Resolver names and table shape are fixed at refinement. Specs UI: none — backend-only Story; any UI is out of scope (tracked separately).
