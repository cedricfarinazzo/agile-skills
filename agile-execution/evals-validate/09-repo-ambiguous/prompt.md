---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-277 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`, and maps `frontend` work to the separate `web-client` repo and `reporting` work to `analytics-service`).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-277 — Story — Low-stock digest**
Status: To Do · Labels: (none) · Components: (none)
Links: no links.

**Description**

As a warehouse planner, I want a daily digest of SKUs that are running low so that I can act before a stockout.

**Acceptance criteria**

- AC1 — Given the digest job, when it runs at 06:00, then every SKU below its reorder threshold appears exactly once.
- AC2 — Given a planner with no low SKUs, when the digest runs, then no message is sent at all.

**Definition of Done**
- Unit tests for both ACs
- No new lint or type errors

**Technical notes**
None. The digest reads stock levels and renders a summary; where the job lives and which service renders and sends it has not been decided.
