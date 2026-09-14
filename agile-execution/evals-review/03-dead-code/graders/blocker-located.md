---
type: llm
focus: last_message
weight: 1
---
Blockers must be actionable, not gestures. Check all of:
- Each blocker is marked as a blocker (a ❌ or an explicit "blocker" label), distinct from any non-blocking warning.
- Each blocker names a location — a file, and a line or an identifier within it. "Security issue" or "the tests are weak" with no location fails.
- Each blocker says what to change, not only what is wrong.
Fail if the review reports its concerns only as warnings, or as prose with no location.
