---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Self-review PR #423 for APP-212 before handing it over.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The Story, the PR and every changed file are inlined below in full. Output the exact review verdict block you would post.

---

## Story APP-212 — Parse the supplier compose manifest

As a platform engineer, I want the supplier manifest parsed in one place so that the sweep and the CLI agree on what it contains.

- **AC1** — Given a manifest with three suppliers, when `supplier_names` is called, then it returns the three names in file order.
- **AC2** — Given a manifest missing the `suppliers` key, when `supplier_names` is called, then it returns an empty list rather than raising.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** per ADR §7.1, manifest access goes through one loader module; nothing else parses the YAML directly.

## PR #423 — "APP-212: supplier manifest loader"

Base `main`, head `app-212-manifest-loader`. Dev flags: none. Prior review cycles: 0.
`gh pr diff 423 --name-only` →
```
inventory/manifest.py
tests/test_manifest.py
```

### `inventory/manifest.py` (34 lines)

```python
import yaml
from pathlib import Path

DEFAULT_PATH = Path("suppliers.yml")


class ManifestLoader:
    """Loads and caches the supplier manifest."""

    def __init__(self, path: Path = DEFAULT_PATH):
        self.path = path
        self._cache = None

    def load(self) -> dict:
        if self._cache is None:
            self._cache = yaml.safe_load(self.path.read_text()) or {}
        return self._cache


def load_manifest(path: Path = DEFAULT_PATH) -> dict:
    return yaml.safe_load(path.read_text()) or {}


def supplier_names(path: Path = DEFAULT_PATH) -> list[str]:
    return list(load_manifest(path).get("suppliers", {}).keys())
```

### `tests/test_manifest.py` (18 lines)

```python
def test_supplier_names_returns_names_in_file_order(tmp_path):
    p = tmp_path / "suppliers.yml"
    p.write_text("suppliers:\n  acme: {}\n  globex: {}\n  initech: {}\n")
    assert supplier_names(p) == ["acme", "globex", "initech"]


def test_missing_suppliers_key_returns_empty_list(tmp_path):
    p = tmp_path / "suppliers.yml"
    p.write_text("version: 2\n")
    assert supplier_names(p) == []
```

Nothing else in the repo imports `ManifestLoader`; `grep -rn "ManifestLoader" .` returns only its definition in `inventory/manifest.py`.
