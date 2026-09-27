---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Run the merge train. PR #724 for APP-512 is the one in focus.

Repo `inventory-service`, base `main`.

There is no shell, no `gh`, and no Atlassian MCP here — do not call them and do not dispatch any agent. Every command output you would have fetched is inlined. State your decision and exactly what you do next.

## `pr-reviewer` verdict on PR #724

CHANGES REQUESTED. Reviewed sha `bb90e41`. Files-read equals the diff set.

> The PR implements a per-SKU reorder threshold, but APP-512's ACs specify a per-SKU **per-location** threshold: AC2 and AC4 both turn on the location dimension, and neither is implemented or testable against this data model — `reorder_rules` has no `location_id` and the sweep does not group by location. AC1 is satisfied. AC3 is partially satisfied. Making this correct means a new column, a migration, a reworked sweep query, and rewriting four of the six tests. The approach is wrong rather than incomplete.

`fix-until-satisfied` has not been dispatched. Decide what happens to this PR and to APP-512.
