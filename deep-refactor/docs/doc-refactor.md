# doc-refactor

[← deep-refactor](../README.md)

Audits every markdown file (READMEs, `docs/`, agent-instruction files) for lies, drift, duplication and bloat, with the source frozen and every surviving claim verified rather than read.

## What it does

- **Inventories the whole surface**, each file with its audience and load path: human-browsed, rendered by a docs site, or auto-loaded into an agent's context.
- **Puts lies first.** A lie outranks every style improvement. Dead commands, renamed flags, moved paths, 404 links and anchors top the report and are the first ticket in the train.
- **Verifies, doesn't read.** Commands run in a clean checkout, flags are checked against `--help` or the parser, links are fetched and anchor-checked, claims are resolved against the code, never against a neighbouring doc that agrees.
- **Collapses duplication to one home**, except deliberate replication: a block that must exist verbatim in many files because nothing includes it at read time. That ships with a sync rule and a command proving every copy identical.
- **Never hand-edits generated docs** (docstring API refs, `--help` dumps, TOCs). Fix the generator or declare the file hand-maintained.

## Executable markdown

`CLAUDE.md`, `AGENTS.md` and skill or agent frontmatter are code. Trigger phrases are never subtracted, every removal states what it governed, and the per-session token cost of auto-loaded files is baselined and gated, like `test-refactor` gates wall-clock.

## `doc-refactor rules`

Audits the standing instruction corpus for redundant, stale, brittle, misfiled, conflicting or low-yield rules, preserving verified load-bearing invariants. Every directive earns its permanent context cost: its behavioral impact is recorded, and only evidence-backed changes are made.
