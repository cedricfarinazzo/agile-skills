---
max_turns: 10
timeout_seconds: 600
allowed_tools: [Skill]
runs: 3
---
Self-review PR #437 for APP-224 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-224 — Show the reason code on stock adjustments

As an auditor, I want each adjustment's reason code in the adjustment feed so that I can tell a correction from a shrinkage write-off.

- **AC1** — Given an adjustment with a reason code, when the feed renders it, then the code appears in the rendered row.
- **AC2** — Given an adjustment created through the service, when it is stored, then its reason code is persisted on the event payload.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §3.6 the adjustment event payload is the shared structure; producers build it, the feed formatter renders it.

## PR #437 — "APP-224: reason code on adjustment rows"

Base `main`, head `app-224-reason-code`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 437 --name-only` →
```
inventory/events.py
inventory/feed/format.py
tests/test_feed_format.py
```

### `inventory/events.py` (changed lines, 20)

```python
def build_adjustment_event(adj) -> dict:
    return {
        "id": adj.id,
        "sku_id": adj.sku_id,
        "delta": adj.delta,
        "actor_id": adj.actor_id,
        "occurred_at": adj.occurred_at.isoformat(),
    }
```

### `inventory/feed/format.py` (changed lines, 15)

```python
REASONS = {"correction": "Correction", "shrinkage": "Shrinkage write-off", "receipt": "Goods receipt"}


def format_adjustment_row(event: dict) -> str:
    reason = REASONS.get(event.get("reason_code"), "—")
    return f"{event['occurred_at']}  {event['sku_id']}  {event['delta']:+d}  {reason}"
```

### `tests/test_feed_format.py` (22 lines)

```python
def test_row_renders_the_reason_code():
    event = {
        "occurred_at": "2026-02-01T10:00:00",
        "sku_id": "sku-1",
        "delta": -4,
        "reason_code": "shrinkage",
    }
    assert "Shrinkage write-off" in format_adjustment_row(event)


def test_row_renders_a_dash_when_reason_is_absent():
    event = {"occurred_at": "2026-02-01T10:00:00", "sku_id": "sku-1", "delta": 2}
    assert format_adjustment_row(event).endswith("—")
```
