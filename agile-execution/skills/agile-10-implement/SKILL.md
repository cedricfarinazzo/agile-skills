---
name: agile-10-implement
description: "Autonomously build the active sprint/board (never backlog/future) in Jira dependency order — validate → plan → code → pr → review → monitor per ticket, each to In Review with an open PR. Optional concurrency=N. Triggers: implement the sprint, work the sprint, pick up tickets, implement story PROJ-XXX, start coding."
---

# agile_10_implement

Autonomous, end-to-end sprint implementation pipeline — the agile-side analogue of `agile-11-merge-train`, modelled on the `nightshift jira run` loop. It is an **orchestrator**: it selects the board's work, orders it by Jira dependency, and drives each ticket from `To Do` to `In Review` with an open, self-reviewed PR by **composing the `implement-*` sub-skills** — without stopping to ask between steps.

`agile-11-merge-train` clears the **merge** queue (open PR → `main`) by composing `merge-update-pr` / `merge-review-pr` / `merge-fix-until-satisfied` / `merge-jira-postmortem`. This skill clears the **build** queue (`To Do` Story → open PR) by composing its own sub-skills. The two compose end-to-end: this skill produces the PRs that the merge train later reviews and merges.

## Sub-skills (each dispatched to a scoped agent — never inline their logic)

Per ticket, in order. Each maps to one 🤖 resume-marker phase; each runs in the named `agile-execution:*` subagent (which invokes the sub-skill via the Skill tool, at the model/effort scoped to that phase's actual workload) and returns a verifiable receipt — not reimplemented in the orchestrator. If one needs improvement, edit *that* sub-skill (the agent body only points at it, it doesn't restate it). When `concurrency=0` (see below), every phase instead runs inline via the Skill tool — no agent dispatch at all.

| Phase | Sub-skill | Agent | Does |
|-------|-----------|-------|------|
| validate | `implement-validate` | `agile-execution:ticket-validator` | repo-scope + readiness gate; pass / reject(Needs Info) / out-of-scope / critical-park |
| plan | `implement-plan` | `agile-execution:ticket-planner` | read ADR/Specs/PRD/bugs → concrete plan + AC→test map |
| implement | `implement-code` | `agile-execution:build-implementer` | branch off base/main, implement per ADR/Specs, all-AC tests, gate green (sequential: lint+unit+integration; concurrent: stack-free tiers local, integ+e2e→CI), commit, push — finishes only when the mode's gate + every AC pass. Does **not** open the PR |
| pr | `implement-pr` | `agile-execution:pr-publisher` | **open** (off base/main) or update the PR linked to the ticket |
| review | `implement-review` | inline by default (single read, no dispatch); `agile-execution:review-lens` only for a large PR, fanned out directly by this orchestrator — no intermediate review agent | six-lens self-review; verdict + numbered blockers |
| (monitor) | `implement-monitor` | `agile-execution:build-monitor` | PR rework loop — new review comments, failing checks, conflicts |

## Goal & non-goals

**Goal:** every eligible `To Do` Story in the active sprint ends the run as an open PR that has been validated against its spec, implemented per the ADR, self-reviewed across six lenses, and transitioned to `In Review` — in Jira dependency order, with a `🤖` comment trail documenting every phase for resume.

**Non-goals:** merging to `main` (that is `agile-11-merge-train`); inventing scope not in the Story; working backlog or future-sprint tickets; transitioning anything to `Done` (that is QA, skill 14); forcing a blocked or under-specified ticket through the pipeline.

This skill exists to do careful work unattended, not to race. If a ticket is ambiguous, the validation gate sends it back rather than guessing the spec into existence.

## Autonomy contract

A user who invokes this skill (or says "implement the sprint", "work the sprint", "pick up tickets") has **authorised the full per-ticket pipeline for every eligible ticket in the queue**. Do not pause for confirmation between phases or between tickets. The only authorised stops are the explicit **Stop conditions** at the bottom of this file, and the per-ticket validation gate (which skips one ticket, not the run).

When in doubt about a *spec* (what to build), the validation gate decides: pass → infer-and-flag and proceed; fail → comment, send back, skip the ticket, continue the loop. When in doubt about an *action* (whether to run the pipeline), you are already authorised — proceed.

### The only thing worth asking a human: a critical decision

Default to autonomy. Decide and document everything reversible — naming, internal structure, test approach, a standard pattern from the ADR, an HTTP status, a reversible mid-implementation choice. **Flag these in the PR; never stop for them.**

