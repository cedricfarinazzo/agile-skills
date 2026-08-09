---
name: deep-refactor
description: "Audit an entire codebase for defects, waste and debt, then ticket and ship the findings as a sequenced PR train — without breaking the test contract. Triggers: deep refactor, refactor audit, clean the codebase, DRY pass, audit and fix everything."
user-invocable: true
---

# deep-refactor

**The goal is code that is clean, DRY and easy to understand.** The existing test suite is the proof that behavior didn't move — which means **editing a test to make a refactor pass is cheating**: it silently rewrites the contract you're claiming to preserve. Treat every test edit as a red flag to design around (aliases, facades, injection), not a convenience. The rare edit that is genuinely warranted — a fixture that encodes a bug, a guard whose shape must follow a file split — is done in the open: enumerated in advance, justified per file, concentrated in one ticket.

Four phases: **audit → report → ticket → drain**. The discipline that makes it safe at scale: nothing is proposed until it has been vetted against the codebase's *change constraints*, and nothing is claimed until it has been measured or executed.

## Phase 1 — Audit

**Question the global architecture first.** Before hunting local smells, render a verdict on the big shapes — service boundaries, sync/async splits, dependency direction, layering — with evidence. "The architecture is sound; the debt is duplication and god-files" is a finding; so is the opposite. Either way the verdict scopes everything below, and a structural problem found here outranks every cleanup.

Then fan out **parallel read-only agents over disjoint areas** (one per subsystem: domain core, workers/jobs, API surface, build/dependency/config hygiene). Run a mechanical scanner (dead code / duplication / complexity) alongside for signal, not verdicts.

**Don't stop until you are satisfied of the entire codebase.** One sweep is never exhaustive: after acting on a pass, run another with fresh eyes on the areas the first pass only skimmed — a second pass over "already audited" code routinely surfaces defects the first missed. Stop only when a pass comes back empty (loop-until-dry), not when the first list looks long enough.

Every agent follows three rules:

1. **Vet against change constraints before proposing.** For each candidate, enumerate what pins the current shape: test imports of private symbols, monkeypatch targets (patched names must stay module attributes read at call time), source-text guard tests (assertions on a file's literal source), object-identity assertions, error-message matches, coverage/omit config, module-path strings. A proposal ships with its **pin inventory** or it doesn't ship.
2. **Measure, don't infer.** "Parsed N× per call" comes from instrumentation; "unreachable branch" from proving both operands equal; "droppable dependency" from an import-blocking probe; "duplicate" from diffing the actual lines. A claim without its evidence is a hypothesis, not a finding.
3. **Classify honestly** into: **defects** (report first — they outrank refactors), **measured perf waste**, **safe under a frozen test suite**, **blocked by pins** (needs a test-edit-sanctioned ticket), and **deliberate — do not "fix"** (record why, so the next audit doesn't relitigate it).

## Phase 2 — Report

One synthesized report: defects, perf, dependency/image wins, safe backlog, blocked list — each item with exact `file:line`, its pin inventory, evidence, and effort. Publish it where the team can act on it. The report is the contract for everything after.

## Phase 3 — Ticket

Slice into a sequenced train, one ticket = one PR:

1. **Bug batch** — each fix gets a locking test for its (invariably untested) failing path.
2. **Correctness fixes whose test fixtures encode the bug** — fixture edits in scope, each enumerated.
3. **Infra/dependency diet** — with guard tests, because an image-only break is invisible to a unit suite.
4. **Behavior-preserving refactor tickets** — the default and the bulk of the train. The suite passes unchanged; reaching for a test edit here means the refactor is wrong, not the test. Readability is a deliverable, not a side effect: decompose monster functions in place (phase helpers, names bound in the same module), fix comments that lie about the code, and prefer the change a newcomer can follow. Pins preserved via aliases at the old path, re-export facades, and parameter injection (pass the patched object in; never import it into the new home).
5. **The structural ticket, last** — file/package splits and test moves. It alone may edit tests, and its ticket enumerates *every* sanctioned edit in advance. Any guard it must rewrite gets a **non-vacuity proof**: inject a violation, show the guard still fails, revert.

Every ticket links the report and lists its own out-of-scope items so nothing gets sneaked in.

## Phase 4 — Drain

- One branch per ticket off current main; implement in **isolated worktrees** when parallel (a shared checkout is how one agent's `git add -A` swallows another's work).
- Implementation rules restated to whoever implements: patched names stay module globals resolved at call time — no closure capture, no default-arg binding, no relocation; source-text-guarded regions are textually immovable; pinned signatures grow only optional keyword arguments.
- **Verify with the real workload, not static analysis.** Run the built artifact's actual command; exercise the actual code path. A third-party package can import a dependency lazily *inside a call* — invisible to every source scan, import probe, mocked unit and synthetic-data integration test. Before dropping a dependency, grep the installed packages that use it for call-time imports.
- **Audit line references rot as the train advances** — each merged car shifts the files the next car's ticket cites. Implementers locate every target by content, never by the ticket's line number; a claim that no longer holds (the symbol is pinned after all, the file was already fixed) is a *finding to report*, never a silent skip or a blind apply.
- Merge only on a green CI run you verified yourself; sequential merges; rebase the next branch when file sets intersect.
- **Two identical CI failures are not a flake.** Diagnose from the actual logs and artifacts (a cancelled job means a hang — find what hung); fix on the branch with the diagnosis in the PR; announce any cross-PR interaction (e.g. a guard that must change once a sibling merges) in both PR bodies, then actually apply it.

## Definition of done

All tickets merged and closed; suite, coverage, lint and quality gates green on main; the report updated or superseded; every new lesson (a pin class you hadn't met, a probe that lied) written down where the next audit will find it.
