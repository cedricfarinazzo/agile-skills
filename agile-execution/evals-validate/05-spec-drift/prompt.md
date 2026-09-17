---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-241 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-241 — Story — Close out stockout episodes**
Status: To Do · Labels: `backend`, `repo:inventory-service` · Components: inventory-api
Links: no "is blocked by" links.

**Description**

As a warehouse planner, I want stockout episodes to close automatically when stock recovers so that the episode list shows only what is still open.

**Acceptance criteria**

- AC1 — Given an open episode, when stock for its SKU rises above the reorder threshold, then the episode is closed and `closed_at` is set to the observation timestamp.
- AC2 — Given a closed episode, when stock dips again, then a new episode is opened rather than the old one reopened.
- AC3 — Given an episode in state `closed`, when `openEpisodes` is queried, then it is excluded from the result.
- AC4 — Given two observations in the same second, when both would close the episode, then exactly one close is written (partial unique index holds).

**Definition of Done**
- Unit tests for all four ACs
- Integration assertion through the real resolver
- Migration head-pin bump in the same PR
- No new lint or type errors

**Technical notes**
Per ADR §5.1 (D31): episode state transitions are append-only; closure is recorded, never deleted.

**Source as it exists on `main`** — `inventory/models/episode.py`:

```python
EPISODE_STATES = ("armed", "fired")

class StockoutEpisode(Base):
    __tablename__ = "stockout_episodes"
    id = Column(UUID, primary_key=True)
    sku_id = Column(UUID, ForeignKey("inventory.skus.id"), nullable=False)
    state = Column(String, nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        CheckConstraint("state IN ('armed', 'fired')", name="ck_episode_state"),
        Index("uq_episode_open", "sku_id", unique=True, postgresql_where=text("closed_at IS NULL")),
    )
```
