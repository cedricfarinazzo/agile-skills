---
name: agile-10-implement
description: "Autonomously implement the active board — current sprint (Scrum) or ready column (Kanban), never backlog/future — in Jira dependency order, composing the implement-* sub-skills per ticket: validate → plan → code → pr → review → monitor. Resumable via 🤖 Jira markers; full autonomy, asks only on critical decisions. Triggers: implement the sprint, work the sprint, pick up tickets, implement story PROJ-XXX, start coding. After skill 9, before skill 11."
---

# agile_10_implement

Autonomous, end-to-end sprint implementation pipeline — the agile-side analogue of `agile-11-merge-train`, modelled on the `nightshift jira run` loop. It is an **orchestrator**: it selects the board's work, orders it by Jira dependency, and drives each ticket from `To Do` to `In Review` with an open, self-reviewed PR by **composing the `implement-*` sub-skills** — without stopping to ask between steps.

`agile-11-merge-train` clears the **merge** queue (open PR → `main`) by composing `merge-update-pr` / `merge-review-pr` / `merge-fix-until-satisfied` / `merge-jira-postmortem`. This skill clears the **build** queue (`To Do` Story → open PR) by composing its own sub-skills. The two compose end-to-end: this skill produces the PRs that the merge train later reviews and merges.

## Sub-skills (composed via the Skill tool — never inline their logic)

Per ticket, in order. Each maps to one 🤖 resume-marker phase; each is invoked with the Skill tool, not reimplemented here. If one needs improvement, edit *that* sub-skill.

| Phase | Sub-skill | Does |
|-------|-----------|------|
| validate | `implement-validate` | repo-scope + readiness gate; pass / reject(Needs Info) / out-of-scope / critical-park |
| plan | `implement-plan` | read ADR/Specs/PRD/bugs → concrete plan + AC→test map |
| implement | `implement-code` | branch off base/main, implement per ADR/Specs, all-AC tests, lint+unit+integration green, commit, push — finishes only when all lint + all tests + every AC pass. Does **not** open the PR |
| pr | `implement-pr` | **open** (off base/main) or update the PR linked to the ticket |
| review | `implement-review` | six-lens self-review; verdict + numbered blockers |
| (monitor) | `implement-monitor` | PR rework loop — new review comments, failing checks, conflicts |

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

## Strictly sequential — one ticket at a time

**Process tickets strictly one at a time. Never run two tickets' pipelines in parallel.** The project has a **single shared Docker Compose stack** — concurrent implement/build/test runs would race on the same ports, database, and containers and corrupt each other's results. Finish a ticket's pipeline (or its skip/defer) before starting the next ticket's.

