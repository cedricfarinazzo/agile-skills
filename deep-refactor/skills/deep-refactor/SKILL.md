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

**Loop until dry.** One sweep is never exhaustive: after acting on a pass, run another with fresh eyes on the areas the first pass only skimmed — a second pass over "already audited" code routinely surfaces defects the first missed. The exit condition is a pass that comes back empty, not a list that looks long enough.

Every agent follows three rules:

1. **Vet against change constraints before proposing.** For each candidate, enumerate what pins the current shape: test imports of private symbols, monkeypatch targets (patched names must stay module attributes read at call time), source-text guard tests (assertions on a file's literal source), object-identity assertions, error-message matches, coverage/omit config, module-path strings. A proposal ships with its **pin inventory** or it doesn't ship.
2. **Measure, don't infer.** "Parsed N× per call" comes from instrumentation; "unreachable branch" from proving both operands equal; "droppable dependency" from an import-blocking probe; "duplicate" from diffing the actual lines. A claim without its evidence is a hypothesis, not a finding.
3. **Classify honestly** into: **defects** (report first — they outrank refactors), **measured perf waste**, **safe under a frozen test suite**, **blocked by pins** (needs a test-edit-sanctioned ticket), and **deliberate — do not "fix"** (record why, so the next audit doesn't relitigate it).

## Phase 2 — Report

One synthesized report: defects, perf, dependency/image wins, safe backlog, blocked list — each item with exact `file:line`, its pin inventory, evidence, and effort. Publish it where the team can act on it. The report is the contract for everything after.

**Every count in the report is a measurement with a date, not a fact.** A report is a snapshot of a tree the train is about to change, so record each count *with the command that produced it and the commit it was taken at* — "47 call sites (`grep -rc …` at `abc1234`)", never a bare "47". The command is what makes the number re-derivable by whoever builds the car three merges later; the bare number is what silently goes wrong.

## Phase 3 — Ticket

Slice into a sequenced train, one ticket = one PR:

1. **Bug batch** — each fix gets a locking test for its (invariably untested) failing path.
2. **Correctness fixes whose test fixtures encode the bug** — fixture edits in scope, each enumerated.
3. **Infra/dependency diet** — with guard tests, because an image-only break is invisible to a unit suite.
4. **Behavior-preserving refactor tickets** — the default and the bulk of the train. The suite passes unchanged; reaching for a test edit here means the refactor is wrong, not the test. Readability is a deliverable, not a side effect: decompose monster functions in place (phase helpers, names bound in the same module), fix comments that lie about the code, and prefer the change a newcomer can follow. Pins preserved via aliases at the old path, re-export facades, and parameter injection (pass the patched object in; never import it into the new home).
5. **The structural ticket, last** — file/package splits and test moves. It alone may edit tests, and its ticket enumerates *every* sanctioned edit in advance. Any guard it must rewrite gets a **non-vacuity proof**: inject a violation, show the guard still fails, revert.

Every ticket links the report and lists its own out-of-scope items so nothing gets sneaked in.

**A ticket states the property and the command that derives its count — never a frozen literal.** Write "every site that calls `foo()` without a timeout (`rg -c …`)", not "the 47 sites". A literal count is correct only at the instant it was measured, has to be maintained by whoever moves the code, and is silently wrong until someone re-runs it — which, in a sequenced train, is guaranteed to be the person building the last car. The same applies to the effort figure: a saving is quoted as the benchmark that produced it, or it is quoted as an unknown.

## Phase 4 — Drain

- One branch per ticket off current main; implement in **isolated worktrees** when parallel (a shared checkout is how one agent's `git add -A` swallows another's work).
- Implementation rules restated to whoever implements: patched names stay module globals resolved at call time — no closure capture, no default-arg binding, no relocation; source-text-guarded regions are textually immovable; pinned signatures grow only optional keyword arguments.
- **Verify with the real workload, not static analysis.** Run the built artifact's actual command; exercise the actual code path. A third-party package can import a dependency lazily *inside a call* — invisible to every source scan, import probe, mocked unit and synthetic-data integration test. Before dropping a dependency, grep the installed packages that use it for call-time imports.
- **Everything the audit measured rots as the train advances** — each merged car shifts the files the next car's ticket cites *and changes the tree its counts described*. Two obligations, not one:
  - **Locate by content, never by the ticket's line number.**
  - **Re-derive every count, enumeration and baseline on the car's own branch point before planning it**, using the command the report recorded. Expect the number to have moved in either direction: an earlier car may have already fixed some sites, or introduced a second code path that widened the set. Quote deltas against the re-derived figure, never against the report's snapshot.

  A claim that no longer holds — the symbol is pinned after all, the file was already fixed, the set is now larger than the ticket says — is a *finding to report*, never a silent skip or a blind apply. Report it on the ticket before implementing, so the reviewer reads the corrected reading rather than the stale one.
- **Do not hand-roll the drain.** Each ticket goes through the project's normal implement → review → merge pipeline (`agile-10-implement` / `agile-11-merge-train` where installed), so every car carries the same validation, phase markers, review receipts and post-merge postmortem as any other ticket. An audit train is a *source of tickets*, never a parallel process with weaker evidence: a car that merges with no marker trail leaves the board unable to say how the change was reviewed, and that gap is invisible precisely because the code shipped fine.
- Merge only on a green CI run you verified yourself; sequential merges; rebase the next branch when file sets intersect.
- **Two identical CI failures are not a flake.** Diagnose from the actual logs and artifacts (a cancelled job means a hang — find what hung); fix on the branch with the diagnosis in the PR; announce any cross-PR interaction (e.g. a guard that must change once a sibling merges) in both PR bodies, then actually apply it.

## Work discovered mid-phase — do it, or ticket it properly

Every phase discovers work its ticket did not plan for. Two decisions, in order, and neither of them is "leave it in a comment":

**1. Do it now, or file it?**
- **Trivial and inside the current scope** → do it here. A one-line correction or a stale comment beside code you are already editing does not need its own ticket; filing one costs more than the fix.
- **Anything else** → a follow-up ticket: non-trivial, carrying risk, needing its own review, or reaching into files this work does not own. Never silently widen the diff to absorb it, and never let it survive only as prose in a PR body.

**2. Which backlog does it enter?**
- **The current sprint** — it blocks the sprint goal, it is a must-have, or a human asked for it.
- **The product backlog** — everything else, and this is the default. Pulling work into a running sprint is a scope change, not a convenience.

**Point it at creation.** A ticket minted mid-phase never passes back through the refinement skill, so if it is not sized here it is never sized at all, and the sprint's velocity figure silently stops describing the work delivered. Use the project's normal estimation scale; if it truly cannot be sized yet, label it `unsized` with a one-line reason rather than leaving the field empty by default.

## Definition of done

All tickets merged and closed; suite, coverage, lint and quality gates green on main; the report updated or superseded; every new lesson (a pin class you hadn't met, a probe that lied) written down where the next audit will find it.
