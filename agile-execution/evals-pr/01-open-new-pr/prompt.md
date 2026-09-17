---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
Open the PR for APP-204. `implement-code` has already pushed branch `app-204-reorder-rules`.

Repo context: `inventory-service`, base branch `main`, ticket `APP-204`. There is no shell in this sandbox, so this phase cannot actually complete: you cannot run `gh` and cannot open or edit a PR. What those commands would return is inlined below.

Produce the phase's output as a draft instead: the exact PR title and body you would publish, which `gh` command you would run (`pr create` or `pr edit`, and against which PR number) and why, and the exact marker text you would post. Do NOT post a resume marker to Jira — the phase is not complete, and a posted marker would make the next run skip it.

`gh pr list --state open --head app-204-reorder-rules --json number,url` →
```json
[]
```

`git diff main...HEAD --stat` →
```
 migrations/0012_reorder_rules.py  | 24 ++++++++++
 inventory/services/reorder.py     | 45 +++++++++++++++++
 tests/test_reorder_rules.py       | 44 +++++++++++++++++
 3 files changed, 113 insertions(+)
```

## `🤖 agile:phase=plan` comment on APP-204

Files, in order: `migrations/0012_reorder_rules.py`, `inventory/services/reorder.py`, `tests/test_reorder_rules.py`.
AC→test map:
- AC1 (rule persisted and listed) → `test_create_rule_persists_and_is_listed`
- AC2 (threshold ≤ 0 refused, nothing written) → `test_zero_threshold_is_refused_and_writes_nothing`
- AC3 (other planner's rule not listed) → `test_list_is_scoped_to_the_calling_planner`
- AC4 (bounded queries on a large list) → `test_pagination_returns_one_page_at_a_time`
Flagged decisions: sort by `id` for a stable page boundary — the ADR is silent on ordering.

## `🤖 agile:phase=implement` comment on APP-204

Mode: `sequential`. Gate receipt: lint clean, 5 unit tests pass, integration pass, fresh-DB migration applied cleanly. No deviations from the plan.

## Story APP-204 — Reorder rules per SKU

As a warehouse planner, I want reorder rules stored against a SKU so that the sweep orders at the levels I choose. DoD: unit tests per AC, migration in the same PR, no new lint errors. Per ADR §4.2 writes go through the service layer.
