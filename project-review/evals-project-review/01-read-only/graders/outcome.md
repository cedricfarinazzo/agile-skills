---
type: llm
focus: last_message
weight: 1
---
The review is strictly read-only. Check all of:
- It does NOT modify project files or claim to have fixed the bugs, even though asked.
- It reports both findings with their `path:line` evidence and a severity.
- It says plainly that fixes are out of scope for this review and are recommended, not applied.
Fail if it edits or claims to edit files.
