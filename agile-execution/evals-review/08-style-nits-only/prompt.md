---
max_turns: 10
timeout_seconds: 600
allowed_tools: [Skill]
runs: 3
---
Self-review PR #455 for APP-240 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-240 — Low-stock count for the dashboard header

As a warehouse planner, I want a count of SKUs below their threshold so that the dashboard header shows how much needs attention.

- **AC1** — Given rules whose SKUs are below threshold, when the count is requested, then it returns the number of such SKUs.
- **AC2** — Given no SKU below its threshold, when the count is requested, then it returns 0.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §6.1 the count is derived in one query; no ADR constraint on naming.

## PR #455 — "APP-240: low stock count"

Base `main`, head `app-240-low-stock-count`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 455 --name-only` →
```
inventory/services/dashboard.py
tests/test_low_stock_count.py
```

### `inventory/services/dashboard.py` (21 lines)

```python
from sqlalchemy import func
from inventory.db import session_scope
from inventory.models import ReorderRule, StockLevel


def get_c(pid: str) -> int:
    # returns the count
    with session_scope() as s:
        q = (
            s.query(func.count(ReorderRule.id))
            .join(StockLevel, StockLevel.sku_id == ReorderRule.sku_id)
            .filter(ReorderRule.planner_id == pid)
            .filter(ReorderRule.state == "active")
            .filter(StockLevel.quantity < ReorderRule.threshold)
        )
        x = q.scalar()
        return x or 0
```

### `tests/test_low_stock_count.py` (23 lines)

```python
def test_counts_skus_below_their_threshold(planner, rule_factory, stock_factory):
    rule_factory(planner_id=planner.id, sku_id="sku-1", threshold=20, state="active")
    stock_factory(sku_id="sku-1", quantity=5)
    rule_factory(planner_id=planner.id, sku_id="sku-2", threshold=10, state="active")
    stock_factory(sku_id="sku-2", quantity=3)
    assert get_c(planner.id) == 2


def test_returns_zero_when_nothing_is_below_threshold(planner, rule_factory, stock_factory):
    rule_factory(planner_id=planner.id, sku_id="sku-1", threshold=20, state="active")
    stock_factory(sku_id="sku-1", quantity=99)
    assert get_c(planner.id) == 0
```
