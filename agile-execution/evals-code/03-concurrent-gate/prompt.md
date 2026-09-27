---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Build APP-442 from its plan. Mode: `concurrent` — you are in the ticket's worktree at `.claude/worktrees/APP-442`, on branch `feature/APP-442-supplier-sync`, alongside two sibling tickets building in their own worktrees. The project has a single shared Docker Compose stack. CI runs integration and e2e on pull requests.

There is no shell and no Atlassian MCP here — do not call them. Every command output you would have run is inlined. State your gate decision, the exact marker you would post, and what you hand back to the orchestrator.

## `🤖 agile:phase=plan` comment on APP-442
Files: `inventory/services/supplier_sync.py`, `tests/test_supplier_sync.py`, `qa/integration/test_supplier_sync_flow.py`.
AC→test map: AC1 (sync marks stale rows) → `test_sync_marks_stale_rows` (unit) · AC2 (a full sync round-trips through the API) → `test_supplier_sync_flow` (integration)

## What the build already did
```
$ <lint cmd>       → exit 0
$ <typecheck cmd>  → exit 0
$ <unit cmd>       → exit 0   (14 passed)
```
Both AC tests are written. Decide which gates apply, run nothing you should not, and write the marker.
