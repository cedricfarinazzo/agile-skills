---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `session-audit:session-audit` skill for this.

Run "before" is the old dispatch mode and run "after" is the new one. Give me the before/after delta.

No shell, `gh` or transcript files here — do not call them. Everything you would have measured is inlined.

Run before, human turns:
- 20:00 /drain concurrency=2
- 21:26 "reread the new plugin version and use the new dispatch mode for new tickets"
Run before, agent table: phase agents (planner, implementer, self-reviewer) dispatched 20:00-22:10; session agents dispatched 22:17 onwards.
Run before: total $370, 7 PRs merged. Run after: total $340, 25 PRs merged, session agents only.
