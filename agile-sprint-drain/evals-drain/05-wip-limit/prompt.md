---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-sprint-drain:agile-sprint-drain` skill for this.

Drain the sprint with `concurrency=2`. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do this pass, with what arguments.

Board, pass 1: eligible To Do tickets APP-901, APP-902, APP-903, APP-904 (no blockers). Open PRs: #40 (APP-890, CI green, reviewed) and #41 (APP-891, CI running). No In Progress tickets without a PR.
