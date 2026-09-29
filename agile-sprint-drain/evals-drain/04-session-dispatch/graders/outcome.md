---
type: llm
focus: last_message
weight: 1
---
Check all of:
- It states that `concurrency=3` is ignored under `dispatch=session` and the build runs at concurrency 1 (`concurrency=0` inside the session).
- The build is dispatched to one `build-session` agent with exactly 1 ticket (default `session-batch`); the other 4 wait for a later pass.
- Merging is done by a separate, fresh `merge-session` agent — never the same agent as the build session, and the build session does not dispatch sub-agents.
Fail if it dispatches per-phase agents, puts more than one ticket in the session, or merges inside the build session.
