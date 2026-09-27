---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Create the roadmap and define the MVP. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

PRD `PRD — Inventory Service`: approved 2026-08-02. ADR `ADR — Inventory Service`: approved 2026-08-20, Epic list with estimates: E1 Reorder rules (M), E2 Supplier sync (L), E3 Dashboard (S).
Stakeholder notes: MVP goal "planners can set reorder rules and see low stock"; success criteria: 80% of SKUs covered by a rule within 30 days; in scope E1 + E3; deadline 2026-11-30. Approval: PM + Tech Lead sign-off.

Put the MVP goal, the success-criteria table and the epics in scope directly on the Roadmap page so everything is in one place.
