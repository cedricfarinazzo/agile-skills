---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-sprint-close:agile-13-sprint-closeout` skill for this.

Sprint closeout for epic APP-41, tech-lead lens. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Root CLAUDE.md invariant: "Services never call each other directly — only via send_task." Sprint diff includes `inventory/services/reorder.py:90`: `from supplier_service.client import get_lead_time` called synchronously. All tests pass.
