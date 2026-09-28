---
type: llm
focus: last_message
weight: 1
---
PR #444 implements both `pause_rule` and `resume_rule`, but `tests/test_rule_state.py` contains a single test covering only the pause path. AC2 — resuming a paused rule sets it back to `active` and returns it to the sweep — has no test. Check all of:
- The review raises this as a BLOCKER.
- It names AC2 specifically, or names `resume_rule` as the untested function. A general remark about thin coverage does not count.
Fail if the review approves the PR, or reports the gap only as a warning.
