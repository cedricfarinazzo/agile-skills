# Concurrency

[← agile-execution](../README.md)

| Mode | What runs |
|---|---|
| `concurrency=0` | Every phase inline, no agent, no worktree |
| `concurrency=1` (default) | Each phase in its named `agile-execution:*` agent, one ticket at a time |
| `concurrency=N>1` | N independent tickets built in parallel, one git worktree per ticket shared by its whole phase chain |

Under `N>1` the phases still run one at a time within a ticket. The shared Docker stack stays serial in every mode, so PR monitoring and rework are sequential, and the merge train is always sequential.

## Test tiers

Classified automatically.

| Tier | Contents | Under `concurrency>1` |
|---|---|---|
| Stack-free | lint, unit, typecheck, migration history-linearity | Run locally in the worktree |
| Stack-bound | integration, e2e, apply-on-fresh-DB | Deferred to CI; the PR gets the `integration-deferred` label |

A project whose "unit" tests hit the database must run `concurrency=1`.

## Worktree cleanup

Per-ticket worktrees are the orchestrator's to remove. A `concurrency>1` run ends by removing the worktrees whose branch has merged. Unmerged ones are kept: an open PR's worktree is where a re-dispatched phase resumes. It never forces past uncommitted work. Left alone, worktrees accumulate and hold their branches, which turns a later branch delete into a spurious post-merge failure.
