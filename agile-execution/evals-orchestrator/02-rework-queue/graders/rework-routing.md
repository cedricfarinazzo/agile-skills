---
type: llm
focus: last_message
weight: 1
---
The rework queue is In Review tickets carrying a `pr` marker; they skip the build phases and go straight to monitoring. Check all of:
- APP-338 is put in the rework queue and routed to monitoring (implement-monitor), skipping validate/plan/implement/pr.
- APP-339 is NOT in the rework queue — it has no `pr` marker and no open PR, so it does not qualify.
- APP-341 is the build-queue ticket and runs the full phase chain.
- The two queues are kept distinct rather than merged into one list.
Fail if APP-339 is routed to monitoring, or if APP-338 is sent back through the build phases.
