---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-262. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-262 — Supplier summary endpoint

As a warehouse planner, I want a compact supplier summary so that the picker list loads quickly.

- **AC1** — Given a supplier, when the summary is requested, then it returns exactly three fields: `id`, `name`, and `lead_time_days`.
- **AC2** — Given a supplier with no recorded lead time, when the summary is requested, then `lead_time_days` is null and the call still succeeds.
- **AC3** — Given 200 suppliers, when the summary list is requested, then the response contains only those three fields per row and nothing else.

**DoD:** unit tests for every AC; no new lint errors.

## ADR extract §6.4 — Resource representations

Every supplier-facing resource representation carries the standard envelope: `id`, `name`, `status`, `created_at`, `updated_at`, plus the resource's own fields. Existing endpoints (`GET /suppliers`, `GET /suppliers/{id}`) all return this envelope, and the `SupplierOut` schema in `inventory/schemas/supplier.py` defines it.
