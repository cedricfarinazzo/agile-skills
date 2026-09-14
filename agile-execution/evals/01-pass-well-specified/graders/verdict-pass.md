---
type: llm
focus: last_message
weight: 1
---
The answer validates APP-204 and reaches a PASS verdict. Check all of:
- The stated verdict is `pass` (the ticket may enter the build pipeline). Not `rejected`, not `out-of-scope`, not `critical-park`.
- A readiness total is given and it is 6 or above out of 10.
- The answer does not ask the user a question or request confirmation before deciding.
Fail if the verdict is anything other than pass, if no total is given, or if it defers the decision to a human.
