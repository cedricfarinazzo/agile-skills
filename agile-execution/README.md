# agile-execution

**Autonomous build** plugin — takes a planned sprint and turns every eligible Story into an open, self-reviewed PR, unattended. The agile-side analogue of the merge train, modelled on `nightshift jira run`. Integrates with **Jira** and uses the **`gh`** CLI + git.

Part of [agile-skills](../README.md). Needs the Atlassian MCP + `gh`.

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-execution@agile-skills
/reload-plugins
```

## What's in it

| # | Skill | Role |
|---|-------|------|
| 10 | `agile-10-implement` | **Orchestrator** (user-invoked) — selects the board's work, orders it, drives each ticket through the pipeline |
| — | `implement-validate` | gate: repo-scope + readiness → pass / out-of-scope / rejected / critical-park |
| — | `implement-plan` | read ADR/Specs/PRD/bugs → concrete plan + AC→test map |
| — | `implement-code` | branch, implement per ADR/Specs, all-AC tests, lint+unit+integration green, commit, push (also the fix pass) |
| — | `implement-pr` | open/update the PR linked to the ticket |
| — | `implement-review` | six-lens **self-review** by the author; verdict + numbered blockers |
| — | `implement-monitor` | PR rework loop — new review comments, failing checks, conflicts |

The `implement-*` blocks are **unnumbered sub-skills** (`user-invocable: false` — hidden from the `/` menu, but the orchestrator still composes them via the Skill tool) — you don't call them directly. Invoke `/agile-execution:agile-10-implement` ("implement the sprint", "work the sprint", "pick up tickets").

## The loop (per ticket, in Jira dependency order)

```
validate → plan → code → pr → implement-review → (transition In Review) → monitor
```

Each phase posts a `🤖 <!-- agile:phase=x -->` Jira marker; a re-run resumes from the first unfinished phase — **partially-implemented tickets are picked up, never restarted** (plan done but no code → resume at code; code pushed but no PR → resume at PR). Markers are reconciled against the real git/gh artifacts (branch / commits / open PR) so a phase that crashed after doing the work but before posting its marker still resumes correctly, and marker timestamps keep a reworked ticket from routing back to the build phases. The orchestrator transitions the Story to **In Review** after self-review approves and **never** writes `Done` (that's the merge train).

## Board handling — Scrum & Kanban; never backlog/future

Detects the board type and selects accordingly:
- **Scrum** — `status To Do AND sprint in openSprints()`; excludes future sprints + the no-sprint backlog.
- **Kanban** — on-board tickets not in the backlog column (Agile-API backlog keys or `backlog-status-name`).

**Hard invariant:** a backlog or future-sprint ticket is never eligible — re-verified on every candidate after the JQL fetch.

## Autonomy — and the one thing it asks about

Full autonomy: invoking authorises the whole pipeline for every eligible ticket, no mid-loop confirmation. It decides and documents everything reversible (naming, structure, test approach, standard ADR patterns) and flags them in the PR.

It pauses **only** for a **critical decision** — irreversible / high-blast-radius **and** not derivable from ADR/PRD/Specs (destructive migration, auth/security change, breaking a shared contract, new paid/infra dependency, data-loss risk). Then it parks *that one ticket*, asks one consolidated question, and keeps the loop running on the others.

Other per-ticket exits (skip one, keep the run): out-of-scope (wrong repo), under-specified (→ Needs Info), or self-review not converging in ≤3 cycles.

## Operational rules

- **Strictly sequential** — one ticket at a time. Single shared Docker Compose stack: never run two tickets' build/test concurrently.
- **Delegate to subagents** — read-only/analysis work fans out in parallel; anything touching the shared stack does not (main thread serialises it).
- **Repo-scope gate** — `implement-validate` skips tickets targeting another repo (resolved from git `origin` + `repo` / `repo-component-map`).

## The author's self-review vs the merge gate

`implement-review` is the **author** reviewing their own fresh change and fixing it in-branch before handover — *not* the authoritative gate. The independent gate is `merge-review-pr` in [agile-merge-review](../agile-merge-review/README.md), run by a different person. (A third, global review happens at [sprint closeout](../agile-sprint-close/README.md).)

## Configuration

Reads the consumer repo's `CLAUDE.md` / `AGENTS.md` (`## Skill configuration`):

- `cloudId` (required), `ticket-prefix-regex` (default `[A-Z]+-\d+`)
- `repo` / `repo-component-map` — repo-scope gate
- `todo-/in-progress-/in-review-/done-/needs-info-/backlog-status-name` — matched by substring (localised names OK)
- `board-id` / `board-type` — pin when auto-detection is ambiguous
- `story-points-field` (default `customfield_10016`), `base-branch`, `branch-prefix` (default `feature/`)
- lint / unit / integration commands per stack

## Where it fits

After **agile-planning**; produces the PRs that **agile-merge-review** merges. See the [full cycle](../README.md#cycle-order).
