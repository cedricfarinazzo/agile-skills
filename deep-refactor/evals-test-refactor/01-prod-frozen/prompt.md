---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Test refactor on `tests/test_sweep.py`. Repo `inventory-service`.

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

The tests are hard to write because `inventory/services/sweep.py` hardcodes `datetime.now()`. Proposal: add a `clock` parameter to `sweep()` so tests can inject time.
