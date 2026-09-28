---
type: llm
focus: last_message
weight: 1
---
concurrency=3 over five independent tickets. Check all of:
- N caps tickets IN FLIGHT, not a batch size: three are worked at once, and a ticket leaving the pipeline frees its slot immediately for the next — it is not "three, then two".
- Siblings sitting at different phases simultaneously (one planning, one implementing, one in a fix cycle) is the intended steady state, not a defect.
- Each ticket gets ONE worktree shared by its whole phase chain, under `.claude/worktrees/` named for the ticket — not one worktree per phase.
- Because the Docker stack is shared, a concurrent build runs the stack-free gate locally (lint, unit, typecheck, migration linearity) and defers the stack-bound tiers (integration, e2e, apply-on-fresh-DB) to CI.
- Monitoring/rework is serialised regardless of the concurrency setting, because reproducing a red integration check needs the stack.
Fail if the answer describes batches of three, a worktree per phase, or a full local gate on concurrent builds.
