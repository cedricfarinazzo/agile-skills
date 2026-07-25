---
name: implement-code
description: "Sub-skill of agile-10-implement. Branch off base, implement the plan per ADR + Specs UI with full AC test coverage, finish only when the mode's gate is green, then commit and push. Does not open the PR. Also runs the fix pass for review findings. Not user-invoked."
user-invocable: false
---

# implement_code

Build phase for `agile-10-implement`. Invoked with a planned ticket — and, on a fix pass, the numbered review findings. Posts the `🤖 agile:phase=implement` marker. **Does not open the PR**; `implement-pr` does that after this phase returns.

**Build mode** — the orchestrator passes `mode=sequential | concurrent` (default `sequential`):
- **sequential** — the only phase that touches the shared Docker Compose stack, so it runs strictly one ticket at a time and runs the **full** gate locally.
- **concurrent** — runs inside a git worktree subagent alongside other builds. A worktree isolates the filesystem, but the stack is a **shared external resource**, so this phase must not touch it: run the **stack-free** gate only (lint + unit + typecheck + migration linearity) and **defer integration + e2e + apply-on-fresh-DB to CI**. Their AC tests are still *written*, just not executed here.

## Load the plan — implement *from* it

Read the `🤖 agile:phase=plan` comment on the ticket. That plan is what you implement: its files-to-touch, its order (data → service → API → frontend → tests), its AC→test map. Do not re-derive the approach. On a resumed run the orchestrator passes only the ticket key, so always read the plan from Jira and re-read the ADR / Specs UI for the detail it references. A forced deviation gets noted (and follows the reversible/critical rule below).

## Set up workspace and branch

`git checkout <base-branch> && git pull`, then create or reuse `<branch-prefix><TICKET>` branched **off `<base-branch>`** — never off another feature branch. Idempotent: `gh pr checkout` / `git checkout -B` only when no open PR branch exists for this ticket.

## Implement

- **Follow the ADR exactly.** No new pattern, library, or architectural decision without flagging it (PR body + a `🤖` Jira comment). Never silently deviate — and **implement every Specs UI state** (default / loading / empty / error / success), flagging deviations rather than silently "improving".
- **Cover every AC with a test** that exercises real behaviour, not the mock and not a restatement of the implementation. Each edge-case AC gets its own test.
- **A test's expected value comes from the system under test or an invariant — never a hand-guessed constant.** A number you reasoned out by hand can encode a wrong premise that passes locally and fails at the stack tier. Assert a relationship, or capture the value from the system as a golden.
- **Write the minimum that satisfies the spec — no slop, no dead code.** Match the surrounding file's idioms. No speculative abstraction, unused imports/variables/params, commented-out code, or "just in case" branches. A new file or export must be wired (imported, routed, referenced) or it is dead, and a change that makes existing code unreachable deletes it. Name from the PRD/ADR domain vocabulary. Comment only to state a constraint the code cannot.
- **A change to a shared symbol ripples — update every site in lock-step.** When you edit a shared type, query/mutation, function signature, fixture, or mock, grep the whole repo for its other construction and call sites. A targeted local test on the file you touched passes while full CI fails on an untouched site; the grep-then-fix is what closes that green-locally / red-in-CI gap.
- **Verify a runtime surface by exercising the flow, not just by green tests.** Green suites prove the covered code behaves; they do not prove the feature works. Drive the actual path — run the app, hit the endpoint, render the view — and observe the real result. A stale cache after a mutation, a missing affordance, an unwired handler: all pass every test. **Concurrent mode:** if that needs the shared stack, defer the runtime check to Phase 2 (`implement-monitor` holds the stack) or CI; a stack-free check (rendering a component, a CLI invocation) still runs in-worktree.

**Forced ADR-uncovered decision:** **reversible** → take the lower-risk option, post a `🤖` comment with the choice + rationale, flag it in the PR, keep going. **Critical** (irreversible / high blast radius — destructive migration, auth/security, breaking a shared contract, a new paid or infra dependency, data-loss risk) → stop and return `critical`; the orchestrator parks the ticket and escalates. Never guess a critical decision.

### Finish gate

Not done until all of these hold on the latest pushed commit. If any applicable gate fails, keep working (or return `critical`) — never return success and never hand off to `implement-pr`.

