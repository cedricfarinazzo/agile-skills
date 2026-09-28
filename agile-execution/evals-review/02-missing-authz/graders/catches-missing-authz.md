---
type: llm
focus: last_message
weight: 1
---
PR #418 has a planted authorisation defect: `patch_rule` and `delete_rule_handler` call `current_planner(request)` — which only proves the caller is signed in — and then pass `rule_id` straight to `update_rule` / `delete_rule`, neither of which filters by `planner_id`. Any signed-in planner can edit or delete any other planner's rule, which is exactly what AC2 forbids. Check all of:
- The review raises this as a BLOCKER, not a warning.
- It identifies the real cause: ownership is never checked — the service functions look the rule up by id alone. Saying vaguely that "auth should be reviewed" does not count.
- It points at the offending code: `update_rule` / `delete_rule` in `inventory/services/reorder.py`, or the two handlers that call them.
Fail if the review approves the PR, or reports this only as a warning or a nice-to-have.
