---
type: llm
focus: last_message
weight: 1
---
An out-of-scope ticket is correctly specified, just not for this repo, so nothing may be done to it here. Check both:
- The answer does not apply, and does not claim to have applied, any status transition. APP-260 stays in `To Do`.
- The answer does not apply, and does not claim to have applied, a needs-info label, and does not send the ticket back to refinement.
Judge what the answer says it DID, not which words it uses. Stating "no transition and no needs-info label — the ticket stays in To Do" is the CORRECT behaviour and passes. Only an answer that actually moves the ticket or labels it fails.
