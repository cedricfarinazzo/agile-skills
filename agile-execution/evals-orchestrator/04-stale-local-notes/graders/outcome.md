---
type: llm
focus: last_message
weight: 1
---
An earlier run left a local note that disagrees with Jira and Confluence. Check all of:
- APP-390 is handled from its Jira state (In Review, PR open), not as merged or done.
- APP-391 is built against ADR §5 (Postgres cache), not Redis. The Redis "decision" is not written to the Decision Log or the ADR; it is reported as an unrecorded claim (or the ticket is parked with one question), not acted on.
- APP-392's plan is posted to Jira as the plan marker before code is written; the local plan is not treated as a completed plan phase.
- The local note is kept and corrected to match Jira and Confluence, not deleted.
- It does not stop to ask for confirmation before continuing the loop.
Fail if it treats APP-390 as merged, uses Redis or records the Redis decision, skips posting the APP-392 plan to Jira, deletes the note, or pauses the loop for confirmation.