1. **All lint gates pass** — "lint" means *every command the CI lint job runs*, not just the formatter. CI lint jobs bundle extra checks (style/asset validators, i18n or dead-string checks, schema-drift and generated-file guards, bundle-size budgets, custom scripts): read the CI workflow and run each locally. Verify by **real exit code** — a piped or `xargs` exit can mask the tool's own status. A missed gate fails CI and **skips** the downstream jobs. *(both modes)*
2. **Stack-free tests green** — unit + typecheck, locally, with no skips or xfails hiding a failure. *(both modes)* If this project's "unit" tests actually hit the DB, they are not stack-free: say so and stop rather than running them in a worktree — the run needs `concurrency=1`.
3. **Stack-bound tests** — integration + e2e. **Sequential:** run locally and green. **Concurrent:** written but **deferred to CI**; record the deferral in the marker. CI's run on the open PR is their gate, enforced at merge by `agile-11-merge-train`'s fresh-CI-green hard gate.
4. **Every AC satisfied and test-covered** — walk the plan's AC→test map. An AC with no test means the gate is not met. *(both modes)*
5. **Migration history-linearity** (static, both modes) — if the change adds a migration, confirm the history resolves to a **single latest version**: no colliding or duplicate version identifiers, no two scripts sharing a parent. A split history makes the migrate step run an older or no-op version and **silently skip the new schema objects** while tests pass against a stale schema.
6. **Migration apply-on-fresh-DB** — apply on a clean database, confirm the expected objects exist, re-apply once for idempotency. **Sequential:** here. **Concurrent:** deferred to CI (5 is the local half).

## Fix pass (re-invoked after `implement-review`)

Fix **every** numbered finding — Critical *and* Minor; Minor is a severity, not a deferral. The only acceptable unfixed finding is one that would expand the diff into unrelated files: file a follow-up ticket inline and note it in the PR. Re-read the changed files afterwards (fixes introduce bugs), then re-run the mode's gate green.

## Commit and push

**Checkpoint early; the gate governs hand-off, not committing.** This phase can die mid-flight for reasons unrelated to the code — a session/usage limit, an API error, an OOM, a crash. With no commit, everything is stranded in the working tree, and in concurrent mode a re-dispatch spawns a **fresh** worktree off base, so the work is lost and the ticket restarts. So: **once the code compiles and the branch exists, commit a WIP checkpoint and push it** (`wip: <TICKET> …`, or amend as you go), then keep working toward the gate. Pushing early costs nothing — the PR is not opened until `implement-pr`, and the ticket only counts as handed off on the *gated* marker. Squash the WIP into the single intended conventional commit before hand-off, and never post the `🤖 implement` marker on a WIP push.

Final commit: conventional, with `Refs: <TICKET>` and the `Co-Authored-By` trailer in the body.

**Stage explicitly, then verify the commit captured every intended file** — two silent-omission traps each cost a green-locally / red-in-CI round trip:
- **A bad pathspec aborts the whole stage.** `git add a b c` where one path does not exist can stage *nothing*, yet a following commit of separately-staged files still succeeds and ships a partial change. Prefer `git add -A` (or real paths only), and after committing confirm `git status --porcelain` is empty of files belonging to this change. A leftover lockfile, generated file, or barrel/index export builds locally (your tree has it) and breaks CI (the branch does not).
- **A dependency and its lockfile travel together**, plus any index/barrel that re-exports new modules. A component committed without its dependency, or without being exported, compiles in your tree and fails on a clean checkout.

Confirm with `git show --stat HEAD` that every expected file is there and `git status` is clean. Only then post the marker.

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. The gate receipt — each command with its **real exit code**, plus any `DEFERRED TO CI` line — is what the orchestrator verifies against the pushed branch; a marker asserting green with no per-command exit codes fails the gate. Never delete prior markers.

```
🤖 <!-- agile:phase=implement --> **implement — agile-10-implement — <YYYY-MM-DD>**
Mode: <sequential | concurrent>
Gate receipt:
  lint:        <cmd>  → exit 0
  unit:        <cmd>  → exit 0
  integration: <cmd>  → exit 0   |   DEFERRED TO CI (concurrent — worktree cannot hold the stack)
  migration:   history-linear ✓  |  apply-on-fresh-DB → exit 0 | DEFERRED TO CI
AC coverage: <N>/<N> (stack-bound ACs: written, CI-gated)
<what was built/fixed>
```
