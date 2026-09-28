---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-execution:agile-10-implement` skill for this.

Implement the sprint.

Repo context: `inventory-service`, project key `APP`. Config: `todo-status-name: To Do`, `in-review-status-name: In Review`.

There is no shell, no `gh`, and no Atlassian MCP in this sandbox — do not attempt to call them, and do not dispatch any agent. What the Jira queries would return is inlined below. Produce **Phase 0 only**: which board you selected and why, the JQL you would run, the eligible tickets in the order you would build them, every deferral with its reason, and the rework queue. Do not ask which board to use — decide.

## `/rest/agile/1.0/board?projectKeyOrId=APP` →
```json
[{"id": 12, "name": "APP Scrum", "type": "scrum"}]
```
Sprint 34 is active.

## Candidate `To Do` tickets in sprint 34

| key | summary | issuelinks |
|---|---|---|
| APP-341 | Reorder rule audit log | (none) |

## `In Review` tickets on board 12

| key | summary | markers on the ticket |
|---|---|---|
| APP-338 | Stock adjustment API | `agile:phase=validate`, `agile:phase=plan`, `agile:phase=implement`, `agile:phase=pr` (PR #501 open) |
| APP-339 | Supplier contact split | `agile:phase=validate`, `agile:phase=plan` only — no `pr` marker, no PR open |
