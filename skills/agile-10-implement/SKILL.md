---
name: agile-10-implement
description: "Autonomously implement the active board's work: pull every To Do Story from the current sprint (Scrum) or the board's ready column (Kanban) — never the backlog or a future sprint — order by Jira dependency links, then per ticket validate → plan → implement → commit → PR → self-review → transition to In Review, and monitor each PR for review comments, failing checks, and conflicts. Resumable via 🤖 Jira markers. Triggers: implement the sprint, work the sprint, run the sprint, pick up tickets, autonomous implement, implement story PROJ-XXX, start coding. After skill 9, before skill 11. Full agent autonomy — no mid-loop confirmation."
---

# agile_10_implement

Autonomous, end-to-end sprint implementation pipeline — the agile-side analogue of `dev-merge-train`, modelled on the `nightshift jira run` loop. You take every eligible Story in the active sprint and drive it from `To Do` to `In Review` with an open, self-reviewed PR — without stopping to ask between steps.

`dev-merge-train` clears the **merge** queue (open PR → `main`). This skill clears the **build** queue (`To Do` Story → open PR). The two compose: this skill produces the PRs that `dev-merge-train` later reviews and merges.

## Goal & non-goals

**Goal:** every eligible `To Do` Story in the active sprint ends the run as an open PR that has been validated against its spec, implemented per the ADR, self-reviewed across six lenses, and transitioned to `In Review` — in Jira dependency order, with a `🤖` comment trail documenting every phase for resume.

**Non-goals:** merging to `main` (that is `dev-merge-train`); inventing scope not in the Story; working backlog or future-sprint tickets; transitioning anything to `Done` (that is QA, skill 12); forcing a blocked or under-specified ticket through the pipeline.

This skill exists to do careful work unattended, not to race. If a ticket is ambiguous, the validation gate sends it back rather than guessing the spec into existence.

## Autonomy contract

A user who invokes this skill (or says "implement the sprint", "work the sprint", "pick up tickets") has **authorised the full per-ticket pipeline for every eligible ticket in the queue**. Do not pause for confirmation between phases or between tickets. The only authorised stops are the explicit **Stop conditions** at the bottom of this file, and the per-ticket validation gate (which skips one ticket, not the run).

When in doubt about a *spec* (what to build), the validation gate decides: pass → infer-and-flag and proceed; fail → comment, send back, skip the ticket, continue the loop. When in doubt about an *action* (whether to run the pipeline), you are already authorised — proceed.

## Strictly sequential — one ticket at a time

**Process tickets strictly one at a time. Never run two tickets' pipelines in parallel.** The project has a **single shared Docker Compose stack** — concurrent implement/build/test runs would race on the same ports, database, and containers and corrupt each other's results. Finish a ticket's pipeline through Phase 1h (or its skip/defer) before starting the next ticket's Phase 1a.

