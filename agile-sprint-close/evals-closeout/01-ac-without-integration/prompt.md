---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Sprint closeout for epic APP-41. Project: Inventory Service (Confluence root `Inventory Service`, Jira key APP).

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

AC matrix inputs:
- AC1 create rule → code inventory/services/reorder.py:22, unit test test_create_rule, integration test qa/integration/test_rules_flow.py::test_create.
- AC2 pause rule → code reorder.py:58, unit test test_pause_rule, no integration test.
- AC3 list rules → code reorder.py:71, no unit test, no integration test.
