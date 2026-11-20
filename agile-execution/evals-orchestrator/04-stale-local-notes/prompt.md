---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-execution:agile-10-implement` skill for this.

Implement the sprint.

Repo context: `inventory-service`, project key `APP`, sprint 36 active. This session runs on a different machine from the last one.

There is no shell, no `gh`, and no Atlassian MCP in this sandbox — do not call them and do not dispatch any agent. Everything you would have read is inlined. State what you would do for each ticket and with the local note, and exactly what you would write where.

## Local file `.claude/notes/sprint-36.md` (left by an earlier run)

- APP-390 done, PR #212 merged.
- APP-391: decided to use Redis for the stock cache instead of Postgres.
- APP-392 plan: add `reserved_qty` column, expose it on `GET /items/<id>`, test in `test_items.py`.

## Jira and Confluence

- APP-390: status In Review. PR #212 is open, not merged.
- APP-391: status To Do, ready. ADR §5 says the stock cache is a Postgres table. The Decision Log has no entry about Redis.
- APP-392: status To Do, ready. No `🤖 <!-- agile:phase=plan -->` marker on the ticket.
