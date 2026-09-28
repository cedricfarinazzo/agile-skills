---
type: llm
focus: last_message
weight: 1
---
The AC was corrected with evidence. Check all of:
- It reviews AC3 against the CORRECTED reading and binds it as satisfied (the `closed_at.is_(None)` filter in open_episodes + test_closed_episode_excluded), naming the correction comment.
- It does NOT flag a missing `closed` state as a Critical/missing AC.
- It verifies the correction's evidence rather than taking it on faith.
- AC3's binding names the spec-correction comment alongside its code location, so the record shows ticket text and delivered behaviour diverged.
- The receipt states the reviewed sha a09e5d1 and a Files-read list naming both diff files.
Fail if it raises a Critical for the stale `closed` wording.