Escalate to the user **only** when a decision is *critical* — meaning it is **both** hard-to-reverse / high-blast-radius **and** genuinely not derivable from the ADR / PRD / Specs / existing code. Concretely, a critical decision is one like:
- a destructive or non-backward-compatible **data migration** (drop/rewrite a column, irreversible backfill)
- changing the **security / auth / permission model**, or anything touching secrets / access control
- a breaking change to a **public API or shared contract** other services depend on
- introducing a **new external dependency, paid service, or infra/cost commitment** not in the ADR
- deleting or rewriting a shared component in a way that affects other tickets/services
- any action whose downside, if the guess is wrong, is data loss, a security hole, or production breakage that a later PR can't cleanly undo

When you hit one: do **not** guess. Pause **that ticket only** — post a `🤖` comment on the Jira ticket stating the decision, the options, and your recommendation, then ask the user **one consolidated question** (batch every critical decision for that ticket into a single message). Keep the loop alive: move on to other eligible tickets while waiting, and resume the parked ticket when the user answers (resume via its markers). Never block the whole run on one critical decision, and never escalate a merely-reversible choice — that is noise.

A genuinely-critical decision that the user has not answered by the time the run ends is reported as **Blocked (awaiting decision)**, not silently guessed.

## Orchestrator = dispatch-and-verify (the main agent does no work itself)

**The main agent orchestrates; it never does a step's work in its own context.** Every phase runs in its named `agile-execution:*` subagent (table above; inline via the Skill tool instead, only under `concurrency=0`) that executes the sub-skill and returns **only a size-capped structured receipt** — the proof fields below, never its full transcript. The orchestrator's loop is: **dispatch the step-subagent → read its receipt → verify the receipt against ground truth (git / `gh` / Jira) → gate advancement.** A step whose receipt is missing, incomplete, or contradicted by ground truth is **not done** — re-dispatch it; never wave it through on the subagent's word alone.

This is what stops shortcuts. A sub-skill run inline in the orchestrator's context can be skimmed, skipped, or rubber-stamped across a long run; a sub-skill run in a fresh subagent whose receipt the orchestrator independently checks cannot. The orchestrator reads no changed files, writes no review, scores no ticket, and posts no postmortem itself — it only dispatches and verifies.

**Receipt-verification gate — advance only when the receipt proves the work:**

| Phase | Receipt proof fields | Independent verification before advancing |
|-------|---------------------|-------------------------------------------|
| `validate` | numeric score **+ per-criterion breakdown** (all 7 criteria, AC/DoD text quoted as evidence) + `Transitioned: <from> → <to>` line | read Jira status == `In Progress`; a bare `pass` with **no breakdown** = not-run → re-dispatch |
| `plan` | AC→test map + files-to-touch list | `plan` marker present with a non-empty AC→test map |
| `implement` (build) | each gate command **+ its real exit code**; AC→test coverage; (concurrent) the tier-deferral note | `git show --stat <branch>` confirms the pushed commits exist; every gate reports an exit code |
| `pr` | PR url + `Test tiers` section (in the PR body) + label | `gh pr view --json state,body,labels` confirms the PR is open, the body carries the `Test tiers` section, and (concurrent) the `integration-deferred` label is present |
| `review` | **lens-keyed** findings (a finding or explicit "N/A because…" per lens, each with ≥1 `file:line`); **Files-read list**; **per-AC line binding** | compute the diff file set (`gh pr diff <N> --name-only`); **reject if Files-read ≠ diff set**, **reject any AC with no line cite**, **reject a bare ✅ lens with no citation** |
| `status_change` | transition applied + marker posted | `getJiraIssue` confirms `in-review-status-name`; marker present |

**Delegating a BUILD? Hand the subagent the finish gate explicitly.** A subagent doesn't inherit the consumer `CLAUDE.md` / `AGENTS.md` or the CI workflow, so it can't *discover* the project's gate commands. Paste the complete gate list verbatim (every CI lint command — not just the formatter — plus the test tiers + repo validators) and require it to report each gate's real exit result in its receipt before committing. A gate left out of the prompt is the usual way a delegated build passes locally and fails CI.

## Three-way concurrency split: inline / sequential-dispatch / concurrent-dispatch

**`concurrency=0`: fully inline, no agent dispatch, no worktree.** Every phase runs directly in the orchestrator's own context via the Skill tool — no `agile-execution:*` subagent, no `Agent` tool call at all, at any layer. Same per-ticket sequence, same resume/reconcile logic, same receipt requirements (the orchestrator still writes and checks its own receipt before advancing) — only the dispatch hop is removed. Use this where subagent/worktree dispatch itself isn't available or wanted (nesting-depth limits, stepping through a single ticket by hand). Opt-in only; the default is `1`.

**Default (`concurrency=1`): process tickets strictly one at a time.** The project has a **single shared Docker Compose stack** — concurrent implement/build/test runs would race on the same ports, database, and containers and corrupt each other's results. Finish a ticket's pipeline (or its skip/defer) before starting the next.

