---
type: llm
focus: last_message
weight: 1
---
The user asked an open question about a ticket they wrote. The right response is ordinary feedback. Check all of:
- The answer gives its opinion of APP-402 in prose — what is good, what is thin, what it would add.
- It does NOT emit a build-gate verdict from the closed set `pass` / `rejected` / `out-of-scope` / `critical-park`.
- It does NOT produce a numeric readiness score out of 10 or a seven-criterion scored breakdown.
- It does NOT claim to have transitioned the ticket or posted a comment to Jira.
Fail if the response is a gate decision rather than an opinion.
