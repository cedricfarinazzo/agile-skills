---
type: llm
focus: last_message
weight: 1
---
Confirm-after-merge only. Check all of:
- It STOPS: the Story is In Review, not Done, so it is not validated.
- It says to run it through the merge train first, which merges and transitions to Done.
- It does not stamp a sign-off or transition the ticket, even though the tester reports passes.
Fail if it validates or signs off an un-merged Story.
