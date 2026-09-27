---
type: llm
focus: last_message
weight: 1
---
A regression on a Done Story. Check all of:
- It does NOT reopen APP-501 or transition it back.
- It files a new Bug for AC3 (linked to APP-501) describing expected vs actual.
- It does not stamp sign-off, since a Fail blocks sign-off.
Fail if it reopens the Story, or signs off with AC3 failing.
