---
type: llm
focus: last_message
weight: 1
---
Because the ticket is rejected, it must not be moved into progress. Check both:
- The answer does NOT claim a To Do to In Progress transition was applied, and does not include a "Transitioned: To Do -> In Progress" line.
- It either transitions the ticket to a needs-info status, or leaves it in To Do and applies a needs-info label.
Fail if the answer both rejects the ticket and also starts it.
