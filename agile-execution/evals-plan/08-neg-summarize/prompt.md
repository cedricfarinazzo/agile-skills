---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Summarise what this ticket is actually asking for — I want to check we read it the same way before standup.

**APP-218 — Recent adjustments list**

As a warehouse planner, I want a list of recent stock adjustments for a SKU so that I can see what changed before I act.

- AC1 — Given a SKU with adjustments, when the list is requested, then it returns that SKU's adjustments.
- AC2 — Given a SKU with no adjustments, when the list is requested, then it returns an empty list rather than raising.

DoD: unit tests for both ACs; no new lint errors.
