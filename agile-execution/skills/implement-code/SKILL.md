---
name: implement-code
description: "Sub-skill of agile-10-implement. Branch off the base/main branch, implement the plan per ADR + Specs UI with full AC test coverage, and finish only when all lint + all tests + every AC are green; then commit and push. Does not open the PR (that is implement-pr). Also runs the fix pass for review findings. Not user-invoked."
user-invocable: false
---

# implement_code

Build phase for `agile-10-implement` — the only phase that touches the shared Docker Compose stack, so it runs strictly one ticket at a time. Invoked via the Skill tool with a planned ticket (and, on a fix pass, the numbered review findings to address). Posts the `🤖 agile:phase=implement` marker.

## First: load the plan — implement *from* it

**Read the `🤖 agile:phase=plan` comment on the ticket** (written by `implement-plan`). That plan is what you implement — its files-to-touch, its implementation order (data → service → API → frontend → tests), and its AC→test map. Do not re-derive the approach from scratch. On a resumed run the orchestrator passes the ticket key, not the plan in-context, so always read the plan from Jira; re-read the ADR / Specs UI for the details it references. Then implement the plan in its order. If reality forces a deviation from the plan, note it (and follow the reversible/critical rule below).

## Set up workspace and branch

- `git checkout <base-branch> && git pull` to start from the current tip of `<base-branch>` — the **main branch** is the base for both the feature branch and the eventual PR.
- Create or reuse the feature branch `<branch-prefix><TICKET>`, branched **off `<base-branch>`** (never off another feature branch) — idempotent: `gh pr checkout` / `git checkout -B` only if no open PR branch already exists for this ticket.
- **Do not open the PR here.** Opening the pull request is `implement-pr`'s job, not this phase's. This phase only prepares the branch and implements; the orchestrator invokes `implement-pr` after this phase returns.

## Implement (non-negotiable rules)

- **Follow the ADR exactly.** No new pattern, library, or architectural decision without flagging it (PR body + a `🤖` Jira comment) — never silently deviate.
- **Implement every Specs UI state** (default / loading / empty / error / success), not just the happy path. Match the spec; flag deviations, never silently "improve".
- **Cover every AC with a test**; each edge-case AC gets its own test.
- **Name from the domain** (PRD / ADR vocabulary), not generic names.
- Run the project's **lint + unit + integration** suites locally and get them green before finishing. Do not push and hope CI catches it. This holds the shared stack — never run it concurrently with another ticket's build.

### Finish gate — only return when ALL three hold

This phase is **not done** until, on the latest pushed commit:
1. **All lint** passes (every configured linter/formatter, zero errors).
2. **All tests** pass green — **unit + integration**, run locally, no skips/xfails hiding a failure.
3. **Every AC is satisfied and test-covered** — walk the plan's AC→test map; each AC has a passing test that actually exercises it. An AC with no test, or a failing/red test, means the gate is **not** met.
4. **If the change adds a schema/DB migration: it applies cleanly on a fresh database, and the migration history stays linear with no conflicting versions.** A new migration that collides with an existing one (duplicate version identifier, or two scripts sharing a parent) can split the history so the migrate step runs only an older/no-op version and **silently skips the new schema objects** — while tests still pass against a stale schema. Confirm the history resolves to a single latest version, apply it on a clean database, confirm the expected objects exist, and re-apply once to confirm idempotency.

If any one fails, keep working (or return `critical` on a critical block) — do **not** return success and do not hand off to `implement-pr`. Only when all three hold do you commit, push, post the `🤖 implement` marker, and return — then the orchestrator runs `implement-pr` to open the PR.
- **Forced ADR-uncovered decision:** **reversible** → decide the lower-risk option, post a `🤖` comment with the choice + rationale, flag it in the PR, keep going. **Critical** (irreversible / high-blast-radius — destructive migration, auth/security, breaking shared contract, new paid/infra dependency, data-loss risk) → stop and return `critical` to the orchestrator (which parks the ticket and escalates one question). Never guess a critical decision.

## Fix pass (when re-invoked after `implement-review`)

Given the numbered findings, fix **every** one — Critical *and* Minor (Minor is a severity, not a deferral). The only acceptable unfixed finding is one that would expand the diff into unrelated files — file a follow-up ticket inline and note it in the PR. Re-read the changed files after fixing (fixes introduce bugs). Re-run lint + unit + integration green.

## Commit and push

Conventional commit; body includes `Refs: <TICKET>` and the `Co-Authored-By` trailer. Push the branch. (Commit/push is silent — no Jira marker; it is reconstructed from the pushed branch.) Then post `🤖 agile:phase=implement` summarising what was built/fixed and confirming the suites are green. Return to the orchestrator.

**Stage by explicit add, then verify the commit actually captured every intended file.** Two silent-omission traps cost a green-locally / red-in-CI round trip:
- **A bad pathspec aborts the whole stage.** `git add a b c` where one path does not exist (a typo, a lockfile that has a different name than you assumed) can fail and stage *nothing* — yet a following `git commit` of separately-staged files still succeeds, shipping a partial change. Prefer `git add -A` (or add real paths only), and after committing run `git status --porcelain` — it must be **empty of files that belong to this change**. A leftover modified/untracked manifest, lockfile, generated file, or barrel/index export is a silent omission that builds locally (your working tree has it) but breaks CI (the branch does not).
- **Dependency + lockfile must travel together.** If the change adds a dependency, the commit must include *both* the manifest and its lockfile, plus any index/barrel file that re-exports new modules. A component committed without its dependency, or without being exported, compiles in your tree and fails on a clean checkout.

Confirm the pushed branch is what you think: `git show --stat HEAD` lists every file you expected, and `git status` is clean. Only then post the marker.

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=implement --> **implement — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=implement -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
