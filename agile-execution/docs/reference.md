# Reference

[← agile-execution](../README.md)

## Sub-skills

| Skill | Role |
|---|---|
| `implement-validate` | Repo-scope check and readiness score: pass, out-of-scope, rejected (Needs Info) or critical-park |
| `implement-plan` | Reads ADR, Specs, PRD and linked bugs; produces the file-level plan and AC→test map, posted as the `🤖 plan` marker |
| `implement-code` | Branch, implement per ADR and Specs with all-AC tests, gate green, commit, push. Also the fix pass. Sequential gate: lint, unit, integration, e2e, fresh-DB migration. Concurrent: stack-free local, integration and e2e in CI |
| `implement-pr` | Opens or updates the PR linked to the ticket, with AC coverage, ADR compliance and `Test tiers` sections |
| `implement-review` | The author's six-lens self-review; verdict plus a verified receipt (files read = diff, a cite per lens and per AC) |
| `implement-monitor` | PR rework loop: new review comments, failing checks, conflicts |

## Agents

One per dispatch point, sized to the phase. Each invokes its sub-skill through the Skill tool.

| Agent | Runs | Model / effort | Why |
|---|---|---|---|
| `agile-execution:ticket-validator` | `implement-validate` | sonnet / low | a gate whose miss wastes a whole ticket build |
| `agile-execution:ticket-planner` | `implement-plan` | opus / medium | nothing downstream re-derives the plan |
| `agile-execution:build-implementer` | `implement-code` | opus / medium | writes the code everything else is measured against; `pr-reviewer` re-reads it |
| `agile-execution:pr-publisher` | `implement-pr` | sonnet / low | assembles a body from the diff and markers |
| `agile-execution:self-reviewer` | `implement-review` | sonnet / medium | validates and publishes the author's verdict |
| `agile-execution:review-lens` | lens fan-out, opt-in for a large PR only (default is one single-pass six-lens read, no subagents) | sonnet / medium | read-only evidence that `self-reviewer` validates |
| `agile-execution:build-monitor` | `implement-monitor` | sonnet / low | owns the flake-vs-regression call and fixes on the shared stack |

## Dispatch and verify

The orchestrator runs no phase's work itself. Every phase, including `implement-review`, runs in its named agent and returns a **receipt**. The orchestrator checks it against git, `gh` and Jira before advancing. For a large PR it first fans out read-only `review-lens` evidence, then `self-reviewer` validates, aggregates and publishes.

A receipt is re-dispatched when a validate `pass` has no score breakdown, a review's files-read list differs from the PR diff, or the receipt is contradicted by ground truth.

## CI waits

CI waits never run inside an agent. A background task wakes only the top-level session, so `build-monitor` returns a handoff (`waiting: <run id>`, `resume_at`) when checks are still running. The orchestrator watches the run and dispatches a fresh monitor when it finishes.

## Red checks

`implement-monitor` triages by **severity**: the failing error, not the noisier warnings. A **SKIPPED** job is a symptom; it walks the dependency chain to the gate that failed.

"Pre-existing", "unrelated", "environment" and "tooling drift" need **base-branch proof**: the same command on the base branch, exit codes compared. Filenames in the output being untouched by the diff is not evidence.

An identical repeat failure is real only if the diff can reach the test. A byte-identical subtree that is green on the base branch means load or timing, so retry uncontended.

## A guard test must reach its guard

A negative assertion whose input an earlier layer rejects first (field width, coercion, nullability, referential integrity, an upstream validator) proves nothing even when it passes. The AC/DoD lens of `implement-review` blocks on it.

## Pushes, fix rounds and the ticket cap

- Each push names its branch: `git push <remote> <branch>`, alone or after `git add` / `git commit` in the same command.
- An open PR gets at most 3 fix rounds after review by default (agile-mods `fixRounds`), Phase 2 rework and the merge train's 3c counted together. One more leaves the ticket as an unconverged review.
- A refusal starting `agile-mods: ticket budget:` (a ticket's agents cost its `ticketBudgetUsd`) stops that ticket's build, reported `blocked (BUDGET)`. Other tickets and its open PR go on.

[agile-mods](../../agile-mods/docs/guards.md) enforces all three when installed.

## Self-review vs the merge gate

`implement-review` is the author reviewing their own fresh change and fixing it in-branch. It is not the authoritative gate; that is `merge-review-pr` in [agile-merge-review](../../agile-merge-review/README.md), run by a different agent. A third, global review happens at [sprint closeout](../../agile-sprint-close/README.md).