**Opt-in (`concurrency=N`, N>1): build up to N independent tickets in parallel, each in its own git worktree subagent.** A worktree isolates the *filesystem*, but the Docker stack is a **shared external resource** — parallel worktrees still cannot each `docker compose up` on the same ports/DB. So concurrent build-subagents run the **stack-free gate only** (lint + unit + typecheck + migration history-linearity) locally and **never touch the shared stack** (no `docker compose up`, no DB, no port bind); the **stack-bound tiers** (integration + e2e + apply-on-fresh-DB) **defer to CI** (see `implement-code`). Only tickets that are **mutually independent** (no blocker edge among them, no planned-file overlap) may share a batch — see Phase 0.5.

The shared stack stays strictly serial regardless of `N`: `docker compose up/down`, migrations, the dev server, and any stack-bound suite. Only one stack-touching operation may be in flight at any moment — which is why **Phase 2 monitoring/rework always runs sequentially** (a red integration check needs the stack to reproduce), even when the Phase 1 build fanned out. Read-only / analysis subagents may always run in parallel.

**Precondition for `concurrency>1`: CI must actually run the stack-bound tiers on the PR.** Deferring integration + e2e to CI is only safe if the consumer repo's CI runs those tiers **on pull requests** — if a repo runs integration nightly, on-main-only, or behind a manual label, then in concurrent mode integration is run *nowhere* before merge (not at build, not by the merge train). Confirm the CI workflow runs the stack-bound suites on PRs before using `concurrency>1`; if it does not, run `concurrency=1` (which runs them locally at build). This is the floor under the whole defer-to-CI story.

## Configuration

Reads project-specific values from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`## Skill configuration` section); the sub-skills read the same block. Fall back to lookups when absent.

- **`cloudId`** — Atlassian cloud id for `mcp__atlassian__*` calls. Required.
- **`ticket-prefix-regex`** — for ticket keys in PR titles / branches. Default `[A-Z]+-\d+`.
- **`repo` / `repo-component-map`** — the current repo's name/slug, and (for multi-repo projects) the mapping from Jira label/component → repo. Used by `implement-validate`'s repo-scope gate. Falls back to the git `origin` remote when `repo` is absent.
- **`todo-status-name`** / **`in-progress-status-name`** / **`in-review-status-name`** / **`done-status-name`** — match by case-insensitive substring so localised names ("À faire", "En cours", "Revue en cours", "Terminé(e)") work. Defaults: `To Do`, `In Progress`, `In Review`, `Done`.
- **`needs-info-status-name`** — where validation-rejected tickets go. Default: leave in `To Do` and label `needs-info`.
- **`backlog-status-name`** — Kanban backlog column/status to exclude. Default `Backlog`.
- **`board-id`** / **`board-type`** — optional pin for the project's board when auto-detection is ambiguous (`scrum` / `kanban`).
- **`story-points-field`** — default `customfield_10016`.
- **`base-branch`** — default repo default branch.
- **`branch-prefix`** — default `feature/` (branch = `<branch-prefix><TICKET>`).
- **Lint / unit / integration commands** per touched path family. **Auto-classified into two tiers** for concurrent build: **stack-free** (lint + unit + typecheck) runs locally in a worktree; **stack-bound** (integration + e2e + anything needing `docker compose`/the DB) defers to CI under `concurrency>1`. A project whose "unit" tests hit the DB must run `concurrency=1` (they are really stack-bound).
- **`max-build-concurrency`** — optional per-repo default for `concurrency` when no arg is passed. Default `1`.

## Input

Optional:
- One or more explicit ticket keys → run the pipeline on just those. Default (no input): the whole active sprint.
- **`concurrency=N`** — max independent tickets to build in parallel (worktree subagents). The arg wins; else `max-build-concurrency` from config; else **`1`** (strictly sequential — the ticket-by-ticket ordering and the local finish gate are unchanged from before this feature). `0` = fully inline, no subagent/worktree dispatch at all (see above). `1` = sequential subagent dispatch, no worktree. `N>1` = parallel worktree subagents. The dispatch-and-verify receipt model applies in all three. Merge is never affected — that is always sequential (`agile-11-merge-train`).

---

## Phase 0 — Select and order the work

