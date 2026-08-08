---
name: test-refactor
description: "Audit one test suite at a time for dead weight, duplication and parallel-unsafety, then ticket and ship the cleanup as a PR train — with production code frozen and coverage proven, not assumed. Triggers: test refactor, clean the tests, refactor the tests, test suite audit, DRY the tests, parallelize the test suite."
user-invocable: true
---

# test-refactor

The sibling of `deep-refactor`, with the contract inverted. There, the test suite is the frozen proof that a refactor preserved behavior. Here the tests **are** the object of change — so the frozen side is **production code** (a test refactor that "needs" a production edit is out of scope; a real defect a test uncovers is reported and ticketed separately, never smuggled into a test PR), and the proof that rigor survived is **measured**: per-module coverage parity plus a demonstration that every touched test can still fail.

**The goal is a suite that is clean, DRY, easy to understand — and worth trusting.** A test that cannot fail, or that fails without naming what broke, is worse than no test: it spends CI time buying false confidence.

**One suite at a time.** The user names the scope (e.g. "backend unit tests", "frontend component tests", "integration"). Everything outside it is untouchable this run; cross-suite findings go in the report as follow-ups.

Four phases: **audit → report → ticket → drain**.

## Phase 1 — Audit

Fan out parallel read-only agents over disjoint slices of the suite, plus one pass over the harness itself (fixtures, conftest/setup files, CI test job, coverage config). **Don't stop until you are satisfied of the entire suite**: after acting on a pass, run another with fresh eyes; stop only when a pass comes back empty (loop-until-dry).

Classify every test — no test is skipped because it looks fine:

1. **Tests nothing — delete.** Tests of the language, the standard library, or an external library called directly (a test of *your* function that happens to call the library is fine — that tests your integration); tautologies (asserting a value equals the value just constructed); mock echoes (asserting a mock returned what it was told to return); assertion-free tests that pass by not crashing when crashing was never the risk. Each deletion ships with its category and the **evidence it covered nothing**: show the assertion cannot fail, or mutate the subject and show the test stays green.
2. **Duplicate coverage — merge.** Same subject, same behavior, different copies: fold into one parametrized test. **Parametrization is not duplication** — cases that differ in inputs are distinct coverage; add missing cases while you're there. But never fuse tests of *different behaviors* into one mega-test: a failure must name its scenario, so one behavior = one test (or one parametrized family with self-describing ids).
3. **Load-bearing but odd-looking — verify, then leave.** Regression locks, source-text guards, non-vacuity meta-tests, coverage link-imports, seams kept for patching: check history and tickets before touching, and record *why it stays* so the next audit doesn't relitigate it. A test you can't explain is a research item, not a deletion candidate.
4. **Shallow on critical paths — deepen.** Identify the platform-critical modules; a happy-path-only test on one is a finding. Add edge cases, failure paths, boundary values, property-based tests where they pay. Depth on what matters outranks breadth on what doesn't.
5. **Unreadable or WET — refactor.** Copy-paste setup becomes shared fixtures, factories, builders. But **locality beats indirection**: a reader must see what a test asserts without chasing five fixtures, and a test must contain **no logic** — a loop or conditional that computes the expected value re-implements the subject and inherits its bugs. Explicit expected values, self-describing names, one assertion story per test.

**Pins run the other way here.** Enumerate what depends on the tests before moving them: coverage detectors keyed on static test imports, CI selection globs and naming conventions, per-file coverage-omit rules, meta-tests that scan test source, docs referencing test names. A rename or move ships with that inventory or it doesn't ship.

**Measure, don't infer.** "Duplicate" comes from diffing assertions, not titles; "covers nothing" from a mutation the test survived; "flaky" from repeated runs, not reputation; coverage claims from per-module before/after reports, never the global percentage alone (a global number hides a module dropping to zero).

## Phase 2 — Report

One synthesized document: deletions (each with category + evidence), merges, harness findings, parallel-unsafety inventory, critical-path depth gaps, the load-bearing list, and any production defects the audit uncovered (reported, not fixed). Per-module coverage baseline attached — it is the yardstick every later PR is measured against. Publish where the team can act on it.

## Phase 3 — Ticket

One ticket = one PR, sequenced:

1. **Deletions and merges** — every removed or fused test enumerated in the ticket in advance. Coverage parity proven per module in the PR, not asserted.
2. **Harness and fixture consolidation** — shared fixtures, factories, dead fixtures removed, setup dedup. Behavior of every surviving test unchanged.
3. **Parallel-isolation fixes** — see the invariant below; one ticket owns making the whole suite safe in a single parallel run.
4. **Depth additions last** — new tests for critical-path gaps, so they land on the cleaned suite.

Every ticket lists its own out-of-scope items. Production-code diff in every PR is **empty**, verified mechanically (diff the production paths — zero lines), except a separately-ticketed defect fix that is its own PR.

## Phase 4 — Drain

- One branch per ticket off current main; isolated worktrees when parallel.
- **The single-parallel-run invariant.** The whole suite runs in **one parallel invocation in the CI test job**. Never solve a parallelism conflict by splitting the run, serializing a subset, quarantining a file, or adding retries — fix the test's isolation instead: unique temp dirs, ports, database schemas/transactions per worker; no shared mutable globals; no fixed resource names; condition-based waits, never sleeps. Prove order-independence by running with randomized order and full parallelism locally before pushing. A test that only passes serially, in a fixed order, or on retry is a defect with a diagnosis, not an inconvenience with a workaround.
- **Non-vacuity on everything you touched.** A merged, parametrized, or rewritten test is proven able to fail: inject a defect in its subject, watch it go red, revert. A cleanup PR whose tests all still pass proves nothing by itself — green-after-deletion is exactly what a botched deletion looks like.
- Coverage gate per PR: per-module coverage at or above the Phase-2 baseline. A drop is a blocker, not a footnote.
- Merge only on a green CI run you verified yourself; sequential merges; rebase the next branch when file sets intersect. Two identical CI failures are a diagnosis, not a rerun.

## Definition of done

Suite green in one parallel CI run; per-module coverage ≥ the baseline; every deletion enumerated with evidence; zero production-code changes in the train; the report updated; every new lesson (a pin class you hadn't met, a flake signature, an isolation trick) written down where the next audit will find it.
