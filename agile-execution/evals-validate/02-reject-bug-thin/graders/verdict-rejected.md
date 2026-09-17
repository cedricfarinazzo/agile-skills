---
type: llm
focus: last_message
weight: 1
---
The answer rejects APP-311 as not ready to build. Check all of:
- The stated verdict is `rejected` (needs info / back to refinement). Not pass, not out-of-scope, not critical-park.
- The rejection names the specific criteria that failed, not just a low total. At minimum it must call out that there is no persona summary, that there are no falsifiable Given/When/Then acceptance criteria (the ticket only says "Consider whether..."), and that there is no Definition of Done.
- It says what refinement must add in order for the ticket to pass.
Fail if the verdict is pass, or if the justification is only "score too low" with no named criteria.