1. **Discover the work queue — detect the board type first, then build the matching JQL.** A project runs on either a **Scrum board** (sprints) or a **Kanban board** (no sprints, a backlog column instead). The selection rule differs; the hard exclusion does not.

   **Hard invariant (both board types):** a ticket in the **backlog** or in a **future sprint** is NEVER eligible — do not implement it, full stop. Only work committed to the *current* active sprint (Scrum) or pulled onto the *active board* out of the backlog (Kanban) may enter the pipeline.

   Detect the board: find the project's board(s) via the Jira Agile API (`/rest/agile/1.0/board?projectKeyOrId=<KEY>`) and read its `type` (`scrum` / `kanban`). If a project has both, ask which board (single question — the one allowed pre-run clarification) or default to the Scrum board if a sprint is active.

   - **Scrum board** — eligible = `project = <KEY>` AND status matches `todo-status-name` AND `sprint in openSprints()`. Explicitly **exclude** `sprint in futureSprints()` and backlog (a `To Do` ticket with no sprint = backlog → excluded). If multiple sprints are open, scope to the named/most recent active one.
   - **Kanban board** — no sprints exist, so `openSprints()`/`futureSprints()` don't apply. Eligible = `project = <KEY>` AND status matches `todo-status-name` AND the ticket is **on the board, not in the backlog**: either fetch the board's backlog keys via `/rest/agile/1.0/board/<id>/backlog` and subtract them, or exclude `backlog-status-name` via JQL.

   Run the resolved JQL via `mcp__atlassian__searchJiraIssuesUsingJql`. After fetching, **re-verify the invariant on each candidate** before queueing it: drop anything whose sprint is a future sprint or whose state is the backlog, even if the JQL let it through.
2. **Load each candidate in full** with `mcp__atlassian__getJiraIssue`: summary, description, AC, DoD, technical notes, Specs UI link, ADR link, labels, points, **`issuelinks`**, and any linked Bugs from a prior QA run.
3. **Build the dependency graph** from `issuelinks` (`blocks` / `is blocked by`). Topologically sort. Cycle → abort the run and report (Stop condition). A ticket is **eligible** only if every blocker is `Done` already, or completes earlier in this same run. Otherwise it is **deferred**.
4. **Build the rework queue.** Separately query `in-review-status-name` tickets on the same active board / current sprint that carry a `🤖 <!-- agile:phase=pr -->` marker (PR opened by a prior run). These skip the build phases and go straight to `implement-monitor`. Backlog / future-sprint tickets are excluded here too.
5. **No work → stop the run.** If, after selection and ordering, there is **nothing to do**, stop immediately and report — do not idle, poll, or invent work. "Nothing to do" covers every empty case:
   - **No open sprint** (Scrum) — `openSprints()` returns nothing.
   - **No board / empty board** (Kanban) — no board for the project, or the board's non-backlog columns are empty.
   - **No eligible ticket** — the `To Do` queue is empty, or every `To Do` ticket is excluded (backlog / future sprint / wrong repo).
   - **No *unblocked* eligible ticket and no rework** — every remaining ticket is deferred (blocked by something not `Done` and not clearing this run) **and** the rework queue is empty, so the run can make no progress.

   In any of these, emit the Phase 3 report with an empty work table and a one-line reason (e.g. "No open sprint", "All N tickets deferred — blocked", "Board empty"), then end. This is a clean stop, not an error.
6. **State the plan, then proceed — no confirmation:**

```
Implementation plan — [Scrum: Sprint N "name" / Kanban: board "name"]

Eligible (dependency order):
  1. PROJ-31  [summary]  (backend, 3pts)  — no blockers
  2. PROJ-33  [summary]  (frontend, 5pts) — blocked by PROJ-31 (will clear this run)

Deferred (blocked, not in this run / not Done):
  - PROJ-40  blocked by PROJ-39

Rework queue (already In Review, monitor PR):
  - PROJ-28  PR #117

Starting on PROJ-31.
```

---

## Phase 0.5 — Batch selection (only when `concurrency > 1`)

Skipped entirely when `concurrency=1` (the eligible list is processed one at a time, as today). When `concurrency=N` (N>1), form the parallel batch from the eligible (unblocked, dependency-ordered) list:

1. **Mutually independent only.** Keep tickets with **no "is blocked by" edge among them** — they are independent leaves of the dependency graph. A ticket whose blocker is still unmerged stays deferred exactly as in Phase 0; concurrency never relaxes the blocker gate.
2. **Drop planned-file overlap.** Two independent tickets that touch the same file would collide at merge-train time. Cheaply compare each ticket's plan `files-to-touch` (the `plan` receipt) — reuse the `sprint-shared-file-audit` idea from `agile-8-refinement` or a light grep — and keep only a non-overlapping set in the batch; overlapping tickets run in a later batch.
3. **Drop migration collisions.** Two tickets that each **add a DB migration** touch *different* files (distinct version scripts), so the file-overlap filter misses them — but both landing splits the migration history (colliding/duplicate versions), and each ticket's local history-linearity gate can't see the sibling's migration in its own worktree. Keep **at most one migration-adding ticket per batch**; the rest run in later batches (serialised) so history stays linear.
4. **Cap at N.** Take the first N of the surviving set (dependency order). The rest wait for the next batch.
5. **N caps to CI capacity.** N parallel builds → N simultaneous open PRs → N concurrent heavy CI jobs. On a capacity-limited / self-hosted runner these can OOM-cancel each other (reported `CANCELLED`, not `FAILURE`) — keep N low, or `1`, when CI is capacity-limited.

