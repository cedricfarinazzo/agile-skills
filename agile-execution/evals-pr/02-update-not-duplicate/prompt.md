---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-execution:implement-pr` skill for this.

Open or update the PR for APP-204. `implement-code` has just pushed a fix commit to branch `app-204-reorder-rules`.

Repo context: `inventory-service`, base branch `main`, ticket `APP-204`. There is no shell in this sandbox, so this phase cannot actually complete: you cannot run `gh` and cannot open or edit a PR. What those commands would return is inlined below.

Produce the phase's output as a draft instead: the exact PR title and body you would publish, which `gh` command you would run (`pr create` or `pr edit`, and against which PR number) and why, and the exact marker text you would post. Do NOT post a resume marker to Jira — the phase is not complete, and a posted marker would make the next run skip it.

`gh pr list --state open --head app-204-reorder-rules --json number,url` →
```json
[{"number": 418, "url": "https://github.com/acme/inventory-service/pull/418"}]
```

`gh pr view 418 --json body,title` →
```json
{"title": "[APP-204] Reorder rules per SKU", "body": "## Story\nAPP-204\n\n## AC coverage\nAC1 → test_create_rule_persists_and_is_listed\nAC2 → test_zero_threshold_is_refused_and_writes_nothing\n\n## Test tiers\nVerified locally: lint + unit + integration + fresh-DB migration."}
```

`git diff main...HEAD --stat` →
```
 migrations/0012_reorder_rules.py  | 24 ++++++++++
 inventory/services/reorder.py     | 51 ++++++++++++++++++++
 tests/test_reorder_rules.py       | 60 ++++++++++++++++++++++++
 3 files changed, 135 insertions(+)
```

## `🤖 agile:phase=plan` comment on APP-204

AC→test map: AC1 → `test_create_rule_persists_and_is_listed` · AC2 → `test_zero_threshold_is_refused_and_writes_nothing` · AC3 → `test_list_is_scoped_to_the_calling_planner` · AC4 → `test_pagination_returns_one_page_at_a_time`

## `🤖 agile:phase=implement` comment on APP-204

Mode: `sequential`. Fix pass: added AC3 and AC4 coverage after the self-review found them missing. Gate receipt: lint clean, 9 unit tests pass, integration pass, fresh-DB migration clean.

## `🤖 agile:phase=pr` comment already on APP-204

pr — agile-10-implement — 2026-09-15 · opened https://github.com/acme/inventory-service/pull/418
