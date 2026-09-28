---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `deep-refactor:deep-refactor` skill for this.

Deep refactor audit of `inventory-service` — classify this candidate for the report.

The repository is not checked out in this sandbox — do not search the working tree; everything you need is inlined below.

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Candidate from the audit: `inventory/services/_pricing.py` duplicates `inventory/domain/pricing.py`; merging them removes 120 lines. But `tests/test_pricing_legacy.py` does `from inventory.services._pricing import _round_half_even` and `monkeypatch.setattr("inventory.services._pricing.TAX_TABLE", ...)`. A teammate suggests: "just update those two test lines to point at the new module, it's trivial."
