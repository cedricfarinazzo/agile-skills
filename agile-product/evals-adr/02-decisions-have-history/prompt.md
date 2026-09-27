---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Update the ADR: we're switching the job queue from Celery to Dramatiq. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Current ADR section "Async jobs": "Decision: Celery with Redis broker (2026-08-20) — chosen for team familiarity."
