---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-229 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-229 — Story — Supplier reliability panel**
Status: To Do · Labels: `backend`, `repo:inventory-service` · Components: inventory-api
Links: is blocked by APP-186 (**Done**, merged as `28574a8f`).

**Description**

As a warehouse planner, I want a four-metric reliability panel per supplier so that I can see which suppliers are drifting before a stockout.

**Acceptance criteria**

- AC1 — Given a supplier, when the panel is computed, then the four metrics (on-time rate, fill rate, lead-time variance, defect rate) are each compared against that supplier's stored reliability envelope (the `reliability_verdict` bands laid down by APP-186) and returned with a `within | outside | degraded` state.
- AC2 — Given a supplier whose on-time rate falls outside its band, when the panel is computed, then the state is `outside`; the assertion must be mutation-proven to actually fail when the comparison is removed.
- AC3 — Given a supplier with no stored envelope, when the panel is computed, then it returns `collecting` and no comparison is attempted.
- AC4 — Given the panel resolver, when it is queried by a planner who does not own the supplier record, then it is refused with a typed `Forbidden` error.
- AC5 — Given a computed panel, when it is re-queried within the cache window, then the stored result is served and the metrics are not recomputed.
- AC6 — Given a metric whose input series is empty, when the panel is computed, then the metric is `null`, never `NaN`.

**Definition of Done**
- Unit tests for all six ACs, AC2 mutation-proven
- Golden fixture for the panel payload
- Migration head-pin bump in the same PR
- Integration assertion through the real resolver
- No new lint or type errors

**Technical notes**
Per ADR §6.3 + the S22 addendum (D44, D45): band constants were locked at refinement. The envelope is read from the table APP-186 created.

**Schema as it exists on `main` at `28574a8f`** (migration `supplier/0009`):

```sql
CREATE TABLE supplier.reliability_verdict (
    id            uuid PRIMARY KEY,
    supplier_id   uuid NOT NULL REFERENCES supplier.suppliers(id),
    checks        jsonb NOT NULL,   -- three APP-186 checks: on_time_window, seasonal_hold, carrier_split
    payload       jsonb NOT NULL,   -- {"on_time_rate": {"lo": 0.82, "hi": 0.97}}
    created_at    timestamptz NOT NULL DEFAULT now()
);
```

Specs UI: none — any UI is out of scope for this Story.
