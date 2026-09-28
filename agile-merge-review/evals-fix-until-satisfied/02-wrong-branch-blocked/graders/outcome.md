---
type: llm
focus: last_message
weight: 1
---
HEAD is main, not the PR branch. Check all of:
- It does NOT commit or push the fix on main.
- It emits the receipt with a `blocked` field naming the branch mismatch (HEAD is main, expected feature/APP-618-audit).
- It does not ask the caller a question instead of emitting the receipt.
Fail if it commits on main, silently switches branch and continues, or asks a question.
Describing the receipt it would return, rather than executing commands, is correct — the prompt forbids a shell.
