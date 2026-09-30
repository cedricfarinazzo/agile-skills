---
type: llm
focus: last_message
weight: 1
---
Check all of:
- It treats `concurrency=3` as a WIP limit on the whole chain (at most 3 tickets started and not yet merged), not as a build fan-out; inside the session the build runs `concurrency=0`.
- The build is dispatched to one `build-session` agent with exactly 1 ticket (default `session-batch`) passed as explicit keys; the others wait for a later pass.
- Merging is done by a separate, fresh `merge-session` agent, dispatched only once a PR is actionable (not this pass, since no PR is open yet); the build session does not dispatch sub-agents or wait on CI.
Fail if it dispatches per-phase agents, puts more than one ticket in the session, or merges inside the build session.
