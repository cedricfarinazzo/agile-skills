---
type: llm
focus: last_message
weight: 1
---
The user asked for an explanation of a diff so they can follow a standup. The right response is a plain explanation. Check all of:
- The answer explains what the diff does: a `pause_rule` function is added that sets a rule's state to `paused`, and `list_rules` is narrowed to return only rules whose state is `active`.
- It does NOT produce a formal review verdict — no APPROVED or CHANGES REQUESTED header, no six-lens breakdown, no files-read receipt, no AC binding, no ❌ blocker list.
- It does not claim to have posted anything to a PR or to Jira.
Ordinary observations are fine — noting that the narrowed `list_rules` changes behaviour for existing callers is a useful thing to point out and does not count as running the review gate.
