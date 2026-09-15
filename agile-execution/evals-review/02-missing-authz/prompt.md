---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Self-review PR #418 for APP-207 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-207 — Edit and delete reorder rules

As a warehouse planner, I want to edit and delete my reorder rules so that I can correct them without support.

- **AC1** — Given a planner's own rule, when they PATCH it with a new `reorder_qty`, then the row is updated and `updated_at` advances.
- **AC2** — Given a rule owned by another planner, when it is PATCHed or DELETEd, then the request is refused with `Forbidden` and the row is unchanged.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §4.2 rules are owner-scoped by `planner_id`; every read and write must be scoped to the calling planner.

## PR #418 — "APP-207: edit and delete reorder rules"

Base `main`, head `app-207-edit-rules`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 418 --name-only` →
```
inventory/services/reorder.py
inventory/handlers/reorder.py
tests/test_reorder_edit.py
```

### `inventory/services/reorder.py` (added functions, 22 lines)

```python
def update_rule(rule_id: str, reorder_qty: int) -> ReorderRule:
    with session_scope() as s:
        rule = s.query(ReorderRule).filter_by(id=rule_id).one()
        rule.reorder_qty = reorder_qty
        rule.updated_at = utcnow()
        return rule


def delete_rule(rule_id: str) -> None:
    with session_scope() as s:
        rule = s.query(ReorderRule).filter_by(id=rule_id).one()
        s.delete(rule)
```

### `inventory/handlers/reorder.py` (added handlers, 16 lines)

```python
def patch_rule(request, rule_id):
    planner = current_planner(request)          # 401 if not signed in
    rule = update_rule(rule_id, request.json["reorder_qty"])
    return {"id": rule.id, "reorder_qty": rule.reorder_qty}, 200


def delete_rule_handler(request, rule_id):
    planner = current_planner(request)          # 401 if not signed in
    delete_rule(rule_id)
    return "", 204
```

### `tests/test_reorder_edit.py` (24 lines)

```python
def test_patch_updates_quantity_and_timestamp(planner, rule_factory):
    rule = rule_factory(planner_id=planner.id, reorder_qty=100)
    before = rule.updated_at
    updated = update_rule(rule.id, 250)
    assert updated.reorder_qty == 250
    assert updated.updated_at > before


def test_delete_removes_the_rule(planner, rule_factory):
    rule = rule_factory(planner_id=planner.id)
    delete_rule(rule.id)
    assert list_rules(planner.id) == []
```
