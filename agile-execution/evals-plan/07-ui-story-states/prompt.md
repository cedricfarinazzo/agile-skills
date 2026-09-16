---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Plan the implementation of APP-288. It passed validation and is ready to build.

Repo context: this checkout is `inventory-service` (`AGENTS.md`: `repo: inventory-service`, `service-name: inventory`). Neither `gh` nor the Atlassian MCP is available here — do not attempt to call them. The ticket, the ADR extract and any source the ACs point at are inlined below. Output the exact plan marker you would post, plus any other comment you would post alongside it.

---

## Story APP-288 — Reorder rules screen

As a warehouse planner, I want a screen listing my reorder rules so that I can review them without calling the API.

- **AC1** — Given a planner with rules, when the screen loads, then each rule shows its SKU, threshold and reorder quantity.
- **AC2** — Given a planner with no rules, when the screen loads, then the empty state is shown with a link to create one.
- **AC3** — Given the rules request fails, when the screen loads, then the error state is shown with a retry control and no partial list.

**DoD:** component tests for every AC; Storybook entry per state; no new lint errors.

## Specs UI — Inventory › Reorder rules

The screen specifies four states:
- **default** — the populated table, sorted by SKU code
- **loading** — skeleton rows, no spinner
- **empty** — illustration, one line of copy, primary "Create a rule" action
- **error** — inline banner with the failure reason and a "Retry" button; the table is not rendered at all

## ADR extract §7.3 — Frontend

Screens are function components with data fetched through the generated client hooks; every state in the Specs UI gets its own Storybook story and its own component test. No state is rendered from a boolean pair that can express an impossible combination.
