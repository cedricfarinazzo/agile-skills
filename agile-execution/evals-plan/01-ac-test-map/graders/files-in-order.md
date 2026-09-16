---
type: llm
focus: last_message
weight: 1
---
The plan must name the files or modules to touch, in implementation order. Check both:
- Concrete files or modules are named — a migration, a service module, a handler or API module, and tests — not a vague list of activities.
- They are ordered data before service before API before tests, consistent with the ADR extract (migration with an index, service layer owning writes, handlers not touching a session).
Fail if the plan lists no files, or names only one layer when the Story clearly spans several.
