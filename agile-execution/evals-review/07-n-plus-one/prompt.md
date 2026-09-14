---
max_turns: 10
timeout_seconds: 600
allowed_tools: [Skill]
runs: 3
---
Self-review PR #449 for APP-236 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-236 — Stock levels on the rules list

As a warehouse planner, I want each rule in the list to show its SKU's current stock so that I can see which rules are about to fire.

- **AC1** — Given a planner with rules, when the rules list is requested, then each row carries its SKU's current on-hand quantity.
- **AC2** — Given a rule whose SKU has no stock record, when the list is requested, then that row shows a quantity of 0.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §6.1 list endpoints are paginated and must issue a bounded number of queries independent of page size.

## PR #449 — "APP-236: stock levels on the rules list"

Base `main`, head `app-236-rules-with-stock`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 449 --name-only` →
```
inventory/services/reorder.py
tests/test_rules_with_stock.py
```

### `inventory/services/reorder.py` (added function, 20 lines)

```python
def list_rules_with_stock(planner_id: str, page: int = 1, per_page: int = 50) -> list[dict]:
    with session_scope() as s:
        rules = (
            s.query(ReorderRule)
            .filter_by(planner_id=planner_id)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        rows = []
        for rule in rules:
            level = s.query(StockLevel).filter_by(sku_id=rule.sku_id).one_or_none()
            rows.append({
                "id": rule.id,
                "sku_id": rule.sku_id,
                "threshold": rule.threshold,
                "on_hand": level.quantity if level else 0,
            })
        return rows
```

### `tests/test_rules_with_stock.py` (20 lines)

```python
def test_each_row_carries_its_skus_on_hand_quantity(planner, rule_factory, stock_factory):
    rule = rule_factory(planner_id=planner.id, sku_id="sku-1")
    stock_factory(sku_id="sku-1", quantity=42)
    rows = list_rules_with_stock(planner.id)
    assert rows[0]["on_hand"] == 42


def test_missing_stock_record_reports_zero(planner, rule_factory):
    rule_factory(planner_id=planner.id, sku_id="sku-2")
    rows = list_rules_with_stock(planner.id)
    assert rows[0]["on_hand"] == 0
```