Announce the batch (`══ batch: PROJ-31, PROJ-34, PROJ-37 (concurrency 3) ══`), then run Phase 1 for each batch member in a parallel worktree subagent. After a batch converges (all returned), monitor/rework it in Phase 2 **sequentially**, then form the next batch from the now-recomputed eligible list.

**Graceful fallback:** if worktree subagents can't be created in this environment (nesting depth, tooling), drop to `concurrency=1` for the rest of the run and say so — never fall back to running the pipeline inline in the orchestrator (that reintroduces the shortcut + context-bloat problems dispatch-and-verify exists to prevent).

**Salvage a died build-subagent's worktree before re-dispatching.** A build-subagent can die mid-flight from a cause unrelated to the ticket — a **session/usage limit, an API error, a runner OOM, a crash** — often *after* it wrote (and maybe committed) code but *before* it pushed, opened the PR, or handed off. Do **not** blindly re-dispatch: a fresh dispatch gets a **fresh worktree off base and discards whatever the dead run produced**, restarting from scratch and burning the same budget again. On a subagent failure, first **inspect its worktree** (`git -C <worktree> status --porcelain` + `git -C <worktree> log --oneline @{u}..` for unpushed commits): if it holds substantial work — pushed or not — **salvage it** (push its branch / commit its staged+unstaged work under the ticket branch, then finish the remaining phases from there — verify gates, open the PR, transition), exactly as the resume/reconcile logic (Phase 1) would for an interrupted sequential ticket. Only re-dispatch from scratch when the worktree is empty or the work is unusable. (Its complement lives in `implement-code`: build-subagents checkpoint-commit + push early so this salvage has something to recover.) The dead subagent's own final report — even a partial one — usually names the branch and what it finished; read it before deciding salvage-vs-restart.

---

## Phase 1 — Per-ticket pipeline (compose the sub-skills, resumable)

For each eligible ticket in dependency order. **Resume first — a ticket may be partially implemented** (e.g. plan posted but no code yet, or code pushed but no PR). Never restart a ticket from scratch when earlier phases are already done; pick up at the first unfinished phase.

**Detect the resume point, then reconcile it against the real artifacts** (markers can lie — a phase can crash after doing the work but before posting its marker, or after posting it but before finishing):

1. Read the ticket's Jira comments for the latest `🤖 <!-- agile:phase=<x> -->` marker. Marker → tentative next phase: none → `validate`; `validate` → `plan`; `plan` → `implement`; `implement` → `pr`; `pr` → `review`; `review` → transition + monitor; `status_change` → done (monitor only). Recover the plan body from the `plan` comment and the PR URL from the `pr` comment rather than regenerating them.
2. **Cross-check against git/gh, and trust the real artifact over the marker** — resume at the earliest phase whose output is actually missing:
   - feature branch missing → resume at `implement` (`implement-code` recreates it), regardless of a `plan` marker.
   - branch exists with un-pushed/partial work, no commits on remote → resume at `implement` (it reuses the branch, finishes, commits, pushes).
   - commits pushed but **no open PR** → resume at `pr` even if no `pr` marker (the marker post may have failed after push).
   - open PR exists but no `review` marker → resume at `review`.
   - PR open + `status_change` marker present → the build is done; go straight to Phase 2 monitoring.
3. **Rework vs implement ordering (the nightshift VC-84 gotcha):** when both an `implement`/`pr` marker *and* a later `rework` marker exist, compare timestamps — the newest marker wins. A ticket already `In Review` with a `rework` marker newer than its `pr` marker resumes in Phase 2 (monitoring), not back at the build phases. Do not route a reworked ticket back to `implement` just because an old `implement` marker is still present.

Each sub-skill is itself idempotent on partial state (`implement-code` reuses an existing branch; `implement-pr` updates an existing PR instead of opening a duplicate), so re-entering a phase that was half-done is safe.

> **Marker format** (each sub-skill posts its own, via `mcp__atlassian__addCommentToJiraIssue`, `contentFormat="markdown"`):
> ```
> 🤖 <!-- agile:phase=plan --> **Plan — agile-10-implement — <YYYY-MM-DD>**
> <phase content>
> ```
> Never delete prior markers — the trail is the resume state.

**Dispatch each phase to its named `agile-execution:*` subagent** (table above; runs the sub-skill via the Skill tool — or, under `concurrency=0`, run the sub-skill inline via the Skill tool with no agent dispatch), passing the ticket key + the resolved config + the receipt the phase must return. **Verify the returned receipt against ground truth** (the gate table above) before advancing; a missing/incomplete/contradicted receipt means the phase is not done — re-dispatch it. Branch on the outcome:

