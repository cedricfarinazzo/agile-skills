---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-execution:implement-monitor` skill for this.

Monitor PR #612 for APP-401 and rework it.

Repo `inventory-service`, branch `feature/APP-401-audit-log`, base `main`.

There is no shell, no `gh`, and no Atlassian MCP here — do not call them. Every command output you would have fetched is inlined. Say what you conclude and exactly what you would do next.

## `gh pr view 612 --json statusCheckRollup,mergeStateStatus`
```json
{"mergeStateStatus": "CLEAN",
 "statusCheckRollup": [{"name": "lint", "conclusion": "SUCCESS"},
                       {"name": "unit", "conclusion": "SUCCESS"},
                       {"name": "integration", "conclusion": "FAILURE"}]}
```

## Full `integration` job log, failing section
```
FAILED qa/integration/test_supplier_sync.py::test_sync_marks_stale_rows
  assert 0 == 2
   +  where 0 = len([])
qa/integration/test_supplier_sync.py:88: AssertionError
1 failed, 214 passed in 331.62s
```

## `git diff main...HEAD --name-only`
```
inventory/models/adjustment.py
inventory/services/audit.py
migrations/0018_audit_log.py
tests/test_audit_log.py
```

`qa/integration/test_supplier_sync.py` is not in the diff, and neither is anything under `qa/`. No review comments. No prior `rework` marker.
