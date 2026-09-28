---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `deep-refactor:deep-refactor` skill for this.

Deep refactor audit of `inventory-service` — write the opening of the audit report.

No shell, `gh`, Jira or Confluence here — do not call them or dispatch agents. The repository is not checked out; do not search the working tree. Everything you need is inlined. State what you do and exactly what you would write.

Scanner and reading notes:
- 14 duplicated helper blocks (4–12 lines each) across `inventory/`.
- `inventory/services/reorder.py` is 1,900 lines with 41 functions.
- `inventory/services/reorder.py` imports `supplier_service.internal.db` and `supplier_service.internal.models` directly, and `supplier_service/internal/sync.py` imports `inventory.services.reorder._compute_qty` — the two services reach into each other's private modules both ways.
- `CLAUDE.md` states: "Services communicate only through the task bus."
