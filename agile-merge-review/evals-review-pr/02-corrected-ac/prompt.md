---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Review PR #858 (APP-648).

The repository is not checked out in this sandbox — do not search the working tree; every file you need is inlined below. The `agile:spec-correction` comment below was posted on the ticket by the implementing agent, per the pipeline's spec-correction convention.

No shell, `gh`, or Atlassian MCP here — do not call them or dispatch agents. Command output is inlined. State what you do and the exact receipt/report you would return.

`headRefOid` → `a09e5d1`. Diff: `inventory/services/episode.py`, `tests/test_episode.py`.
Jira AC3: "Given an episode in state `closed`, when `open_episodes` is queried, then it is excluded."
Ticket also carries: `🤖 <!-- agile:spec-correction -->` AC3 says state `closed`; ground truth EPISODE_STATES = ("armed","fired") at inventory/models/episode.py:8; closure is `closed_at IS NOT NULL`; intent satisfied by filtering on `closed_at`.
`gh pr diff 858 --name-only` → `inventory/services/episode.py`, `tests/test_episode.py`.

`git show a09e5d1:inventory/services/episode.py` (full file):
```python
from inventory.db import session_scope
from inventory.models.episode import StockoutEpisode


def _to_episode(row):
    return {"id": row.id, "sku_id": row.sku_id, "opened_at": row.opened_at, "closed_at": row.closed_at}


def open_episodes(sku_id: str) -> list[dict]:
    with session_scope() as s:
        rows = s.query(StockoutEpisode).filter(
            StockoutEpisode.sku_id == sku_id,
            StockoutEpisode.closed_at.is_(None),
        ).all()
        return [_to_episode(r) for r in rows]
```

`git show a09e5d1:tests/test_episode.py` (full file):
```python
from datetime import datetime, timezone
from inventory.services.episode import open_episodes


def test_open_episode_is_listed(episode_factory):
    ep = episode_factory(sku_id="sku-1", state="fired", closed_at=None)
    assert [e["id"] for e in open_episodes("sku-1")] == [ep.id]


def test_closed_episode_excluded(episode_factory):
    episode_factory(sku_id="sku-1", state="fired", closed_at=datetime(2026, 9, 1, tzinfo=timezone.utc))
    assert open_episodes("sku-1") == []
```

`git show a09e5d1:inventory/models/episode.py` line 8: `EPISODE_STATES = ("armed", "fired")`.
Jira AC1 (open episodes listed) and AC2 (listing is per SKU) are also on the ticket.
