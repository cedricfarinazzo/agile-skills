---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
How many points would you put on this one? We're sizing the sprint and I want a second opinion before refinement.

**APP-262 — Supplier summary endpoint**

As a warehouse planner, I want a compact supplier summary so that the picker list loads quickly.

- AC1 — Given a supplier, when the summary is requested, then it returns exactly three fields: `id`, `name`, and `lead_time_days`.
- AC2 — Given a supplier with no recorded lead time, when the summary is requested, then `lead_time_days` is null and the call still succeeds.
- AC3 — Given 200 suppliers, when the summary list is requested, then the response contains only those three fields per row and nothing else.

DoD: unit tests for every AC; no new lint errors.
