---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-204. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-204 — Reorder rules per SKU

As a warehouse planner, I want to define reorder rules on a SKU so that the sweep orders stock at the levels I choose.

- **AC1** — Given a SKU with no rule, when the planner creates one with `threshold=20, reorder_qty=100`, then the rule is persisted and returned by `list_rules`.
- **AC2** — Given `threshold` ≤ 0, when a rule is created, then it is refused with `ValidationError` and no row is written.
- **AC3** — Given a rule owned by another planner, when it is read or updated, then it is refused with `Forbidden` and the row is unchanged.
- **AC4** — Given a planner with 500 rules, when the list is requested, then it returns one page and issues a bounded number of queries independent of page size.

**DoD:** unit tests for every AC; integration assertion through the real service; migration + head-pin bump in the same PR; no new lint errors.

## ADR extract §4.2 — Inventory data and service layer

Rules live in `inventory.reorder_rules`, owner-scoped by `planner_id`. Writes go through the service layer; handlers never touch a session. List functions are paginated with a bounded default (50) and a hard cap (200). Service functions return plain values, never live ORM instances. Every new table ships with its migration and an index backing its primary predicate.
