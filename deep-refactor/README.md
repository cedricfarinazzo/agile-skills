# <img src=".claude-plugin/icon.svg" width="40" alt="" align="top"> deep-refactor

Three skills sharing one discipline: audit deeply, prove every claim, ship as a sequenced PR train. Each freezes a different side of the repo as its proof.

**Codex:** install with `codex plugin add deep-refactor@agile-skills` and invoke `$deep-refactor`, `$test-refactor`, or `$doc-refactor`. See [the compatibility guide](../docs/CODEX_COMPATIBILITY.md) for runtime preflight and host differences.

- **`deep-refactor`** — audit an entire codebase and ship everything it finds, with the test suite as the frozen contract.
- **`test-refactor`** — the inverse: audit one test suite at a time (dead tests, duplication, parallel-unsafety, depth gaps), with production code frozen and coverage parity proven per module.
- **`test-refactor characterize <scope>`** — establish minimal owner-boundary behavior proof before a risky code cleanup, with production frozen; the resulting test becomes the later refactor's contract.
- **`doc-refactor`** — audit every markdown file (READMEs, `docs/`, agent-instruction files) for lies, drift, duplication and bloat, with the source frozen and every surviving claim verified rather than read.
- **`doc-refactor rules`** — audit the standing instruction corpus for redundant, stale, brittle, conflicting, or low-yield rules while preserving verified load-bearing invariants.

## The loop (all three skills)

| Phase | What happens | The discipline |
|---|---|---|
| **Audit** | Parallel read-only agents over disjoint areas + a mechanical scanner; loop until a pass comes back empty | Every proposal carries its **pin inventory** (test imports, patch targets, source-text guards, coverage detectors, CI globs; for docs: inbound links, site nav, `#anchor` targets, load-bearing filenames) and its **evidence** (instrumented counts, mutation probes, real diffs, executed commands) |
| **Report** | One synthesized document: defects / deletions / merges / safe backlog / blocked list / "deliberate — do not fix", plus a reconciled train ledger | Every row carries proof, frozen side, validation, dependencies, and a durable status; recorded decisions aren't relitigated |
| **Ticket** | Sequenced train, one ticket = one PR, sanctioned edits enumerated in advance, non-goals listed per ticket | `deep-refactor`: bugs first, structural splits last, zero test edits in between. `test-refactor`: deletions/merges → harness → parallel-isolation → runtime cost → depth, zero production edits throughout. `doc-refactor`: falsehoods → deletions → dedup → compression → gaps, file moves last, zero source edits throughout |
| **Drain** | One branch per ticket, isolated worktrees for parallel work, sequential merges on self-verified green CI | Reconcile the train against current main before every car; verify with the **real workload**; every touched guard or test gets a **non-vacuity proof** (inject a defect, watch it fail, revert); two identical CI failures are a diagnosis, not a rerun |

## test-refactor specifics

- One suite at a time — the user names the scope ("backend unit tests").
- Delete tests that test nothing: tests of the language or external libs called directly (your function calling the lib is fine), tautologies, mock echoes — each with evidence it covered nothing.
- Merge duplicate coverage into parametrized tests; parametrized cases are distinct coverage, not duplication; deepen critical paths.
- Profile-driven runtime cost: suite wall-clock + peak memory are baselined in the audit and gated per PR (measured before/after; a speedup never bought with coverage).
- **Single-parallel-run invariant**: the whole suite runs in one parallel invocation in the CI test job — parallelism conflicts are fixed by isolating the test (unique schemas/ports/dirs per worker, no shared state, no sleeps), never by splitting the run, serializing, or retrying.
- Keeping good coverage is a stated goal: per-module parity against the audit baseline gated per PR, depth additions on critical paths push it up — a cleanup that ends with less real coverage has failed.
- Before a deletion, an odd-looking test must clear the retention bar: name the regression it detects, any real callers of its seam, stronger surviving proof, and focused validation. “Looks coupled” is not deletion evidence.

## doc-refactor specifics

- Whole markdown surface at once — every `.md` inventoried with its **audience and load path**: human-browsed, rendered by a docs site, or auto-loaded into an agent's context.
- **A lie outranks every style improvement.** Dead commands, renamed flags, moved paths, 404 links and anchors are the top of the report and the first ticket in the train.
- **Verify, don't read**: commands run in a clean checkout, flags checked against `--help` or the parser, links fetched *and* anchor-checked, claims resolved against the code — never against the neighbouring doc that agrees.
- Duplication is collapsed to one home, except **deliberate replication** — a block that must exist verbatim in many files because nothing includes it at read time. That ships with a sync rule and a command proving every copy identical.
- Generated docs (docstring API refs, `--help` dumps, TOCs) are never hand-edited; fix the generator or declare the file hand-maintained.
- **Some markdown is executable** — `CLAUDE.md`, `AGENTS.md`, skill/agent frontmatter. Trigger phrases are never subtracted, every removal states what it governed, and the per-session token cost of auto-loaded files is baselined and gated like `test-refactor` gates wall-clock.
- Compression is proven by a **per-file** operative-token diff (commands, flags, config keys, MCP names) — a token surviving in another doc is not evidence this one kept it.
- In `rules` mode, every standing directive earns its permanent context cost: its behavioral impact is recorded and only evidence-backed redundancy, staleness, brittleness, misfiling, conflict, or low-yield ritual is changed.

## Install

Point Claude Code at this marketplace and install `deep-refactor`. Invoke with `/deep-refactor` or "audit and clean the codebase", `/test-refactor` or "refactor the backend unit tests", and `/doc-refactor` or "the docs are stale, audit every markdown file".

No external tooling assumed beyond `git`, a CI you can query, and your tracker of choice.
