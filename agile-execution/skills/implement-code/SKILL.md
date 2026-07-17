---
name: implement-code
description: "Sub-skill of agile-10-implement. Branch off base/main, implement the plan per ADR + Specs UI with full AC test coverage; finish only when all lint + tests + every AC are green, then commit and push. Does not open the PR (implement-pr does). Also runs the fix pass for review findings. Not user-invoked."
user-invocable: false
---

# implement_code

Build phase for `agile-10-implement`. Invoked via the Skill tool with a planned ticket (and, on a fix pass, the numbered review findings to address). Posts the `🤖 agile:phase=implement` marker.

**Build mode (passed by the orchestrator):**
- **sequential** (`concurrency=1`, default) — this is the only phase that touches the shared Docker Compose stack, so it runs strictly one ticket at a time and runs the **full** gate locally (lint + unit + integration + apply-on-fresh-DB).
- **concurrent** (`concurrency>1`) — runs inside a **git worktree subagent** alongside other tickets' builds. A worktree isolates the filesystem, but the Docker stack is a **shared external resource**, so this phase **must not touch it**: run only the **stack-free** gate locally (lint + unit + typecheck + migration history-linearity) and **defer the stack-bound tiers (integration + e2e + apply-on-fresh-DB) to CI**. The AC tests for those tiers are still **written** — just not executed here.

## First: load the plan — implement *from* it

**Read the `🤖 agile:phase=plan` comment on the ticket** (written by `implement-plan`). That plan is what you implement — its files-to-touch, its implementation order (data → service → API → frontend → tests), and its AC→test map. Do not re-derive the approach from scratch. On a resumed run the orchestrator passes the ticket key, not the plan in-context, so always read the plan from Jira; re-read the ADR / Specs UI for the details it references. Then implement the plan in its order. If reality forces a deviation from the plan, note it (and follow the reversible/critical rule below).

## Set up workspace and branch

- `git checkout <base-branch> && git pull` to start from the current tip of `<base-branch>` — the **main branch** is the base for both the feature branch and the eventual PR.
- Create or reuse the feature branch `<branch-prefix><TICKET>`, branched **off `<base-branch>`** (never off another feature branch) — idempotent: `gh pr checkout` / `git checkout -B` only if no open PR branch already exists for this ticket.
- **Do not open the PR here.** Opening the pull request is `implement-pr`'s job, not this phase's. This phase only prepares the branch and implements; the orchestrator invokes `implement-pr` after this phase returns.

## Implement (non-negotiable rules)

- **Follow the ADR exactly.** No new pattern, library, or architectural decision without flagging it (PR body + a `🤖` Jira comment) — never silently deviate.
- **Implement every Specs UI state** (default / loading / empty / error / success), not just the happy path. Match the spec; flag deviations, never silently "improve".
- **Cover every AC with a test**; each edge-case AC gets its own test. The test must exercise real behaviour, not assert the mock or restate the implementation.
- **Name from the domain** (PRD / ADR vocabulary), not generic names.
- **Write the minimum that satisfies the spec — no slop, no dead code.** Match the surrounding file's style + idioms; no speculative abstraction, unused imports/variables/params, commented-out code, or "just in case" branches. A new file/export must be wired (imported, routed, referenced) or it is dead — and a change that makes existing code unreachable deletes it rather than leaving it. Comment only to state a constraint the code can't; never to narrate the diff.
- **A change to a shared symbol ripples — update every site, not just yours.** When you edit a shared type/interface, a query/mutation, a function signature, a fixture, a mock, or anything other code constructs or references, grep the whole repo for its other construction / mock / call sites and update them in lock-step. A targeted local test on the file you touched passes while the full CI suite fails on an untouched site — that green-locally / red-in-CI gap is exactly what the grep-then-fix prevents.
- **For a change with a runtime surface, verify it by exercising the flow — not just green tests.** Green unit + integration proves the covered code behaves; it does not prove the feature *works*. Drive the actual path the change affects (run the app / hit the endpoint / render the view) and observe the real result before finishing. Bugs that pass every test but fail in use — a stale cache after a mutation, a missing affordance, an unwired handler — are caught here, not in the suite.
- Run the mode's test tiers locally and get them green before finishing. Do not push and hope CI catches what you could run. **Sequential:** run the **lint + unit + integration** suites (this holds the shared stack — never run it concurrently with another ticket's build). **Concurrent:** run the **stack-free** tiers only (lint + unit + typecheck); the stack-bound tiers defer to CI (below).

