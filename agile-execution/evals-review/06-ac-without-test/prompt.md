---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Self-review PR #444 for APP-231 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-231 — Pause and resume a reorder rule

As a warehouse planner, I want to pause a reorder rule so that a supplier outage does not keep triggering orders.

- **AC1** — Given an active rule, when the planner pauses it, then its state becomes `paused` and the sweep skips it.
- **AC2** — Given a paused rule, when the planner resumes it, then its state becomes `active` and the sweep includes it again.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §4.2 rule state is `active | paused`; the sweep filters on it.

## PR #444 — "APP-231: pause and resume reorder rules"

Base `main`, head `app-231-pause-rules`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 444 --name-only` →
```
inventory/services/reorder.py
tests/test_rule_state.py
```

### `inventory/services/reorder.py` (added functions, 18 lines)

```python
def pause_rule(planner_id: str, rule_id: str) -> ReorderRule:
    with session_scope() as s:
        rule = s.query(ReorderRule).filter_by(id=rule_id, planner_id=planner_id).one()
        rule.state = "paused"
        return rule


def resume_rule(planner_id: str, rule_id: str) -> ReorderRule:
    with session_scope() as s:
        rule = s.query(ReorderRule).filter_by(id=rule_id, planner_id=planner_id).one()
        rule.state = "active"
        return rule


def skus_to_sweep(planner_id: str) -> list[str]:
    with session_scope() as s:
        rules = s.query(ReorderRule).filter_by(planner_id=planner_id, state="active").all()
        return [r.sku_id for r in rules]
```

### `tests/test_rule_state.py` (17 lines)

```python
def test_pausing_sets_state_and_removes_it_from_the_sweep(planner, rule_factory):
    rule = rule_factory(planner_id=planner.id, state="active")
    paused = pause_rule(planner.id, rule.id)
    assert paused.state == "paused"
    assert rule.sku_id not in skus_to_sweep(planner.id)
```
