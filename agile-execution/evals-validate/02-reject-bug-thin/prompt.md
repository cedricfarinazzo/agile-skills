---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-311 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-311 — Bug — Fixture timestamps derive from the wrong clock**
Status: To Do · Labels: `backend` · Components: inventory-api
Links: relates to APP-288 (Done), relates to APP-290 (Done). No "is blocked by" links.

**Description**

The sweep rule now uses wall-clock time rather than the run's `session_date`. One integration fixture manufactured its timestamp from `session_date` and started failing once the rule changed.

## Suggested follow-up

Consider whether any other integration fixture derives a timestamp from `session_date` for a rule that is now wall-clock. That gap was found by a failing run, never by a sweep.

**Comment (latest)**

Treat that sweep as the deliverable, and add the guard the class deserves — when a rule's clock changes, every fixture that manufactures a timestamp for it changes too.
