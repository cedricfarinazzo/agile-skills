# deep-refactor

Two skills sharing one discipline: audit deeply, prove every claim, ship as a sequenced PR train.

- **`deep-refactor`** — audit an entire codebase and ship everything it finds, with the test suite as the frozen contract.
- **`test-refactor`** — the inverse: audit one test suite at a time (dead tests, duplication, parallel-unsafety, depth gaps), with production code frozen and coverage parity proven per module.

## The loop (both skills)

| Phase | What happens | The discipline |
|---|---|---|
| **Audit** | Parallel read-only agents over disjoint areas + a mechanical scanner; loop until a pass comes back empty | Every proposal carries its **pin inventory** (test imports, patch targets, source-text guards, coverage detectors, CI globs) and its **evidence** (instrumented counts, mutation probes, real diffs) |
| **Report** | One synthesized document: defects / deletions / merges / safe backlog / blocked list / "deliberate — do not fix" | Defects outrank refactors; recorded decisions aren't relitigated |
| **Ticket** | Sequenced train, one ticket = one PR, sanctioned edits enumerated in advance, non-goals listed per ticket | `deep-refactor`: bugs first, structural splits last, zero test edits in between. `test-refactor`: deletions/merges → harness → parallel-isolation → runtime cost → depth, zero production edits throughout |
| **Drain** | One branch per ticket, isolated worktrees for parallel work, sequential merges on self-verified green CI | Verify with the **real workload**; every touched guard or test gets a **non-vacuity proof** (inject a defect, watch it fail, revert); two identical CI failures are a diagnosis, not a rerun |

## test-refactor specifics

- One suite at a time — the user names the scope ("backend unit tests").
- Delete tests that test nothing: tests of the language or external libs called directly (your function calling the lib is fine), tautologies, mock echoes — each with evidence it covered nothing.
- Merge duplicate coverage into parametrized tests; parametrized cases are distinct coverage, not duplication; deepen critical paths.
- Profile-driven runtime cost: suite wall-clock + peak memory are baselined in the audit and gated per PR (measured before/after; a speedup never bought with coverage).
- **Single-parallel-run invariant**: the whole suite runs in one parallel invocation in the CI test job — parallelism conflicts are fixed by isolating the test (unique schemas/ports/dirs per worker, no shared state, no sleeps), never by splitting the run, serializing, or retrying.
- Keeping good coverage is a stated goal: per-module parity against the audit baseline gated per PR, depth additions on critical paths push it up — a cleanup that ends with less real coverage has failed.

## Install

Point Claude Code at this marketplace and install `deep-refactor`. Invoke with `/deep-refactor` or "audit and clean the codebase", and `/test-refactor` or "refactor the backend unit tests".

No external tooling assumed beyond `git`, a CI you can query, and your tracker of choice.
