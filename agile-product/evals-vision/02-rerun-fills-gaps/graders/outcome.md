---
type: llm
focus: last_message
weight: 1
---
Re-run fills only what is missing. Check all of:
- It treats Success metrics (empty) and Out of scope (empty) as incomplete and fills/asks about them.
- It does NOT rewrite or overwrite the filled sections.
- Asking a clarifying question before writing a section counts as handling it; refreshing Last updated is only expected when it actually writes.
Fail if filled sections are rewritten.
