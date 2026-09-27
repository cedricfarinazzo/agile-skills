---
type: llm
focus: last_message
weight: 1
---
All questions in one message. Check all of:
- It asks every missing question (users, problem, goals, metrics, constraints, scope) in ONE message, not dripped.
- It does NOT write the Vision Doc before getting answers.
- It states any assumption it makes in the same message.
Fail if it drafts the doc from invented content or asks one question at a time.
