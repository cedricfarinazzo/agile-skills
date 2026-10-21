---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-sprint-close:agile-15-retro` skill for this.

Run the retro for sprint 8. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP). Every sprint ticket is Done.

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do, the questions you would ask (with their options), and exactly what you would write or return. Stop at the point where you need the user's answers.

Comments on sprint tickets:
- APP-51 (Story), comment by the build agent: "Open question: should the reorder threshold default to 10 or be required per warehouse? Implemented default 10 for now." No reply.
- APP-53 (Bug), comment by a developer: "Does the nightly sync still retry on 429?" No reply. On `main`, `inventory/tasks/sync.py:72` wraps the call in `retry(on=[429], attempts=3)`.
- APP-55 (Story), comment: "Is the CSV export column order final?" Reply below it: "Yes, confirmed with product."

Closeout for sprint 8: green, 1 Critical fixed during closeout (stock count off by one on split shipments, no regression test existed). Previous retro left one open action: "Add a contract test for the supplier API — owner: backend lead."