**Concurrent mode (`concurrency>1`):** the whole per-ticket pipeline (validate → plan → code → pr → review → status_change) runs **inside one worktree build-subagent per ticket**, and the orchestrator dispatches the whole Phase-0.5 batch of them in parallel, then verifies each ticket's returned receipt bundle. Pass `mode=concurrent` to `implement-code` (it defaults to `sequential`) so it runs the **stack-free gate only** and never touches the shared stack. The blocker gate, resume/reconcile logic, and the review gate are unchanged per ticket — only the fan-out differs.

1. **`implement-validate`** →
   - `out-of-scope` (wrong repo) → skip ticket, continue loop.
   - `rejected` (under-spec'd) → Needs Info, skip ticket, continue loop.
   - `critical-park` → escalate one consolidated question, park the ticket, continue with the next; resume when answered.
   - `pass` → continue to plan.
2. **`implement-plan`** → produces the plan (`🤖 plan`).
3. **`implement-code`** → branch off base/main + implement + tests + gate green (sequential: lint/unit/integration; concurrent: stack-free tiers local + integ/e2e deferred to CI) + every AC covered + commit + push (`🤖 implement`). Returns only when the mode's gate + every AC pass. Does **not** open the PR.
4. **`implement-pr`** → **open** (off base/main) or update the PR (`🤖 pr`).
5. **`implement-review`** (self-review gate) → read the changed files once and produce all six lenses yourself by default; only for a large PR, dispatch the lens groups as parallel `agile-execution:review-lens` subagents instead (no intermediate review agent — merge their findings into the single verdict yourself, same as every other phase's receipt), then produce the verdict.
   - **changes requested** → re-invoke `implement-code` with the numbered findings (fix Critical *and* Minor), then re-invoke `implement-review`. Loop until **approved**. Hard cap: >3 cycles without converging → leave PR open, post a `🤖` blocked comment, skip the ticket (per-ticket stop).
   - **approved** → post `🤖 review` and continue.
6. **Transition + hand off** (`status_change`): transition the Story to `in-review-status-name`; post `🤖 agile:phase=status_change` (2–3 line summary, PR link, AC coverage, flagged decisions, "Ready for merge train / QA"). In concurrent mode this runs inside the ticket's build-subagent; the orchestrator **verifies** it via `getJiraIssue` (status == `in-review-status-name`) + marker presence before counting the ticket handed off. **Never transition to `Done`.**
7. **Return to the base branch before the next ticket.** After hand-off, `git checkout <base-branch>` so the working tree lands back on a clean, known base. The tree is currently on this ticket's feature branch; leaving it there means the next ticket's `implement-code` may branch *off this feature branch* instead of base — stacking unrelated work and polluting the new ticket's diff and PR. `implement-code` also checks out + pulls base at its own start (the safety net), but return here too so a resumed or skipped ticket never leaves the tree parked on the wrong branch.

Then loop to the next ticket. Run `implement-monitor` per Phase 2.

---

## Phase 2 — PR monitoring and rework

**Mandatory — not skippable just because the build loop finished.** The run is **not complete** until every ticket in the rework queue (Phase 0) **and** every ticket this run moved to `In Review` has been through **`implement-monitor`** (Skill tool) on its PR. The most common orchestrator failure mode is jumping straight from the last build to the Phase 3 report and silently skipping this phase — do not. A just-opened PR whose CI has not been looked at is **not** done; a green self-review says nothing about whether CI is green.

For each such PR, invoke `implement-monitor`. It processes new review comments, failing status checks, and merge conflicts/staleness — filtered by the last `🤖 agile:phase=rework` marker for idempotency. It is best-effort on *human* review latency (it does not block indefinitely waiting for a reviewer; a later re-run or `/loop` picks up new comments), but it is **not** best-effort on CI: a `FAILURE`/`UNSTABLE` check caused by this run's code must be diagnosed and fixed now, not deferred to the report. Monitoring rework touches the shared stack, so it runs sequentially with the build loop, never concurrently — **including after a concurrent (`concurrency>1`) Phase-1 batch:** the batch fans out for the stack-free build, then its PRs are monitored/reworked **one at a time** on the stack. Under concurrency, when CI reports a **red** integration/e2e check on a deferred PR, it is reproduced and fixed on the stack here (never pushed-and-deferred back to CI unfixed). Note this is *reactive* — a green CI run means those tiers passed in CI and monitor exercises nothing; the guarantee that integration/e2e actually ran comes from CI running them on the PR (the concurrency precondition), not from Phase 2.

A ticket may not be reported as `In Review` in Phase 3 until its PR has been monitored at least once this run — evidenced by a `🤖 rework` marker, or a recorded clean-monitor result when there was nothing to fix.

---

## Phase 3 — Final report

Before printing the report, **reconcile the actual end-state of every ticket this run touched** — do not report from memory of what you intended. For each: confirm the PR is open (`gh pr list --head <branch>`), the Jira status is the expected one (`getJiraIssue` — `in-review-status-name`, or `in-progress-status-name` if the board has no In-Review column), and the expected `🤖` markers are present (validate → plan → implement → pr → review → status_change). Any mismatch (PR missing, transition not applied, a marker absent) is fixed now — re-apply the missing mutation — not silently reported as done. This catches a partially-applied hand-off (e.g. markers posted but the transition never landed) before it reaches the user.

Reconcile checks that are easy to skip and routinely hide a broken hand-off — verify each explicitly:
- **Phase 2 ran for this ticket.** Confirm `implement-monitor` was invoked on the PR this run (a `🤖 rework` marker or a recorded clean-monitor result). If it was skipped, run it **now** before reporting — never report `In Review` for a PR whose CI was never looked at.
- **CI is actually green (or its red is understood).** Read the PR's check rollup. Reporting a ticket as cleanly `In Review` while a check is `FAILURE`/`UNSTABLE` from this run's own code is a false report — loop back into Phase 2 and fix it first. Only an unrelated, diagnosed infra flake (or a human-review-pending state) may be reported with the red called out.
- **Receipt content, not just marker presence.** A marker existing does not mean the phase had depth. Confirm the `validate` receipt carried a real per-criterion score breakdown (not a bare `pass`), the `review` receipt's Files-read list equals the PR diff file set with a `file:line` cite per AC and per lens, and (concurrent mode) the `pr` receipt marked the PR `integration-deferred`. A phase whose receipt fails its gate (per the receipt-verification table) is re-dispatched now, before the report — a shallow review or a skipped score is a broken hand-off just like a missing transition.

```
## Sprint implementation — [Sprint N / board] — [date]

| Ticket | Outcome | PR | Notes |
|--------|---------|----|-------|
| PROJ-31 | In Review | #118 | clean, self-review approved |
| PROJ-33 | In Review | #119 | 1 rework cycle (auth edge case) |
| PROJ-40 | Deferred | — | blocked by PROJ-39 |
| PROJ-44 | Needs Info | — | no DoD — sent to refinement |
| PROJ-50 | Out of scope | — | targets repo `other-service` — left in To Do |
| PROJ-52 | Blocked (awaiting decision) | — | critical: irreversible backfill — asked user |

Deferred (blocked): [list + blocker]
Sent to refinement (validation rejected): [list + what's missing]
Out of scope (other repo): [list + target repo]
Awaiting critical decision: [list + the question]
Rework processed this run: [tickets + what changed]
Follow-up tickets to file (CRITICAL only): [list / none]

👉 Next: agile-11-merge-train to review + merge the open PRs, then skill 14 (QA Validation).
```

---

## Rules (apply every run)

- **Dispatch every phase to its named agent; verify its receipt; never do the work inline (except under `concurrency=0`).** Each of `implement-validate` / `implement-plan` / `implement-code` / `implement-pr` / `implement-review` / `implement-monitor` runs in its named `agile-execution:*` subagent (table above) that returns a size-capped receipt; the orchestrator verifies that receipt against ground truth (per the receipt-verification table) before advancing. Under `concurrency=0` the orchestrator runs each sub-skill inline via the Skill tool instead — same receipts, same verification, no agent hop. The orchestrator owns selection, ordering, the per-ticket sequence, and the report — it reads no changed files, writes no review, and scores no ticket itself (dispatch mode) or does so transparently in its own context (inline mode). A phase whose receipt is missing/incomplete/contradicted is re-dispatched, not waved through. Fix a sub-skill in its own file, never fork its logic here.
- **Narrate progress — one short line per step.** Before each phase, tell the user what's starting in a single plain line: `▶ VC-123 — validation`, then `▶ VC-123 — plan`, `▶ VC-123 — implementing`, `▶ VC-123 — opening PR`, `▶ VC-123 — self-review`. Announce each ticket switch (`── VC-124 (2/5) ──`) and each per-ticket outcome (`✓ VC-123 → In Review (PR #118)`, `⤼ VC-124 deferred — blocked by VC-123`). This is a heartbeat, **not** a log — no command output, diffs, file lists, or tool transcripts; one line, then move on. The detailed trail lives in the `🤖` Jira markers and the final report, not in chat.
- **One phase at a time — never batch phase calls.** Invoke a single sub-skill, wait for its return, and apply its side effects (the Jira transition, the posted marker) *before* invoking the next. Do not fire `validate` + `plan` + `code` in one turn. A `plan`/`code` call started before `validate` returns runs on stale assumptions instead of the freshly-read ticket, and the `To Do → In Progress` transition (which lives in `validate`'s pass branch) gets skipped. After `validate` returns `pass`, confirm the ticket is actually `In Progress` before starting `plan`. (Failure mode this guards against: batched phase calls let `plan`/`code` run from memory instead of the freshly-read ticket — contradicting an AC — and the validate-phase transition gets skipped.)
- **Mutating ops run one at a time — never in a parallel batch with fallible reads.** Every state-changing call (a Jira transition, a `🤖` marker comment, `git push`, `gh pr create`/`edit`, a PR review post) must be issued on its own and confirmed before the next. Do **not** pack several mutations — or mutations interleaved with reads that might error — into a single parallel tool block: if any one call in that block fails, the whole block is cancelled and you are left with half-posted markers, an un-applied transition, and inconsistent resume state that the next run has to untangle. Reads can be parallelised freely; mutations are sequential. (Failure mode this guards against: a transition + several markers + a push + a PR-open batched in one parallel block are all cancelled together when an unrelated read in the same block errors — leaving the ticket half-handed-off.) **This rule is per-pipeline** — in concurrent mode each ticket's pipeline (and its mutations) runs inside its **own** worktree subagent, so N tickets' pipelines proceed in parallel, but *within* each subagent phases and mutations stay one-at-a-time. Distinct tickets touch distinct branches + distinct Jira issues, so their mutations don't collide.
- **Full autonomy, escalate only on a critical decision.** No mid-loop "should I proceed?" Decide and document everything reversible; the only stop-and-ask is a genuinely critical, irreversible decision not derivable from ADR/PRD/Specs — and even then park that one ticket and keep the loop running.
- **Works on Scrum and Kanban boards; never the backlog or a future sprint.** Re-verify per candidate after the JQL fetch.
- **Only implement tickets that target the current repo** (`implement-validate`'s repo-scope gate).
- **Dependency order; never force a blocked ticket.** Cycles abort the run.
- **`In Review` ≠ `Done` — never stub, stack, or bypass an unmerged blocker.** A blocker that is still an open PR (`In Review`) has **not** cleared: its code is not on the base branch, so a ticket that depends on it is **deferred**, full stop. It only becomes eligible if that blocker actually reaches `Done` (merges) earlier in *this* run. Do not work around the gap by branching the dependent off the blocker's feature branch, by stubbing/vendoring the blocker's unmerged code, or by "it'll be fine once both merge" — that fabricates a green build against code the base branch doesn't have. Defer and report the blocker. (If two same-run tickets are genuinely independent at the code level but happen to touch one shared file, that is a build-off-base + expected merge-train conflict, not a license to stack branches.)
- **Phase 2 is part of the run, not an optional epilogue.** Every PR opened or reworked this run goes through `implement-monitor` before the final report. Skipping it — ending on a freshly-opened PR whose CI was never inspected — is the single most common way a "green" run ships a red PR.
- **Resumable + idempotent — handle partially-implemented tickets.** `🤖` markers drive resume, but reconcile them against the real artifacts (branch / pushed commits / open PR) and resume at the earliest genuinely-missing phase — never restart a ticket whose plan/code/PR already exist. Re-running never duplicates a PR or repeats a completed phase, never re-processes a review comment older than the last rework marker, and uses marker timestamps to keep a reworked ticket from routing back to the build phases.
- **Never transition to `Done`.** This skill ends a ticket at `In Review` with an open PR.
- **Three-way concurrency split.** `0` = fully inline, no agent/worktree at all. Sequential by default (`concurrency=1`) = one ticket at a time, each phase dispatched to its named agent, no worktree. Opt-in concurrent (`concurrency=N`, N>1) = independent tickets in parallel worktree subagents under the **stack-free gate only** (integration + e2e defer to CI). The single shared Docker Compose stack stays strictly serial regardless of mode, so Phase 2 monitoring/rework is always sequential.
- **Delegate every task to its named agent (dispatch modes); serialise stack access.** Read-only work parallelises freely; only one stack-touching operation may be in flight at a time.
- **Output prose stays in normal English** — PR bodies, Jira comments, and the report are permanent artifacts.

## Stop conditions

Stop the **whole run** and report immediately if:
- **No work is available** (Phase 0 step 5): no open sprint, no board / empty board, no eligible `To Do` ticket, or every remaining ticket is deferred (blocked) with an empty rework queue. Clean stop — emit the empty report and end; never idle or poll for work to appear.
- A Jira ticket can't be loaded (auth, deleted, wrong project / `cloudId`).
- The dependency graph has a cycle.
- `git push` / `gh pr create` fails for an auth/permissions reason (not a transient blip).
- Two consecutive tickets hit the same unrelated CI infrastructure failure.

Stop **one ticket** (and continue the run) if:
- It targets a different repo (`implement-validate` → out-of-scope skip, left in `To Do`).
- The validation gate rejects it (→ Needs Info + skip).
- It forces a **critical decision** → park, ask one consolidated question, move on; resume when answered.
- The `implement-review`→`implement-code` fix loop exceeds 3 cycles without converging (→ leave PR open, `🤖` blocked comment, skip).
- A required dependency is still not `Done` when its turn comes (→ defer).
