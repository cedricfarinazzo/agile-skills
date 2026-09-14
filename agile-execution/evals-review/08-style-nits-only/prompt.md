---
max_turns: 10
timeout_seconds: 600
allowed_tools: [Skill]
runs: 3
---
Self-review PR #455 for APP-240 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-240 — Low-stock banner text

As a warehouse planner, I want the dashboard banner to say how many SKUs need attention so that I can see the workload at a glance.

- **AC1** — Given a count above zero, when the banner text is built, then it reads `N SKUs below threshold`, with `SKU` singular when the count is 1.
- **AC2** — Given a count of zero, when the banner text is built, then it reads `All stock above threshold`.

**DoD:** unit tests for both ACs including the singular boundary; no new lint errors.
**Technical notes:** per ADR §9.2 banner strings are built by a pure function in `inventory/presentation/` — no I/O, no translation layer yet (English only, tracked as APP-301). The count is produced by the caller and is a non-negative integer. The ADR sets no naming convention for presentation helpers.

## PR #455 — "APP-240: low stock banner text"

Base `main`, head `app-240-banner-text`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 455 --name-only` →
```
inventory/presentation/banner.py
tests/test_banner.py
```

### `inventory/presentation/banner.py` (12 lines)

```python
"""Banner strings for the dashboard header (APP-240)."""


def get_t(n: int) -> str:
    # returns the text
    if n == 0:
        return "All stock above threshold"
    x = "SKU" if n == 1 else "SKUs"
    return f"{n} {x} below threshold"
```

### `tests/test_banner.py` (24 lines)

```python
import pytest

from inventory.presentation.banner import get_t


def test_zero_reads_all_stock_above_threshold():
    assert get_t(0) == "All stock above threshold"


def test_one_is_singular():
    assert get_t(1) == "1 SKU below threshold"


@pytest.mark.parametrize("n, expected", [(2, "2 SKUs below threshold"), (17, "17 SKUs below threshold")])
def test_more_than_one_is_plural(n, expected):
    assert get_t(n) == expected


def test_large_counts_are_not_abbreviated():
    assert get_t(1234) == "1234 SKUs below threshold"
```
