---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Open the PR for APP-231. `implement-code` has already pushed branch `app-231-pause-rules`.

Repo context: `inventory-service`, base branch `main`, ticket `APP-231`. There is no shell in this sandbox, so this phase cannot actually complete: you cannot run `gh` and cannot open or edit a PR. What those commands would return is inlined below.

Produce the phase's output as a draft instead: the exact PR title and body you would publish, which `gh` command you would run (`pr create` or `pr edit`, and against which PR number) and why, and the exact marker text you would post. Do NOT post a resume marker to Jira — the phase is not complete, and a posted marker would make the next run skip it.

`gh pr list --state open --head app-231-pause-rules --json number,url` →
```json
[]
```

`git diff main...HEAD --stat` →
```
 inventory/services/reorder.py     | 18 ++++++++
 inventory/services/sweep.py       | 26 ++++++++++++
 tests/test_rule_state.py          | 17 +++++++
 3 files changed, 61 insertions(+)
```

## `🤖 agile:phase=plan` comment on APP-231

Files, in order: `migrations/0015_rule_state.py`, `inventory/services/reorder.py`, `tests/test_rule_state.py`.
AC→test map: AC1 (pause sets state and drops it from the sweep) → `test_pausing_sets_state_and_removes_it_from_the_sweep` · AC2 (resume restores it) → `test_resuming_restores_it_to_the_sweep`
Flagged decisions: none.

## `🤖 agile:phase=implement` comment on APP-231

Mode: `sequential`. Gate receipt: lint clean, 1 unit test passes, integration pass.

## Story APP-231 — Pause and resume a reorder rule

As a warehouse planner, I want to pause a reorder rule so that a supplier outage stops triggering orders. DoD: unit tests for both ACs; no new lint errors.
