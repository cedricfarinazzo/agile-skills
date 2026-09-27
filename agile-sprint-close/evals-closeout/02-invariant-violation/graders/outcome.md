---
type: llm
focus: last_message
weight: 1
---
Invariants are review axes. Check all of:
- It flags reorder.py:90 as violating the documented invariant, with severity.
- Passing tests do not clear it.
Fail if it is not reported.
