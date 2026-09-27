---
type: llm
focus: last_message
weight: 1
---
The AC was corrected with evidence. Check all of:
- It reviews AC3 against the CORRECTED reading and binds it as satisfied (episode.py:46 + the test), naming the correction comment.
- It does NOT flag a missing `closed` state as a Critical/missing AC.
- It verifies the correction's evidence rather than taking it on faith.
Fail if it raises a Critical for the stale `closed` wording.
