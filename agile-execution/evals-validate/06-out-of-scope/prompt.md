---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-260 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`, and maps `frontend` work to the separate `web-client` repo).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-260 — Story — Reorder-rule editor screen**
Status: To Do · Labels: `frontend`, `repo:web-client` · Components: web-client
Links: is blocked by APP-204 (Done).

**Description**

As a warehouse planner, I want a screen to create and edit reorder rules so that I do not have to call the API by hand.

**Acceptance criteria**

- AC1 — Given the rules screen, when the planner submits a valid threshold and quantity, then the rule appears in the list without a page reload.
- AC2 — Given a threshold ≤ 0, when the planner submits, then the field shows the typed validation error returned by the API and nothing is sent twice.
- AC3 — Given a rule the planner does not own, when its id is entered directly in the URL, then the screen shows a not-found state.

**Definition of Done**
- Component tests for all three ACs
- Storybook entry for the empty, populated and error states
- No new lint or type errors

**Technical notes**
Per ADR §4.2 the rules API is owned by `inventory-service`; this Story is the client surface only. Specs UI: `Specs UI › Inventory › Reorder rules editor`.
