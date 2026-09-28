---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-merge-review:agile-11-merge-train` skill for this.

Run the merge train. PR #731 for APP-518 is the one in focus.

Repo `inventory-service`, base `main`.

There is no shell, no `gh`, and no Atlassian MCP here — do not call them and do not dispatch any agent. Every command output you would have fetched is inlined. State your decision and exactly what you do next.

## `gh pr diff 731 --name-only`
```
inventory/services/sweep.py
inventory/services/reorder.py
inventory/models/rule.py
migrations/0021_rule_location.py
tests/test_sweep.py
tests/test_reorder.py
qa/integration/test_sweep_flow.py
```

## Receipt returned by `agile-merge-review:pr-reviewer`

```
verdict: APPROVED
reviewed sha: 4e19bb2
Files read in full: inventory/services/sweep.py (212) · inventory/services/reorder.py (88) · tests/test_sweep.py (140)
Lenses:
  correctness — sweep.py:117 grouping key now includes location_id
  security ...— N/A because no new endpoint or input
  naming .....— reorder.py:44 follows the domain vocabulary
  tests ......— test_sweep.py:61 covers the grouped path
  docs .......— N/A
  invariants .— sweep.py:117 matches ADR 4.2
AC binding: AC1 → sweep.py:117 · AC2 → covered · AC3 → sweep.py:131
```

CI is green on `4e19bb2` (run id `18450771204`, conclusion `success`), and `4e19bb2` is the branch tip. Decide whether to advance this PR toward merge.
