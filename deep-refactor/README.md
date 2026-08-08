# deep-refactor

One skill: audit an entire codebase, then ticket and ship everything it finds — as a sequenced PR train that never breaks the test contract.

## The loop

| Phase | What happens | The discipline |
|---|---|---|
| **Audit** | Parallel read-only agents over disjoint areas + a mechanical scanner | Every proposal carries its **pin inventory** (test imports, patch targets, source-text guards, identity assertions) and its **evidence** (instrumented counts, import-blocking probes, real diffs) |
| **Report** | One synthesized document: defects / perf / dependency wins / safe backlog / blocked list | Defects outrank refactors; "deliberate — do not fix" items are recorded so they aren't relitigated |
| **Ticket** | Bug batch → fixture-encoded bugs → dependency diet (+ guard tests) → behavior-preserving refactors (zero test edits) → the structural ticket last (sanctioned test edits enumerated, weakened guards get non-vacuity proofs) | One ticket = one PR; every ticket lists its own non-goals |
| **Drain** | One branch per ticket, isolated worktrees for parallel work, sequential merges on self-verified green CI | Verify with the **real workload** — static probes miss call-time imports inside third-party code; two identical CI failures are a diagnosis, not a rerun |

## Install

Point Claude Code at this marketplace and install `deep-refactor`. Invoke with `/deep-refactor` or "audit and clean the codebase".

No external tooling assumed beyond `git`, a CI you can query, and your tracker of choice.
