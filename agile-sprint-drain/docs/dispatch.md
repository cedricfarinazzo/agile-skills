# Dispatch modes

[← agile-sprint-drain](../README.md)

## `dispatch=phase` (default)

The drain invokes both orchestrators **inline via the Skill tool**. Every phase runs in its own named agent one layer down. You get per-phase tool-grant enforcement, parallel builds under `concurrency=N`, and an independent build-side review.

## `dispatch=session`

Each pass dispatches two agents instead.

| Agent | Model / effort | Runs |
|---|---|---|
| `build-session` | opus / low | One build pass, all phases inline, prompt cache shared across a ticket's phases. Runs `agile-10-implement` with `concurrency=0`, at most `session-batch` tickets, and returns at `In Review` without waiting on CI |
| `merge-session` | sonnet / medium | One merge pass in a fresh context that never saw the authoring, so review stays independent. Runs `agile-11-merge-train` with `concurrency=0`. Dispatched only when a PR is actionable |

While every PR is still in CI, the drain watches each run in the background itself rather than paying a session to poll.

A session that reaches a CI wait ends with a handoff (`waiting: <run id>`, `resume_at`). The drain dispatches a **fresh** session from it once the run finishes. Sessions are never resumed, because subagent caches last 5 minutes. Dispatch depth stays 1: session agents never dispatch.

## Trade-off

`session` reuses cached reads (ticket, ADR, plan, touched files) across a ticket's phases instead of re-reading them cold in every phase agent. It gives up:

- parallel builds: one session at a time, the WIP limit still applies;
- per-phase tool-grant enforcement;
- an independent build-side review: `implement-review` becomes a self-check, and the merge session's review is the independent gate.
