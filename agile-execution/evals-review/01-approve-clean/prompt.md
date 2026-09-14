---
max_turns: 10
timeout_seconds: 600
allowed_tools: [Skill]
runs: 3
---
Self-review PR #412 for APP-204 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-204 — Reorder rules per SKU

As a warehouse planner, I want to define reorder rules on a SKU so that the system reorders stock at the levels I choose.

- **AC1** — Given a SKU with no rule, when the planner submits `{threshold: 20, reorder_qty: 100}`, then a rule row is created and `list_rules` returns it.
- **AC2** — Given `threshold` ≤ 0, when the rule is submitted, then it is refused with `ValidationError` and no row is written.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §4.2, rules live in `inventory.reorder_rules`, owner-scoped by `planner_id`; writes go through the service layer, never from the handler.

## PR #412 — "APP-204: reorder rules per SKU"

Base `main`, head `app-204-reorder-rules`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 412 --name-only` →
```
inventory/services/reorder.py
inventory/handlers/reorder.py
tests/test_reorder_rules.py
```

### `inventory/services/reorder.py` (28 lines)

```python
from dataclasses import dataclass
from inventory.db import session_scope
from inventory.models import ReorderRule
from inventory.errors import ValidationError


@dataclass(frozen=True)
class RuleInput:
    sku_id: str
    threshold: int
    reorder_qty: int


def create_rule(planner_id: str, data: RuleInput) -> ReorderRule:
    if data.threshold <= 0:
        raise ValidationError("threshold must be positive")
    with session_scope() as s:
        rule = ReorderRule(
            planner_id=planner_id,
            sku_id=data.sku_id,
            threshold=data.threshold,
            reorder_qty=data.reorder_qty,
        )
        s.add(rule)
        return rule


def list_rules(planner_id: str) -> list[ReorderRule]:
    with session_scope() as s:
        return s.query(ReorderRule).filter_by(planner_id=planner_id).all()
```

### `inventory/handlers/reorder.py` (19 lines)

```python
from inventory.auth import current_planner
from inventory.services.reorder import RuleInput, create_rule, list_rules


def post_rule(request):
    planner = current_planner(request)
    body = request.json
    rule = create_rule(
        planner.id,
        RuleInput(sku_id=body["sku_id"], threshold=body["threshold"], reorder_qty=body["reorder_qty"]),
    )
    return {"id": rule.id}, 201


def get_rules(request):
    planner = current_planner(request)
    return {"rules": [r.as_dict() for r in list_rules(planner.id)]}, 200
```

### `tests/test_reorder_rules.py` (31 lines)

```python
import pytest
from inventory.errors import ValidationError
from inventory.services.reorder import RuleInput, create_rule, list_rules


def test_create_rule_persists_and_is_listed(planner):
    rule = create_rule(planner.id, RuleInput(sku_id="sku-1", threshold=20, reorder_qty=100))
    assert rule.threshold == 20
    listed = list_rules(planner.id)
    assert [r.id for r in listed] == [rule.id]


def test_non_positive_threshold_is_refused_and_writes_nothing(planner):
    with pytest.raises(ValidationError):
        create_rule(planner.id, RuleInput(sku_id="sku-1", threshold=0, reorder_qty=100))
    assert list_rules(planner.id) == []


def test_negative_threshold_is_refused(planner):
    with pytest.raises(ValidationError):
        create_rule(planner.id, RuleInput(sku_id="sku-1", threshold=-5, reorder_qty=100))
```
