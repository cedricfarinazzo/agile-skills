---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-271. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-271 — Exclude locations that are not taking stock from the sweep

As a warehouse planner, I want the sweep to skip locations that are not currently taking stock so that we stop raising reorders nobody can receive.

- **AC1** — Given a location that is inactive, when the sweep computes its candidate set, then no SKU held only at that location appears.
- **AC2** — Given a SKU held at both an active and an inactive location, when the sweep runs, then it appears exactly once.

**DoD:** unit tests for both ACs; no new lint errors.
**Technical notes:** filter on `location.is_retired` when building the candidate set.

## Source as it exists on `main` — `inventory/models/location.py`

```python
class Location(Base):                           # line 9
    __tablename__ = "locations"
    id = Column(UUID, primary_key=True)
    name = Column(String(120), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)   # line 14
    accepts_receipts = Column(Boolean, nullable=False, default=True)   # line 15
```

There is no `is_retired` column and no `is_retired` property anywhere in the repo (`grep -rn "is_retired" .` returns nothing). `closed_at` marks a site that has been shut permanently — 6 sites. `accepts_receipts` is set to false for sites not currently taking deliveries — stocktakes and picks continue there, and roughly 30 live sites currently have it false. Both readings fit "not currently taking stock": the first excludes 6 sites, the second excludes 36, and the 30-site difference is the whole question.

## ADR extract §4.7 — Locations

The ADR predates both columns. It does not describe location lifecycle at all, and there is no refinement comment or linked ticket that says which of the two the reporter meant.
