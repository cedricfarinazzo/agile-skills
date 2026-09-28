---
type: llm
focus: last_message
weight: 1
---
No stack is stated. Check all of:
- It does NOT write an ADR that assumes a language, framework, database or cloud.
- It asks the missing questions in ONE message — at least the stack, and what the auth service exposes (protocol/tokens/owner).
- It states any assumptions it is making in that same message rather than inferring silently.
Fail if it writes the ADR with an invented stack, or drips questions one at a time.
