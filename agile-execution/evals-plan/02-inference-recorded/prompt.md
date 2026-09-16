---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-218. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-218 — Recent adjustments list

As a warehouse planner, I want a list of recent stock adjustments for a SKU so that I can see what changed before I act.

- **AC1** — Given a SKU with adjustments, when the list is requested, then it returns that SKU's adjustments.
- **AC2** — Given a SKU with no adjustments, when the list is requested, then it returns an empty list rather than raising.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** the list is read-only and backed by `inventory.stock_adjustments`.

## ADR extract §4.2 / §6.1 — Inventory data and list endpoints

Rules and adjustments live under the `inventory` schema. Writes go through the service layer. List functions are paginated with a bounded default (50) and a hard cap (200). Service functions return plain values, never live ORM instances.

The ADR does not specify a sort order for adjustment lists, nor whether adjustments from deleted SKUs remain visible.
