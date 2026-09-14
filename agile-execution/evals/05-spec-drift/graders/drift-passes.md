---
type: llm
focus: last_message
weight: 1
---
APP-241's AC3 refers to an episode state `closed`, but the source inlined in the ticket defines only `("armed", "fired")`, with closure expressed as `closed_at IS NOT NULL`. A reference that has drifted from the code is not a readiness failure. Check all of:
- The stated verdict is `pass`.
- The answer explicitly flags the mismatch: AC3 names a state that does not exist.
- It treats this as spec drift / a stale or broken reference whose correction belongs to the planning phase, not as a reason to reject.
- It judges AC3 on whether it is falsifiable (it is: an episode must be excluded from `openEpisodes` once closed), rather than on whether the identifier resolves.
Fail if the ticket is rejected or sent back for refinement, and fail if the drift goes unmentioned.
