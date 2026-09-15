---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Self-review PR #431 for APP-219 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-219 — Constrain SKU codes at the storage layer

As a data steward, I want SKU codes constrained in the database so that no path can write a malformed code.

- **AC1** — Given a SKU code longer than the column allows, when it is inserted, then the database refuses it.
- **AC2** — Given a valid SKU code, when it is inserted, then it is stored unchanged.

**DoD:** unit tests for both ACs; migration in the same PR; no new lint errors.
**Technical notes:** per ADR §5.4 the storage constraint is the last line of defence and must be proven to hold on its own, not merely shadowed by an application check.

## PR #431 — "APP-219: SKU code storage constraint"

Base `main`, head `app-219-sku-constraint`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 431 --name-only` →
```
migrations/0014_sku_code_constraint.py
inventory/schemas.py
tests/test_sku_code_constraint.py
```

### `migrations/0014_sku_code_constraint.py` (14 lines)

```python
def upgrade():
    op.alter_column("skus", "code", type_=sa.String(32), existing_type=sa.String(128))
    op.create_check_constraint("ck_sku_code_format", "skus", "code ~ '^[A-Z0-9-]+$'")
```

### `inventory/schemas.py` (changed lines, 12)

```python
class SkuIn(BaseModel):
    code: constr(max_length=24, pattern=r"^[A-Z0-9-]+$")
    name: str
    location_id: str
```

### `tests/test_sku_code_constraint.py` (26 lines)

```python
import pytest
from inventory.schemas import SkuIn
from inventory.services.sku import create_sku
from inventory.errors import DatabaseError


def test_valid_code_is_stored_unchanged(session):
    sku = create_sku(SkuIn(code="ACME-001", name="Widget", location_id="loc-1"))
    assert sku.code == "ACME-001"


def test_overlong_code_is_refused_by_the_database(session):
    long_code = "A" * 200
    with pytest.raises(Exception):
        create_sku(SkuIn(code=long_code, name="Widget", location_id="loc-1"))
```

`create_sku` validates its argument through `SkuIn` before it reaches the session.
