---
max_turns: 5
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Explain what this diff does — I'm reading someone else's branch and want to understand it before the standup.

```diff
--- a/inventory/services/reorder.py
+++ b/inventory/services/reorder.py
@@ -12,6 +12,14 @@ def create_rule(planner_id: str, data: RuleInput) -> ReorderRule:
         s.add(rule)
         return rule
 
+def pause_rule(planner_id: str, rule_id: str) -> ReorderRule:
+    with session_scope() as s:
+        rule = s.query(ReorderRule).filter_by(id=rule_id, planner_id=planner_id).one()
+        rule.state = "paused"
+        return rule
+
 def list_rules(planner_id: str) -> list[ReorderRule]:
     with session_scope() as s:
-        return s.query(ReorderRule).filter_by(planner_id=planner_id).all()
+        return s.query(ReorderRule).filter_by(planner_id=planner_id, state="active").all()
```
