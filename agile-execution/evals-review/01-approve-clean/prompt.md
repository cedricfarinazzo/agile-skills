---
max_turns: 10
timeout_seconds: 600
allowed_tools: [Skill]
runs: 3
---
Self-review PR #412 for APP-204 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-204 — Reorder quantity calculation

As a warehouse planner, I want the reorder quantity for a SKU computed from its stock position so that the sweep orders in whole cases and never orders below what is already on order.

- **AC1** — Given `on_hand + on_order` is at or above `threshold`, when the quantity is computed, then it is 0 (nothing to order).
- **AC2** — Given `on_hand + on_order` is below `threshold`, when the quantity is computed, then it is the shortfall rounded **up** to a whole multiple of `case_size`.

**DoD:** unit tests for both ACs including the boundary; no new lint errors.
**Technical notes:** per ADR §4.2 this is a pure function in `inventory/domain/` — no I/O, no session, no logging. Callers own persistence and validation; inputs reaching it are already validated non-negative integers with `case_size >= 1`, guaranteed by the `SweepInput` schema at the entry point (unchanged by this PR). Out of scope: the sweep wiring (APP-206) and the HTTP surface (APP-208).

## PR #412 — "APP-204: reorder quantity calculation"

Base `main`, head `app-204-reorder-qty`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 412 --name-only` →
```
inventory/domain/reorder_qty.py
tests/test_reorder_qty.py
```

### `inventory/domain/reorder_qty.py` (23 lines)

```python
"""Reorder quantity for a single SKU (APP-204). Pure: no I/O, no session."""


def reorder_quantity(on_hand: int, on_order: int, threshold: int, case_size: int) -> int:
    """Whole cases needed to bring the stock position back to `threshold`.

    Returns 0 when the position already meets the threshold. Otherwise the
    shortfall is rounded up to the next whole multiple of `case_size`, so the
    result always covers the shortfall and never orders a partial case.
    """
    position = on_hand + on_order
    shortfall = threshold - position
    if shortfall <= 0:
        return 0
    whole_cases = -(-shortfall // case_size)   # ceiling division
    return whole_cases * case_size
```

### `tests/test_reorder_qty.py` (34 lines)

```python
import pytest

from inventory.domain.reorder_qty import reorder_quantity


@pytest.mark.parametrize(
    "on_hand, on_order, threshold, expected",
    [
        (100, 0, 20, 0),     # comfortably above
        (15, 5, 20, 0),      # exactly at the threshold, counting what is on order
        (25, 0, 20, 0),      # above without any on order
    ],
)
def test_position_at_or_above_threshold_orders_nothing(on_hand, on_order, threshold, expected):
    assert reorder_quantity(on_hand, on_order, threshold, case_size=12) == expected


@pytest.mark.parametrize(
    "on_hand, on_order, threshold, case_size, expected",
    [
        (0, 0, 20, 12, 24),    # shortfall 20 -> two cases of 12
        (8, 0, 20, 12, 12),    # shortfall 12 -> exactly one case, not two
        (19, 0, 20, 12, 12),   # shortfall 1 -> still a whole case
        (10, 5, 20, 5, 5),     # on_order counts toward the position
        (0, 0, 20, 1, 20),     # case size of one degrades to the raw shortfall
    ],
)
def test_shortfall_is_rounded_up_to_whole_cases(on_hand, on_order, threshold, case_size, expected):
    ordered = reorder_quantity(on_hand, on_order, threshold, case_size)
    assert ordered == expected
    assert on_hand + on_order + ordered >= threshold      # the shortfall is covered
    assert ordered % case_size == 0                       # only whole cases
```
