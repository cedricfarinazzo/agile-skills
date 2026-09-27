---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Drain the sprint. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Board state this pass:
- APP-701 `In Review`, PR #901 open, CI green, awaiting the merge train.
- APP-702 `To Do`, is blocked by APP-701.
- APP-703 `To Do`, no blockers.
Say which tickets the next build pass may pick up, and why.