This applies to every stage that touches the shared stack: `docker compose up/down`, migrations, the dev server, and the lint/unit/**integration** suites. Only one ticket may hold the stack at any moment. Tear down (`docker compose down`) or release the stack between tickets so the next one starts clean. PR monitoring (`implement-monitor`) for an earlier ticket may interleave between later tickets, but its rework fixes also use the shared stack — so they too run sequentially.

## Delegate to subagents

Use the **Agent tool (subagents) as much as possible** to keep the orchestration context lean and the work parallel-safe. Each `implement-*` sub-skill may itself fan out to subagents for its read-only work (context gathering, file-by-file review). Hard rule: **read-only / analysis subagents may run in parallel; anything that touches the shared Docker Compose stack (build, migrate, run, integration tests) must not** — the main thread owns the stack and serialises access. Only one stack-touching sub-skill (`implement-code`, a rework in `implement-monitor`) may be in flight at a time.

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
- **Lint / unit / integration commands** per touched path family.

## Input

Optional: one or more explicit ticket keys → run the pipeline on just those. Default (no input): the whole active sprint.

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

Invoke each sub-skill via the **Skill tool**, passing the ticket key + the resolved config. Branch on the outcome:

1. **`implement-validate`** →
   - `out-of-scope` (wrong repo) → skip ticket, continue loop.
   - `rejected` (under-spec'd) → Needs Info, skip ticket, continue loop.
   - `critical-park` → escalate one consolidated question, park the ticket, continue with the next; resume when answered.
   - `pass` → continue to plan.
2. **`implement-plan`** → produces the plan (`🤖 plan`).
3. **`implement-code`** → branch off base/main + implement + tests + lint/unit/integration green + every AC covered + commit + push (`🤖 implement`). Returns only when all lint + all tests + every AC pass. Does **not** open the PR.
4. **`implement-pr`** → **open** (off base/main) or update the PR (`🤖 pr`).
5. **`implement-review`** (self-review gate) → verdict.
   - **changes requested** → re-invoke `implement-code` with the numbered findings (fix Critical *and* Minor), then re-invoke `implement-review`. Loop until **approved**. Hard cap: >3 cycles without converging → leave PR open, post a `🤖` blocked comment, skip the ticket (per-ticket stop).
   - **approved** → post `🤖 review` and continue.
6. **Transition + hand off** (orchestrator, inline): transition the Story to `in-review-status-name`; post `🤖 agile:phase=status_change` (2–3 line summary, PR link, AC coverage, flagged decisions, "Ready for merge train / QA"). **Never transition to `Done`.**
7. **Return to the base branch before the next ticket.** After hand-off, `git checkout <base-branch>` so the working tree lands back on a clean, known base. The tree is currently on this ticket's feature branch; leaving it there means the next ticket's `implement-code` may branch *off this feature branch* instead of base — stacking unrelated work and polluting the new ticket's diff and PR. `implement-code` also checks out + pulls base at its own start (the safety net), but return here too so a resumed or skipped ticket never leaves the tree parked on the wrong branch.

Then loop to the next ticket. Run `implement-monitor` per Phase 2.

---

## Phase 2 — PR monitoring and rework

For every ticket in the rework queue (Phase 0) **and** every ticket this run just moved to `In Review`, invoke **`implement-monitor`** (Skill tool) on its PR. It processes new review comments, failing status checks, and merge conflicts/staleness — filtered by the last `🤖 agile:phase=rework` marker for idempotency — and is best-effort within the run (it does not block indefinitely on a human reviewer; a later re-run or `/loop` picks up new comments). Monitoring rework touches the shared stack, so it runs sequentially with the build loop, never concurrently.

---

## Phase 3 — Final report

Before printing the report, **reconcile the actual end-state of every ticket this run touched** — do not report from memory of what you intended. For each: confirm the PR is open (`gh pr list --head <branch>`), the Jira status is the expected one (`getJiraIssue` — `in-review-status-name`, or `in-progress-status-name` if the board has no In-Review column), and the expected `🤖` markers are present (validate → plan → implement → pr → review → status_change). Any mismatch (PR missing, transition not applied, a marker absent) is fixed now — re-apply the missing mutation — not silently reported as done. This catches a partially-applied hand-off (e.g. markers posted but the transition never landed) before it reaches the user.

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

- **Compose, don't inline.** Invoke `implement-validate` / `implement-plan` / `implement-code` / `implement-pr` / `implement-review` / `implement-monitor` via the Skill tool. The orchestrator owns selection, ordering, the per-ticket sequence, transitions, and the report — the sub-skills own the work. Fix a sub-skill in its own file, never fork its logic here.
- **Narrate progress — one short line per step.** Before each phase, tell the user what's starting in a single plain line: `▶ VC-123 — validation`, then `▶ VC-123 — plan`, `▶ VC-123 — implementing`, `▶ VC-123 — opening PR`, `▶ VC-123 — self-review`. Announce each ticket switch (`── VC-124 (2/5) ──`) and each per-ticket outcome (`✓ VC-123 → In Review (PR #118)`, `⤼ VC-124 deferred — blocked by VC-123`). This is a heartbeat, **not** a log — no command output, diffs, file lists, or tool transcripts; one line, then move on. The detailed trail lives in the `🤖` Jira markers and the final report, not in chat.
- **One phase at a time — never batch phase calls.** Invoke a single sub-skill, wait for its return, and apply its side effects (the Jira transition, the posted marker) *before* invoking the next. Do not fire `validate` + `plan` + `code` in one turn. A `plan`/`code` call started before `validate` returns runs on stale assumptions instead of the freshly-read ticket, and the `To Do → In Progress` transition (which lives in `validate`'s pass branch) gets skipped. After `validate` returns `pass`, confirm the ticket is actually `In Progress` before starting `plan`. (Failure mode this guards against: batched phase calls let `plan`/`code` run from memory instead of the freshly-read ticket — contradicting an AC — and the validate-phase transition gets skipped.)
- **Mutating ops run one at a time — never in a parallel batch with fallible reads.** Every state-changing call (a Jira transition, a `🤖` marker comment, `git push`, `gh pr create`/`edit`, a PR review post) must be issued on its own and confirmed before the next. Do **not** pack several mutations — or mutations interleaved with reads that might error — into a single parallel tool block: if any one call in that block fails, the whole block is cancelled and you are left with half-posted markers, an un-applied transition, and inconsistent resume state that the next run has to untangle. Reads can be parallelised freely; mutations are sequential. (Failure mode this guards against: a transition + several markers + a push + a PR-open batched in one parallel block are all cancelled together when an unrelated read in the same block errors — leaving the ticket half-handed-off.)
- **Full autonomy, escalate only on a critical decision.** No mid-loop "should I proceed?" Decide and document everything reversible; the only stop-and-ask is a genuinely critical, irreversible decision not derivable from ADR/PRD/Specs — and even then park that one ticket and keep the loop running.
- **Works on Scrum and Kanban boards; never the backlog or a future sprint.** Re-verify per candidate after the JQL fetch.
- **Only implement tickets that target the current repo** (`implement-validate`'s repo-scope gate).
- **Dependency order; never force a blocked ticket.** Cycles abort the run.
- **Resumable + idempotent — handle partially-implemented tickets.** `🤖` markers drive resume, but reconcile them against the real artifacts (branch / pushed commits / open PR) and resume at the earliest genuinely-missing phase — never restart a ticket whose plan/code/PR already exist. Re-running never duplicates a PR or repeats a completed phase, never re-processes a review comment older than the last rework marker, and uses marker timestamps to keep a reworked ticket from routing back to the build phases.
- **Never transition to `Done`.** This skill ends a ticket at `In Review` with an open PR.
- **Strictly sequential — one ticket at a time** (single shared Docker Compose stack).
- **Delegate read-only work to subagents; serialise stack access.**
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
