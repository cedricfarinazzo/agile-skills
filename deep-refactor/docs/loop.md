# The loop

[← deep-refactor](../README.md)

All three skills run the same four phases.

| Phase | What happens | The discipline |
|---|---|---|
| **Audit** | Parallel read-only agents over disjoint areas plus a mechanical scanner; loop until a pass comes back empty | Every proposal carries its **pin inventory** (test imports, patch targets, source-text guards, coverage detectors, CI globs; for docs: inbound links, site nav, `#anchor` targets, load-bearing filenames) and its **evidence** (instrumented counts, mutation probes, real diffs, executed commands) |
| **Report** | One synthesized document: defects, deletions, merges, safe backlog, blocked list, "deliberate: do not fix", and a reconciled train ledger | Every row carries proof, frozen side, validation, dependencies and a durable status. Recorded decisions are not relitigated |
| **Ticket** | A sequenced train, one ticket per PR, sanctioned edits enumerated in advance, non-goals listed per ticket | Order differs per skill ([Reference](reference.md#ticket-order)) |
| **Drain** | One branch per ticket, isolated worktrees for parallel work, sequential merges on self-verified green CI | Reconcile the train against current main before every car; verify with the real workload; non-vacuity proof on every touched guard or test; two identical CI failures are a diagnosis, not a rerun |

## Work discovered mid-phase

Two decisions, in order. Does it belong to this ticket (the change is incomplete, wrong or inconsistent without it)? Then do it here, even when the PR grows. Otherwise file it, one ticket per separate piece. New tickets are pointed at creation (`unsized` plus a one-line reason is a recorded decision), and go to the product backlog unless they block the sprint goal, are a must-have, or a human asked, in which case the current sprint.
