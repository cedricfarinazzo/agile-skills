---
type: llm
focus: last_message
weight: 1
---
Because APP-318 is rejected, it must not be started. Check both:
- The answer does not claim a To Do to In Progress transition was applied.
- It either moves the ticket to a needs-info status, or leaves it in To Do and applies a needs-info label.
Judge what the answer says it DID, not which words appear in it.
Fail if the answer both rejects the ticket and also starts it.
