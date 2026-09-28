---
type: llm
focus: last_message
weight: 1
---
Only ask about the genuinely unclear Epic. Check all of:
- It asks about E3 only (goal, scope, estimate), in ONE message.
- It does NOT re-ask about E1 or E2, which the ADR defines well.
- It states any assumptions it makes in the same message.
Fail if it questions E1/E2 or drips questions.
