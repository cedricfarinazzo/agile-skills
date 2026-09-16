---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-241. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-241 — Close out stockout episodes

As a warehouse planner, I want stockout episodes closed automatically when stock recovers so that the episode list shows only what is still open.

- **AC1** — Given an open episode, when stock rises above the reorder threshold, then the episode is closed and `closed_at` is set to the observation timestamp.
- **AC2** — Given a closed episode, when stock dips again, then a new episode is opened rather than the old one reopened.
- **AC3** — Given an episode in state `closed`, when `open_episodes` is queried, then it is excluded from the result.

**DoD:** unit tests for all three ACs; no new lint errors.

## ADR extract §5.1 — Episode lifecycle

Episode state transitions are append-only; closure is recorded, never deleted.

## Source as it exists on `main` — `inventory/models/episode.py`

```python
EPISODE_STATES = ("armed", "fired")          # line 8


class StockoutEpisode(Base):                  # line 11
    __tablename__ = "stockout_episodes"
    id = Column(UUID, primary_key=True)
    sku_id = Column(UUID, ForeignKey("inventory.skus.id"), nullable=False)
    state = Column(String, nullable=False)    # line 16
    opened_at = Column(DateTime(timezone=True), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)   # line 18
    __table_args__ = (
        CheckConstraint("state IN ('armed', 'fired')", name="ck_episode_state"),   # line 20
        Index("uq_episode_open", "sku_id", unique=True, postgresql_where=text("closed_at IS NULL")),
    )
```

## Source as it exists on `main` — `inventory/services/episode.py`

```python
def open_episodes(sku_id: str) -> list[Episode]:          # line 42
    with session_scope() as s:
        rows = s.query(StockoutEpisode).filter(
            StockoutEpisode.sku_id == sku_id,
            StockoutEpisode.closed_at.is_(None),           # line 46
        ).all()
        return [_to_episode(r) for r in rows]
```
