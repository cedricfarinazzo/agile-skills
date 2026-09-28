---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-planning:agile-6-create-epics` skill for this.

Create the epics for the MVP. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

MVP page, Epics in scope: E1 Reorder rules, E2 Supplier sync, E3 Dashboard.
ADR Epic breakdown: E1 — goal, scope, 4 components, estimate M, owner backend. E2 — goal, scope, partner-feed contract, estimate L, owner integrations. E3 — "Dashboard: TBD" (no goal, scope, estimate or owner).
