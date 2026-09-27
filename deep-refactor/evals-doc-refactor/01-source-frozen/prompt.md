---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Doc refactor. Repo `inventory-service`.

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

README says: "Run `inventory sync --verbose` for detailed logs." `inventory sync --help` shows `--debug` and no `--verbose`.
