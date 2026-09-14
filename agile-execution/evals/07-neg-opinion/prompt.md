---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Here's a ticket someone on the team wrote. What do you think of it?

**APP-402 — Story — Bulk SKU import**

As a warehouse planner, I want to upload a CSV of SKUs so that I do not have to add them one at a time.

- AC1 — Given a valid CSV, when it is uploaded, then every row becomes a SKU.
- AC2 — Given a row with a duplicate code, when the file is uploaded, then that row is skipped and reported in the summary.

DoD: unit tests, no new lint errors.
