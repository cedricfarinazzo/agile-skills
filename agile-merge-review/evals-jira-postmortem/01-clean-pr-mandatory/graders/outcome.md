---
type: llm
focus: last_message
weight: 1
---
A clean PR still gets the postmortem. Check all of:
- It does NOT skip because "nothing went wrong".
- The comment opens with the literal `🤖 <!-- agile:phase=post_merge -->` and includes a "What was correct" section.
- It transitions APP-631 to a done-category status (discovering the transition, not a hardcoded id) and reads the status back to confirm.
- The receipt records `collisions recorded: none` (the empty list is "checked, none").
Fail if it skips the comment or the transition, or omits the marker.
Describing the Jira calls as the pending action, rather than performing them, is correct — the prompt forbids calling Atlassian.
