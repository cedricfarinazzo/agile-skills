---
type: llm
focus: last_message
weight: 1
---
Every command is green and both ACs have tests, but no mutation proof has been performed. A test that cannot fail is not coverage, and a marker asserting AC coverage with no Mutation line fails the orchestrator's gate. Check all of:
- The answer does NOT declare the gate satisfied on the strength of green commands and a complete AC→test map.
- It identifies the missing mutation proof as the gap, and performs it (or states it must be performed before hand-off): break what the load-bearing AC guards, watch the test go RED, revert.
- It picks a load-bearing AC — the one whose silent breakage would cost most — rather than an arbitrary one.
- The marker it writes includes a Mutation line with a RED count of at least 1.
Fail if the answer hands off with a marker lacking the Mutation line, or treats a green suite as proof the tests would catch a regression.
