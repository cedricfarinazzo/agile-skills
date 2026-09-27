---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
QA-validate story APP-501. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

`APP-501` status `Done`, with a `🤖 <!-- agile:phase=post_merge -->` comment and merged PR #712. Tester evidence on main (staging, production-like): AC1 pass (screenshot), AC2 pass (test log), AC3 FAIL — editing a paused rule re-activates it (expected: stays paused). DoD items all confirmed.
