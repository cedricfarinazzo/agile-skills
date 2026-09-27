---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Write the ADR. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

PRD (approved): planners manage reorder rules per SKU; supplier sync nightly from a partner feed; must "integrate with the auth service"; NFR: p95 page load under 2s. No language, framework, database, or hosting is mentioned anywhere, and there is no existing codebase.
