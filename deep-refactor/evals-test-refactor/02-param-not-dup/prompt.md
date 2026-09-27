---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Test refactor on `tests/test_reorder_qty.py`. Repo `inventory-service`.

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

File has a `@pytest.mark.parametrize` with 5 cases (shortfall 20→24, 12→12, 1→12, on-order counted, case size 1). A reviewer calls it "5 duplicate tests, cut to 1".
