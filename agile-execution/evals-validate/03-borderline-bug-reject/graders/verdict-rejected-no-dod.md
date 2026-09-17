---
type: llm
focus: last_message
weight: 1
---
APP-318 is a Bug with four falsifiable acceptance criteria and a readiness total comfortably above 6, but it has no Definition of Done. A missing DoD is a hard gate regardless of the total. Check all of:
- The stated verdict is `rejected` (needs info / back to refinement).
- The reason given is specifically the absent Definition of Done, not a low readiness total. An answer that rejects because the score is too low, while the score it reports is 6 or above, is incoherent and fails.
- The answer does not reject for the absent persona or the absent ADR reference. Those may be scored down, but a Bug legitimately has no user persona, and neither is grounds for rejection on its own.
- The acceptance criteria are credited as falsifiable, quoting at least one (for example AC1's "Reproduce it deterministically before changing anything" or AC3's "State the `repeat:` count that proves the fix").
Fail if the verdict is pass, out-of-scope, or critical-park.
