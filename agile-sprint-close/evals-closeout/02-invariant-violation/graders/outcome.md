---
type: llm
focus: last_message
weight: 1
---
Invariants are review axes. Check all of:
- It flags reorder.py:90 as violating the documented invariant, with severity.
- Passing tests do not clear it — it is still reported.
- It grades the finding Critical — an architecture-invariant breach — and says it blocks closeout.
- The finding is listed under a Critical heading (or labelled Critical) with its `file:line`, and a fix is given.
Fail if it is not reported.
