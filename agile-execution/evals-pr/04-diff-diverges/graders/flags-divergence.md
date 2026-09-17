---
type: llm
focus: last_message
weight: 1
---
The real diff diverges from the plan in two ways: it touches `inventory/services/sweep.py`, which the plan never named, and it omits `migrations/0015_rule_state.py`, which the plan did name. The plan's AC→test map also lists a resume test (`test_resuming_restores_it_to_the_sweep`) that the single-test diff does not appear to contain. The skill says to say so in the body and not paper over it. Check all of:
- The body flags the unplanned addition of `sweep.py`.
- The body flags the missing migration the plan called for.
- It does not silently present the diff as matching the plan.
Noting the apparently missing resume test is a bonus, not required.
Fail if either divergence goes unmentioned, or if the body claims the changes match the plan.
