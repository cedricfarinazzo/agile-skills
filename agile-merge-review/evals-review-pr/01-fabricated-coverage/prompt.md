---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Review PR #852 (APP-642).

The repository is not checked out in this sandbox — do not search the working tree; every file you need is inlined below.

No shell, `gh`, or Atlassian MCP here — do not call them or dispatch agents. Command output is inlined. State what you do and the exact receipt/report you would return.

`headRefOid` → `31bf0c7`. Diff: `inventory/services/export.py`, `tests/test_export.py`.
PR body AC-coverage table:
| AC | test |
|---|---|
| AC1 | tests/test_export.py::test_export_writes_header |
| AC2 | tests/test_export.py::test_export_escapes_commas |
`git show 31bf0c7:tests/test_export.py` →
```python
def test_export_writes_header(tmp_path):
    ...
    assert out.read_text().splitlines()[0] == "sku,qty"
```
(no other tests in the file). Jira ACs: AC1 header row written; AC2 values containing commas are quoted.
