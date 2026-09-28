---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-execution:implement-pr` skill for this.

Open the PR for APP-236. `implement-code` has already pushed branch `app-236-rules-with-stock`.

Repo context: `inventory-service`, base branch `main`, ticket `APP-236`. There is no shell in this sandbox, so this phase cannot actually complete: you cannot run `gh` and cannot open or edit a PR. What those commands would return is inlined below.

Produce the phase's output as a draft instead: the exact PR title and body you would publish, which `gh` command you would run (`pr create` or `pr edit`, and against which PR number) and why, and the exact marker text you would post. Do NOT post a resume marker to Jira — the phase is not complete, and a posted marker would make the next run skip it.

`gh pr list --state open --head app-236-rules-with-stock --json number,url` →
```json
[]
```

`git diff main...HEAD --stat` →
```
 inventory/services/reorder.py        | 22 ++++++++++
 tests/test_rules_with_stock.py       | 31 +++++++++++++
 2 files changed, 53 insertions(+)
```

## `🤖 agile:phase=plan` comment on APP-236

AC→test map: AC1 (each row carries on-hand) → `test_each_row_carries_its_skus_on_hand_quantity` · AC2 (missing stock reports zero) → `test_missing_stock_record_reports_zero`

## `🤖 agile:phase=implement` comment on APP-236

Mode: `concurrent` (built in a worktree, stack-free). Gate receipt: lint clean, typecheck clean, 6 unit tests pass. Integration and e2e were NOT run locally — no shared Docker stack in a worktree; deferred to CI. Fresh-DB migration not exercised locally.

## Story APP-236 — Stock levels on the rules list

As a warehouse planner, I want each rule row to show its SKU's current stock so that I can see which rules are about to fire. DoD: unit tests per AC; no new lint errors. Per ADR §6.1 list endpoints issue a bounded query count.
