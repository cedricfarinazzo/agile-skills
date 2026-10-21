# The loop

[← deep-refactor](../README.md)

All three skills run the same four phases.

| Phase | What happens | The discipline |
|---|---|---|
| **Audit** | Parallel read-only agents over disjoint areas (`deep-refactor` also runs a mechanical scanner); loop until a pass comes back empty | Every proposal carries its **pin inventory**: for `deep-refactor`, test imports, patch targets, source-text guards, coverage detectors and CI globs; for `test-refactor`, what depends on the tests (coverage detectors, CI globs, coverage-omit rules, meta-tests); for `doc-refactor`, inbound links, site nav, `#anchor` targets and load-bearing filenames and its **evidence** (instrumented counts, mutation probes, real diffs, executed commands) |
| **Report** | One synthesized document: defects, deletions, merges, safe backlog, blocked list, "deliberate: do not fix", and a reconciled train ledger | Every row carries proof, frozen side, validation, dependencies and a durable status. Recorded decisions are not relitigated. Published in Confluence, it goes in the project's `Extras` folder |
| **Ticket** | A sequenced train, one ticket per PR, sanctioned edits enumerated in advance, non-goals listed per ticket | Order differs per skill ([Reference](reference.md#ticket-order)) |
| **Drain** | One branch per ticket, isolated worktrees for parallel work, sequential merges on self-verified green CI | Reconcile the train against current main before every car; for `deep-refactor`, verify with the real workload; non-vacuity proof on every touched guard or test (`doc-refactor` proves with a per-file token diff and a render check); two identical CI failures are a diagnosis, not a rerun |

Each ticket goes through the project's normal pipeline (`agile-10-implement` and `agile-11-merge-train` where installed), so every car carries the same validation, markers, review receipts and postmortem as any other ticket. The drain is not hand-rolled.

## Work discovered mid-phase

Two decisions, in order. Does it belong to this ticket (the change is incomplete, wrong or inconsistent without it)? Then do it here, even when the PR grows. Otherwise file it, one ticket per separate piece. New tickets are pointed at creation (`unsized` plus a one-line reason is a recorded decision), and go to the product backlog unless they block the sprint goal, are a must-have, or a human asked, in which case the current sprint.
