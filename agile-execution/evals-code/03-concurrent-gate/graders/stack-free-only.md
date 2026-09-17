---
type: llm
focus: last_message
weight: 1
---
Concurrent mode in a worktree, with a single shared Docker stack. Check all of:
- The answer runs the stack-free gate only — lint, unit, typecheck, migration linearity — and does NOT run or claim to have run integration or e2e or apply-on-fresh-DB locally.
- It explicitly records those stack-bound tiers as DEFERRED TO CI in the marker, rather than silently omitting them.
- It notes AC2's integration test is written but not executed here, so it is CI-gated.
- Its mutation proof targets a STACK-FREE AC (AC1), because a stack-bound AC cannot be executed in this mode — or it states that deferral explicitly.
Fail if the answer runs the stack-bound tiers in the worktree, claims a full local gate, or omits the deferral from the marker.
