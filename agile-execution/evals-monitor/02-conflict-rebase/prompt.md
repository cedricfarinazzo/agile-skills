---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Monitor PR #631 for APP-418 and rework it.

Repo `inventory-service`, branch `feature/APP-418-reorder-audit`, base `main`. This run is `concurrency=3`, so the ticket's code lives in its own worktree at `.claude/worktrees/APP-418`, and the shared checkout has `main` checked out.

There is no shell, no `gh`, and no Atlassian MCP here — do not call them. Every command output you would have fetched is inlined. Say what you conclude and exactly what you would do next.

## `gh pr view 631 --json statusCheckRollup,mergeStateStatus`
```json
{"mergeStateStatus": "DIRTY",
 "statusCheckRollup": [{"name": "lint", "conclusion": "SUCCESS"},
                       {"name": "unit", "conclusion": "SUCCESS"}]}
```

`origin/main` has moved on by 9 commits since the branch was cut; `inventory/services/audit.py` was edited on both sides.

No review comments. No prior `rework` marker.

Give the exact git command sequence you would run, in order, and say where you would run it.
