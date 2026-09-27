---
type: llm
focus: last_message
weight: 1
---
Missing Specs UI is a warning, not a stop. Check all of:
- It warns that Stories will lack screen-level detail and suggests skill 3 INTEGRATE, but does NOT stop.
- It derives Stories from the PRD requirements, each a single user-facing deliverable (not a technical task like "create the table").
Fail if it stops, or produces technical-task Stories.