### Finish gate — only return when every applicable gate holds

This phase is **not done** until, on the latest pushed commit:
1. **All lint gates** pass — "lint" means *every command the CI lint job runs*, not just the formatter. CI lint jobs often bundle extra checks (style/asset validators, i18n / dead-string, schema-drift & generated-file guards, bundle-size budgets, custom scripts); read the CI workflow and run each locally. Verify by **real exit code** — a piped/`xargs` exit can mask the tool's own status. A green formatter is not a green lint job, and a missed gate fails CI and **skips** the downstream jobs. *(stack-free — runs in both modes)*
2. **Stack-free tests** pass green — **unit** (+ typecheck), run locally, no skips/xfails hiding a failure. *(both modes)*
3. **Stack-bound tests** — **integration + e2e.** **Sequential:** run them locally and green (they hold the shared stack). **Concurrent:** do **not** run them here (a worktree can't hold the stack) — the tests are still **written** to cover their ACs, but execution **defers to CI**; record the deferral in the marker. CI's run on the open PR is their gate (enforced at merge by `agile-11-merge-train`'s fresh-CI-green hard gate).
4. **Every AC is satisfied and test-covered** — walk the plan's AC→test map; each AC has a test that actually exercises it (passing locally for stack-free ACs; written-and-CI-gated for stack-bound ACs). An AC with no test means the gate is **not** met. *(both modes)*
5. **Migration history-linearity** (static, stack-free — **both modes**): if the change adds a schema/DB migration, confirm the history resolves to a **single latest version** with no colliding/duplicate version identifiers and no two scripts sharing a parent. A split history makes the migrate step run only an older/no-op version and **silently skip the new schema objects** while tests pass against a stale schema.
6. **Migration apply-on-fresh-DB** (stack-bound): apply it on a clean database, confirm the expected objects exist, re-apply once to confirm idempotency. **Sequential:** do it here. **Concurrent:** defer to CI (needs the stack) — the linearity check (5) is the local half; the fresh-DB apply is the CI half.

If any applicable gate fails, keep working (or return `critical` on a critical block) — do **not** return success and do not hand off to `implement-pr`. Only when every applicable gate holds do you commit, push, post the `🤖 implement` marker (with the gate receipt — each gate command + its real exit code, and the concurrent tier-deferral note), and return — then the orchestrator runs `implement-pr` to open the PR.
- **Forced ADR-uncovered decision:** **reversible** → decide the lower-risk option, post a `🤖` comment with the choice + rationale, flag it in the PR, keep going. **Critical** (irreversible / high-blast-radius — destructive migration, auth/security, breaking shared contract, new paid/infra dependency, data-loss risk) → stop and return `critical` to the orchestrator (which parks the ticket and escalates one question). Never guess a critical decision.

## Fix pass (when re-invoked after `implement-review`)

Given the numbered findings, fix **every** one — Critical *and* Minor (Minor is a severity, not a deferral). The only acceptable unfixed finding is one that would expand the diff into unrelated files — file a follow-up ticket inline and note it in the PR. Re-read the changed files after fixing (fixes introduce bugs). Re-run the mode's gate green (sequential: lint + unit + integration; concurrent: stack-free tiers, integration/e2e re-checked by CI).

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
Mode: <sequential | concurrent>
Gate receipt:
  lint:        <cmd>  → exit 0
  unit:        <cmd>  → exit 0
  integration: <cmd>  → exit 0   |   DEFERRED TO CI (concurrent — worktree cannot hold the stack)
  migration:   history-linear ✓  |  apply-on-fresh-DB → exit 0 | DEFERRED TO CI
AC coverage: <N>/<N> (stack-bound ACs: written, CI-gated)
<what was built/fixed>
```

A comment that omits `<!-- agile:phase=implement -->` is invisible to resume — the phase will look unfinished and re-run. The gate receipt (each command + real exit code, and any `DEFERRED TO CI` line) is what the orchestrator verifies against the pushed branch; a marker asserting green with no per-command exit codes fails the gate. Never delete prior markers.
