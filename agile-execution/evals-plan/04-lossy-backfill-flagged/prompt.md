---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-255. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-255 — Split the supplier contact field

As a data steward, I want supplier contacts split into name and email columns so that we can mail suppliers without parsing a free-text field.

- **AC1** — Given a supplier row, when the migration runs, then `contact_name` and `contact_email` are populated from the existing `contact` field.
- **AC2** — Given a supplier created after the migration, when it is written, then the two new columns are set and the old field is not used.
- **AC3** — Given the supplier list, when it is rendered, then it reads from the two new columns.

**DoD:** unit tests for every AC; migration + head-pin bump in the same PR; no new lint errors.
**Technical notes:** `inventory.suppliers.contact` is a free-text column holding roughly 4,000 rows in production, in no consistent format — some are `Name <email>`, some are bare emails, some are phone numbers, and about 12% are empty. The ticket does not say what to do with rows that cannot be parsed, nor whether the old column is dropped in this migration.

## ADR extract §5.4 / §8.1 — Data and migrations

Migrations must be backward-compatible for a rolling deploy: a column still read by the running version is not dropped in the same release that stops writing it. The ADR specifies no policy for lossy backfills, and records no decision about the `suppliers.contact` column.
