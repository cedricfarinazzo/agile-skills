---
type: llm
focus: last_message
weight: 1
---
Re-run fills only what is missing. Check all of:
- It treats Success metrics (empty) and Out of scope (TBD) as incomplete and fills/asks about them.
- It does NOT rewrite or overwrite the filled sections.
- It refreshes Last updated.
Fail if filled sections are rewritten.
