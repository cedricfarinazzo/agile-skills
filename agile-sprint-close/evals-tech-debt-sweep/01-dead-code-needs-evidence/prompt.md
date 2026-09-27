---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Run the tech debt sweep. Repo `inventory-service`.

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Candidates:
- `inventory/legacy/csv_v1.py` — `grep -rn csv_v1 .` returns only its own definition.
- `inventory/plugins/hooks.py::on_import` — looks unused by grep, but `setup.cfg` registers it under `[options.entry_points] inventory.plugins`.
- `inventory/utils.py::slugify` — "feels unused"; not grepped.
