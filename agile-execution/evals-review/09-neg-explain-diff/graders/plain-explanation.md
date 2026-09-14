---
type: llm
focus: last_message
weight: 1
---
The user asked for an explanation of a diff so they can follow a standup. The right response is a plain explanation. Check both:
- The answer explains what the diff does: a `pause_rule` function is added that sets a rule's state to `paused`, and `list_rules` is narrowed to return only rules whose state is `active`.
- It does NOT run the formal review gate. Specifically it must NOT carry an APPROVED or CHANGES REQUESTED verdict header, a six-lens breakdown, a files-read receipt, a per-AC binding, a numbered ❌ blocker list, or a claim of having posted to a PR or to Jira.
Everything an engineer would normally say about a diff is fine and is NOT gating: noting risks, naming consequences for existing callers or existing rows, pointing out that there is no way to reverse the pause, flagging a missing migration, or listing things to raise at standup. Judge only whether the formal gate machinery listed above is present. A thoughtful explanation that surfaces several concerns still passes, as long as it is prose rather than a verdict.
