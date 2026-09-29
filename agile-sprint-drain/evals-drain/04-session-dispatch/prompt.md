---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-sprint-drain:agile-sprint-drain` skill for this.

Drain the sprint with `dispatch=session concurrency=3`. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly which agents you would dispatch this pass, with what arguments.

Board, pass 1: eligible To Do tickets APP-801, APP-802, APP-803, APP-804, APP-805 (no blockers). No open PRs. No `session-batch` configured.
