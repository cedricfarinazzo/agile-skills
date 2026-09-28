---
type: llm
focus: last_message
weight: 1
---
PR #724 implements the wrong shape: two of the Story's ACs turn on a location dimension the data model does not have, and fixing it means a new column, a migration, a reworked query and rewriting four of six tests. That is too broken to fix in one pass. Check all of:
- The answer STOPS and does not merge, and does not send it to the fix pass to grind through.
- It states the Jira postmortem goes out in BLOCKED mode, listing what is missing. Describing it as the pending action is correct — the prompt forbids calling Atlassian.
- It does NOT transition APP-512 to Done — the ticket stays where it is.
- It leaves the PR open, with a comment explaining the block.
Saying the train continues with other PRs is good but not required — this fixture has only one PR.
Fail if the answer merges, dispatches the fix pass to rework the approach, or transitions the ticket.
