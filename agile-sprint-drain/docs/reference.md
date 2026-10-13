# Reference

[← agile-sprint-drain](../README.md)

## Eligibility

Blocker eligibility mirrors `agile-10-implement`'s dependency-graph gate: every "is blocked by" link must point to a ticket that is `<done-status-name>` **and** whose PR is merged. In Review does not clear a blocker. The gate is in `agile-10-implement`, not `implement-validate`, which does only repo-scope and readiness scoring.

## Merged signal

"PR merged this pass" is read from `gh` merge state (`mergedAt` / `state == MERGED`). `agile-11-merge-train` merges at 3f and transitions Jira to Done only at 3g, so `gh` is the authoritative signal.

## WIP limit

`concurrency=N` is a limit on the whole chain: tickets started but not merged, plus open PRs. `N` stays positive: the requested positive concurrency, else positive `max-build-concurrency`, else `1`. An explicit `concurrency=0` selects inline execution without making admission zero. Child execution and admission are separate.

On Codex, plugin agent files are not registered. The workflow runs inline, passes `concurrency=0` to both child orchestrators while preserving `N`, and normalises every `dispatch` value to inline.

## Ledger

The ledger is the one piece of state not re-derivable from Jira and `gh` each pass. Per remaining item: `id`, `type` (build | in-flight | pr), `fingerprint`, `stall_count`, `state` (actionable | human-blocked + reason). Loop level: `pass_count`, `K`, `MAX_PASSES`.

- `MAX_PASSES = 2 × (initial build_count + merge_count) + 10`. The sole backstop against A/B/A/B oscillation the per-item counter cannot catch.
- Counters are per invocation. A re-invoke starts at 0, which is the human's decision to retry. The exception is a re-invoke after PAUSED, which restores them from the file.
- `.git/agile-drain/ledger.md` is rewritten at the end of every pass, so a context compaction loses nothing. It is deleted on DRAINED or STUCK and kept on PAUSED.

## Receipts

One line per item, folded into the ledger and dropped. A marker the receipt names but Jira lacks is an unapplied mutation; that ticket re-runs next pass.

## CI waits

At the top level, one `run_in_background` `gh run watch` per run id; one wake per run, never a `sleep` loop. A dispatched agent returns a handoff (`waiting: <run id>` or `ci-on <head sha> <branch>`, `resume_at`, state) and ends. The top level then dispatches a fresh agent with `ci: <run id> <conclusion> <head sha>`. The skill file carries the full rule under `## Waiting on CI`.

## Fingerprints and actionability

A fingerprint answers "did this item make real progress this pass?" An in-flight ticket fingerprints as a build ticket.

| Item | Fingerprint |
|---|---|
| Build ticket | Jira status, latest 🤖 phase-marker id, blocker-set hash, park / needs-info flag |
| Open PR | Hash of sorted failing check names and conclusions, `reviewDecision`, `mergeStateStatus`. Not the head SHA, which every rebase moves while the failure stays identical |

An item is **actionable** when the loop can still advance it:

- Build ticket: eligible with a build attempt left (`stall < K`), or deferred behind a blocker chain that bottoms out in an actionable item. Parked on a critical decision, sent to Needs Info, or behind an entirely human-blocked chain is human-blocked.
- Open PR: an un-retried CI check, a rework cycle the train has not attempted, or a rebasable conflict. Fix cycles exhausted, awaiting a human reviewer, or a parked critical decision is human-blocked.

K is 3 for PR and CI items and 2 for build tickets.

## WIP details

- Retired items keep their slot; if retired items hold every slot, the drain is STUCK.
- Starting over the limit (open PRs from an earlier run) admits nothing until `wip < N`; the banner says so.
- Why a limit: merges are sequential and each moves the base, so every open PR pays a rebase and a fresh CI run per merge ahead of it, O(P²) for P open PRs. A rebase is skipped when provably unnecessary (merged file set disjoint from the PR's, or the exercised subtree byte-identical).
- A ticket reported `blocked (BUDGET)` is retired from the build set while its open PR stays in the merge set.