This applies to every stage that touches the shared stack: `docker compose up/down`, migrations, the dev server, and the lint/unit/**integration** suites. Only one ticket may hold the stack at any moment. Tear down (`docker compose down`) or otherwise release the stack between tickets so the next one starts clean.

Phase 2 (PR monitoring) for an earlier ticket may interleave between later tickets, but its rework fixes also use the shared stack — so they too run sequentially, never concurrently with another ticket's build.

## Delegate to subagents

Use the **Agent tool (subagents) as much as possible** to keep the orchestration context lean and the work parallel-safe. Spawn a subagent for the bounded, mostly-read-only sub-jobs:
- **Context gathering** (per ticket, Phase 1a/1b): one subagent reads the Story + ADR + Specs UI + PRD + linked Bugs and returns a structured digest + the plan draft.
- **Implementation** of a single ticket (Phase 1d): a subagent can carry the edit/test work for that one ticket and report back — but it must run the shared-stack steps itself, and **only one implementation subagent may run at a time** (see sequential rule). Do not launch implementation subagents for multiple tickets concurrently.
- **Self-review** (Phase 1g): `agile-11-dev-review` is itself invoked via the Skill tool and delegates its file-by-file reads to subagents.

Hard rule for delegation: **read-only / analysis subagents may run in parallel; anything that touches the shared Docker Compose stack (build, migrate, run, integration tests) must not.** The main thread owns the stack and serialises access to it. When you spawn a subagent that will run the stack, no other stack-touching work may be in flight.

## Configuration

Reads project-specific values from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`## Skill configuration` section). Fall back to lookups when absent.

- **`cloudId`** — Atlassian cloud id for `mcp__atlassian__*` calls. Required.
- **`ticket-prefix-regex`** — for ticket keys in PR titles / branches. Default `[A-Z]+-\d+`.
- **`todo-status-name`** / **`in-progress-status-name`** / **`in-review-status-name`** / **`done-status-name`** — match by case-insensitive substring so localised names ("À faire", "En cours", "Revue en cours", "Terminé(e)") work. Defaults: `To Do`, `In Progress`, `In Review`, `Done`.
- **`needs-info-status-name`** — where validation-rejected tickets go. Default: leave in `To Do` and label `needs-info` if no such status exists.
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

   **Hard invariant (both board types):** a ticket in the **backlog** or in a **future sprint** is NEVER eligible — do not implement it, full stop. Only work that is committed to the *current* active sprint (Scrum) or pulled onto the *active board* out of the backlog (Kanban) may enter the pipeline.

   Detect the board: find the project's board(s) via the Jira Agile API (`/rest/agile/1.0/board?projectKeyOrId=<KEY>`) and read its `type` (`scrum` / `kanban`). If a project has both, ask which board (single question — this is the one allowed pre-run clarification) or default to the Scrum board if a sprint is active.

   - **Scrum board** — eligible = `project = <KEY>` AND status matches `todo-status-name` AND `sprint in openSprints()`. Explicitly **exclude** `sprint in futureSprints()` and backlog (a `To Do` ticket with no sprint = backlog → excluded). If multiple sprints are open, scope to the named/most recent active one.
   - **Kanban board** — no sprints exist, so `openSprints()`/`futureSprints()` don't apply. Eligible = `project = <KEY>` AND status matches `todo-status-name` AND the ticket is **on the board, not in the backlog**. Kanban backlog tickets are excluded by either: (a) fetch the board's backlog issue keys via the Agile API (`/rest/agile/1.0/board/<id>/backlog`) and subtract them, or (b) exclude the configurable `backlog-status-name` (default `Backlog`) via JQL. Never treat a backlog-column ticket as ready.

   Run the resolved JQL via `mcp__atlassian__searchJiraIssuesUsingJql`. After fetching, **re-verify the invariant on each candidate** before queueing it: drop anything whose sprint is a future sprint or whose state is the backlog, even if the JQL let it through (belt-and-braces against board-config quirks).
2. **Load each candidate in full** with `mcp__atlassian__getJiraIssue`: summary, description, AC, DoD, technical notes, Specs UI link, ADR link, labels (layer: backend / frontend / fullstack), points, **`issuelinks`**, and any linked Bugs from a prior QA run.
3. **Build the dependency graph** from `issuelinks` (`blocks` / `is blocked by`). Topologically sort. If a cycle exists → abort the run and report the cycle (Stop condition). A ticket is **eligible** only if every blocker is `Done` already, or completes earlier in this same run. Otherwise it is **deferred**.
4. **Build the rework queue.** Separately query `in-review-status-name` tickets on the same active board / current sprint (Scrum) or board (Kanban) that carry a `🤖 <!-- agile:phase=pr -->` marker (PR opened by a prior run). These skip Phases 1a–1h and go straight to Phase 2 (PR monitoring / rework). Backlog / future-sprint tickets are excluded here too.
5. **State the plan, then proceed — no confirmation:**

```
Implementation plan — [Scrum: Sprint N "name" / Kanban: board "name"]

Eligible (dependency order):
  1. PROJ-31  [summary]  (backend, 3pts)  — no blockers
  2. PROJ-33  [summary]  (frontend, 5pts) — blocked by PROJ-31 (will clear this run)

Deferred (blocked by tickets not in this run / not Done):
  - PROJ-40  blocked by PROJ-39 (status: In Progress, not in this sprint)

Rework queue (already In Review, monitor PR):
  - PROJ-28  PR #117

Starting Phase 1 on PROJ-31.
```

---

## Phase 1 — Per-ticket pipeline (dependency order, resumable)

For each eligible ticket in order. **Resume first:** read the ticket's Jira comments for `🤖 <!-- agile:phase=<x> -->` markers (newest wins) and jump to the first unfinished phase. Marker → next phase: none → `validate`; `validate` → `plan`; `plan` → `implement`; `implement` → `pr`; `pr` → `review`; `review` → `in_review`; `status_change` → done (move to Phase 2 monitoring). Recover the plan body and PR URL from their comments rather than regenerating.

> **Marker format** (every phase except commit posts one, via `mcp__atlassian__addCommentToJiraIssue`, `contentFormat="markdown"`):
> ```
> 🤖 <!-- agile:phase=plan --> **Plan — agile-10-implement — <YYYY-MM-DD>**
> <phase content>
> ```
> The `🤖` prefix + HTML comment marker is how a re-run reconstructs progress. Never delete prior markers.

### 1a. Validate the ticket — the gate

Score the Story 0–10 on readiness (reuse skill 8's readiness gate): clear persona summary; ≥2 falsifiable Given/When/Then ACs; DoD present; Specs UI link for UI Stories; technical notes referencing the ADR; dependencies resolvable; no open question that would force a mid-implementation architecture decision.

- **Score ≥ 6 and AC + DoD present → pass.** Resolve remaining minor ambiguities by **inference from the ADR / Specs UI / PRD standard patterns**, and record *every* inference explicitly in the validation comment (never infer silently). Post `🤖 agile:phase=validate` with the score and the inference list. Transition `To Do → In Progress`.
- **Score < 6, or no AC / no DoD, or a genuine blocking unknown remains → reject this ticket (not the run).** Post `🤖 agile:phase=validate` in **rejected** mode listing exactly what is missing and what skill 8 (Refinement) must add. Transition to `needs-info-status-name` (or leave in `To Do` + label `needs-info`). **Skip to the next ticket** — do not implement against a guessed spec, and do not halt the whole run.

### 1b. Plan

Read every linked artifact before planning: ADR (tech stack, API style, auth, data model, infra constraints), Specs UI (every screen + state for UI Stories), PRD (edge-case context), and any linked QA Bugs. Produce a concrete plan: files/modules to touch, implementation order (data → service → API → frontend → tests), and an **AC→test map** (each AC → at least one test; each edge-case AC → its own test). Post it as `🤖 agile:phase=plan`.

### 1c. Set up workspace and branch

- `git checkout <base-branch> && git pull` to start from the current tip.
- Create or reuse the feature branch `<branch-prefix><TICKET>` (idempotent — `gh pr checkout` or `git checkout -B` only if no open PR branch already exists for this ticket).

### 1d. Implement

Execute the plan. Implementation rules (carried over — these are non-negotiable):
- **Follow the ADR exactly.** No new pattern, library, or architectural decision without flagging it (PR body + a `🤖` Jira comment) — never silently deviate.
- **Implement every Specs UI state** (default / loading / empty / error / success), not just the happy path. Match the spec; flag deviations, never silently "improve".
- **Cover every AC with a test**; each edge-case AC gets its own test.
- **Name from the domain** (PRD / ADR vocabulary), not generic names.
- Run the project's **lint + unit + integration** suites locally and get them green before moving on. Do not push and hope CI catches it.
- If a decision not covered by the ADR is forced mid-implementation: post a `🤖` comment stating the situation + the option you chose + rationale, implement the lower-risk reversible option, and flag it prominently in the PR for the reviewer. (Autonomy means you decide and document — not that you stop and wait.)

### 1e. Commit and push (silent phase — no marker)

Conventional commit; body includes `Refs: <TICKET>` and the `Co-Authored-By` trailer. Push the branch. No Jira comment for this phase (matches the resume model — commit is reconstructed from the pushed branch, not a marker).

### 1f. Open or update the PR

- `findExistingPR`: `gh pr list --state open --head <branch> --json number,url`. If found → `gh pr edit`; else `gh pr create --base <base-branch>`.
- Title: `[TICKET] <Story summary>`. Body sections: **Story** (link) · **What this PR does** · **AC coverage** (each AC → test / verification) · **Changes** · **Testing** · **Specs UI match** (states implemented, deviations) · **ADR compliance** (new decisions / libraries — flagged) · **Checklist**.
- Post `🤖 agile:phase=pr` with the PR URL.

### 1g. Self-review gate — invoke `agile-11-dev-review` via the Skill tool

- **Invoke `agile-11-dev-review` (Skill tool), not its semantics inline.** It runs the six-lens review autonomously against the Story spec + ADR and returns a verdict with numbered blockers.
- If it returns **changes requested**: fix **every** finding — Critical *and* Minor (Minor is a severity, not a deferral) — re-run lint + tests green locally, push, and **re-invoke `agile-11-dev-review`** on the new tip. Loop until it returns **approved**. The only acceptable unfixed finding is one that would expand the diff into unrelated files — file a follow-up ticket inline and note it in the PR.
- Hard cap: if the review→fix loop runs **more than 3 times on the same PR without converging**, stop this ticket, leave the PR open with a summary comment, post a `🤖` blocked comment, and move to the next ticket (Stop condition — per ticket).
- Post `🤖 agile:phase=review` summarising the final verdict.

### 1h. Transition and hand off

- Transition the Story to `in-review-status-name`.
- Post `🤖 agile:phase=status_change`: 2–3 line implementation summary, PR link, AC coverage, any flagged new decisions, "Ready for dev-merge-train / QA."
- **Never transition to `Done`** — that is QA (skill 12) / the merge train.
- Loop to the next eligible ticket's 1a.

---

## Phase 2 — PR monitoring and rework loop

Run for every ticket in the rework queue (Phase 0) **and** every ticket this run just moved to `In Review`. This is the `nightshift` review-feedback loop plus the `dev-merge-train` CI/conflict handling, applied to the **pre-merge** PR.

For each PR, check three things and act:

1. **New review comments.** `gh pr view <N> --json reviews,comments` + `gh api` for review threads. **Filter to comments newer than the last `🤖 agile:phase=rework` marker** (idempotency — never re-process a comment). For each new actionable comment: implement the fix, commit, push, reply to the thread. Post `🤖 agile:phase=rework` recording what was addressed.
2. **Failing status checks.** Poll `statusCheckRollup`. On `FAILURE` / `UNSTABLE`, run the **flake-vs-regression diagnosis** before re-running (was the same test green on a recent `main` run? does the PR add a test file collected before the failing one? repro locally `<runner> <new-test> <failing-test>`). Real failure → fix, push. Genuine flake (confirmed) → `gh run rerun --failed`. Never blind-rerun.
3. **Merge conflicts / staleness.** `mergeStateStatus` `DIRTY` / `BEHIND` → rebase: `git checkout <base> && git pull`, then `git merge --no-ff <base>` on the branch, resolve conflicts, run lint-after-rebase, push. (`git merge --continue` rejects `--no-edit` — use `GIT_EDITOR=true git merge --continue`.)

**Poll without foreground `sleep`.** Use a single background `until` loop and read the output when it fires:
```bash
until [ "$(gh pr view <N> --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.status!="COMPLETED")]|length')" = "0" ]; do sleep 20; done; gh pr view <N> --json statusCheckRollup,mergeStateStatus,reviewDecision --jq '{merge:.mergeStateStatus,decision:.reviewDecision,checks:[.statusCheckRollup[]|{n:.name,c:.conclusion}]}'
```
Run it with `run_in_background: true`; the completion notification re-invokes you — read the file and act. Do not chain foreground `sleep`s, and do not poll in a foreground loop.

Monitoring is **best-effort within the run**: process whatever review comments / check results / conflicts exist now. The skill does not block indefinitely waiting for a human reviewer — once the current state is handled and no new actionable signal remains, record status and move on. A later re-run (or `/loop`) picks up new review comments via the marker filter.

---

## Phase 3 — Final report

```
## Sprint implementation — Sprint [N] — [date]

| Ticket | Outcome | PR | Notes |
|--------|---------|----|-------|
| PROJ-31 | In Review | #118 | clean, self-review approved |
| PROJ-33 | In Review | #119 | 1 rework cycle (auth edge case) |
| PROJ-40 | Deferred | — | blocked by PROJ-39 (not in sprint) |
| PROJ-44 | Needs Info | — | no DoD; no AC for size-limit path — sent to refinement |

Deferred (blocked): [list + blocker + why]
Sent to refinement (validation rejected): [list + what's missing]
Rework processed this run: [tickets + what changed]
Follow-up tickets to file (CRITICAL only): [list / none]

👉 Next: dev-merge-train (dev-skills) to review + merge the open PRs, then skill 12 (QA Validation).
```

---

## Rules (apply every run)

- **Full autonomy.** Invoking authorises the whole pipeline for every eligible ticket. No mid-loop "should I proceed?" — the Stop conditions and the per-ticket validation gate are the only authorised interruptions.
- **Read everything before writing anything** — ADR, Specs UI, PRD, refinement comments, linked Bugs — before one line of code, per ticket.
- **Works on Scrum and Kanban boards; never the backlog or a future sprint.** Detect the board type and select accordingly (current sprint for Scrum, on-board non-backlog for Kanban). A backlog or future-sprint ticket is never eligible — re-verify this on every candidate after the JQL fetch.
- **Dependency order; never force a blocked ticket.** Eligible only when all blockers are `Done` or cleared earlier this run. Cycles abort the run.
- **The validation gate protects `main` from guessed specs.** Under-specified ticket → comment + send back + skip, never implement against an invented spec, never halt the whole run for one bad ticket.
- **ADR is law.** New pattern / library / decision → flag in PR + `🤖` Jira comment, never silent. Forced mid-implementation decision → choose the reversible option, document, flag, keep going.
- **All ACs tested; all Specs UI states implemented.** Happy-path-only is not done.
- **Self-review is mandatory and is a sub-skill call.** Invoke `agile-11-dev-review` via the Skill tool; fix every Critical *and* Minor finding; loop until approved (≤3 cycles). If `agile-11-dev-review` needs improvement, edit *that* skill — don't fork its logic here.
- **Resumable + idempotent.** `🤖` markers drive resume; re-running never duplicates a PR or repeats a phase, and never re-processes a review comment older than the last rework marker.
- **Never transition to `Done`.** This skill ends a ticket at `In Review` with an open PR.
- **Strictly sequential — one ticket at a time.** Single shared Docker Compose stack: never run two tickets' build/test/stack work concurrently. Finish or skip/defer a ticket before starting the next.
- **Delegate to subagents.** Use the Agent tool for context-gathering, planning, and per-ticket implementation. Read-only/analysis subagents may run in parallel; anything touching the shared stack must not — the main thread serialises stack access.
- **No foreground `sleep` for CI polling** — single background `until` loop.
- **Output prose stays in normal English.** PR bodies, Jira comments, and the final report are permanent artifacts read by humans at review and retro.

## Stop conditions

Stop the **whole run** and report immediately if:
- A Jira ticket can't be loaded (auth, deleted, wrong project / `cloudId`).
- The dependency graph has a cycle.
- `git push` / `gh pr create` fails for an auth/permissions reason (not a transient network blip).
- Two consecutive tickets hit the same unrelated CI infrastructure failure (suggests infra, not code).

Stop **one ticket** (and continue the run) if:
- The validation gate rejects it (→ Needs Info + skip).
- The self-review→fix loop exceeds 3 cycles without converging (→ leave PR open, `🤖` blocked comment, skip).
- A required dependency is still not `Done` when its turn comes (→ defer).
