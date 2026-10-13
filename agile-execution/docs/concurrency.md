# Concurrency

[← agile-execution](../README.md)

| Mode | What runs |
|---|---|
| `concurrency=0` | Every phase inline, no agent, no worktree |
| `concurrency=1` (default) | Each phase in its named `agile-execution:*` agent, one ticket at a time |
| `concurrency=N>1` | Up to N independent tickets in flight, one git worktree per ticket shared by its whole phase chain. A finished ticket frees its slot at once |

Under `N>1` the phases still run one at a time within a ticket, and each phase agent works in the ticket's worktree by absolute path. The shared Docker stack stays serial in every mode, so PR monitoring and rework are sequential, and the merge train is always sequential.

## Test tiers

Classified automatically.

| Tier | Contents | Under `concurrency>1` |
|---|---|---|
| Stack-free | lint, unit, typecheck, migration history-linearity | Run locally in the worktree |
| Stack-bound | integration, e2e, apply-on-fresh-DB | Deferred to CI, because a worktree cannot hold the shared Docker stack; the PR gets the `integration-deferred` label |

A project whose "unit" tests hit the database must run `concurrency=1`.

## Worktree cleanup

Per-ticket worktrees are the orchestrator's to remove. A `concurrency>1` run ends by removing the worktrees whose branch has merged. Unmerged ones are kept: an open PR's worktree is where a re-dispatched phase resumes. It never forces past uncommitted work. Left alone, worktrees accumulate and hold their branches, which turns a later branch delete into a spurious post-merge failure.

## Admission

When a slot frees, the next eligible ticket in dependency order is admitted, checked against the tickets already in flight:

1. Mutually independent: no "is blocked by" edge among the in-flight set.
2. No planned-file overlap with a ticket still being built (compared from the `plan` receipt's `files-to-touch`, or `sprint-shared-file-audit`). Overlap with a sibling that already has an open PR does not block.
3. At most one migration-adding ticket in flight.
