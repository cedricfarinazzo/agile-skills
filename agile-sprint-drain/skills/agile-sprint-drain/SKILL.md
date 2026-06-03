---
name: agile-sprint-drain
description: "Drain the active sprint to a fixed point: auto-alternate agile-10-implement (build queue) and agile-11-merge-train (merge queue), compacting between, until both empty. Each merge unblocks the next build pass; a progress guard stops with a report instead of spinning on a blocked ticket. Triggers: drain the sprint, run the sprint to completion, implement and merge until done, clear the whole board, ship the sprint."
user-invocable: true
---

# agile-sprint-drain

Outer scheduler that removes the human from the implement ↔ merge alternation.

`agile-10-implement` turns every **eligible** `To Do` Story into an open,
self-reviewed PR (`In Review`). `agile-11-merge-train` reviews and merges those
PRs, writing each ticket to **Done**. A ticket A that is blocked by ticket B is
only eligible once **B is `Done` and B's PR is merged** — so every merge pass can
unlock new build work. This skill runs that loop to a fixed point.

You watch the same marker stream; you no longer decide implement-vs-merge.

## Preconditions

- A sprint is active (Scrum: `openSprints()`; Kanban: on-board, non-backlog).
- The **`agile-execution`** and **`agile-merge-review`** plugins are installed —
  this skill composes their orchestrators (`agile-10-implement`,
  `agile-11-merge-train`) via the Skill tool and does nothing if either is absent.
- Consumer repo `CLAUDE.md` / `AGENTS.md` `## Skill configuration` is present
  (this skill reads nothing extra — it inherits both orchestrators' config:
  `cloudId`, status names, `base-branch`, lint/test commands, etc.).

## The loop

Each iteration is one **pass**. Before each pass, compute queue state from the
live board — never from memory of a previous pass.

    PASS:
      1. BUILD QUEUE  — eligible build tickets:
           JQL: status = <todo-status-name>
                AND <sprint scope: openSprints() | on-board non-backlog>
                AND <repo scope per repo / repo-component-map>
         then drop any ticket with an unresolved blocker:
           a ticket is ELIGIBLE only if every "is blocked by" link points to a
           ticket that is <done-status-name> AND whose PR is merged.
         build_count = number of eligible tickets

      2. MERGE QUEUE  — open PRs linked to sprint tickets (gh pr list, filtered to
         this sprint's tickets, excluding draft if your convention excludes drafts):
         merge_count = number of open PRs

      3. EXIT CHECK:
           if build_count == 0 AND merge_count == 0  -> DRAINED (success report)

      4. if build_count > 0:
           invoke agile-10-implement   (drains the eligible build queue)
           /compact   (keep ONLY: ticket IDs + statuses, PR numbers + states,
                       blocker map, this-pass counters; drop implementation detail)

      5. if merge_count > 0:
           invoke agile-11-merge-train  (drains the merge queue -> tickets to Done)
           /compact   (same retained state as above)

      6. PROGRESS GUARD:
           progress = (tickets moved To Do->In Review this pass)
                    + (PRs merged this pass)
           if progress == 0  -> STUCK (stop, stuck report)
           else              -> goto PASS

### Eligibility — mirror agile-10-implement exactly

The blocker gate lives in **`agile-10-implement`** (its dependency-graph step), not
in `implement-validate` (which only does repo-scope + readiness scoring). Mirror
`agile-10-implement` exactly so the two never disagree:

- Build the blocker set from each ticket's `issuelinks` — the **"is blocked by"**
  link type (the inbound side of `blocks`).
- A blocker counts as cleared **only** when it is `<done-status-name>` **and** its
  PR is merged. `In Review` ≠ cleared: an open PR's code is not on the base branch,
  so anything depending on it stays **deferred**. Never stub, stack, or branch off
  an unmerged blocker to fake eligibility.
- A build ticket is eligible iff **every** "is blocked by" link is cleared by that
  rule. Otherwise it is deferred and does not count toward `build_count`.

Unlike a single `agile-10-implement` run (where a blocker may clear *earlier in the
same run*), across drain passes a blocker only clears when its PR actually **merges**
in a merge-train pass — which is exactly what makes the next pass produce new work.

### Progress signal — what counts as merged

The authoritative "PR merged this pass" signal is **`gh` merge state**, not the
Jira marker. `agile-11-merge-train` merges at its 3f step (confirming `mergedAt` is
set) and only then does `merge-jira-postmortem` transition the ticket to `Done` at
3g. So count a PR as merged when `gh` reports it merged:

    gh pr view <N> --json mergedAt,state   # state == MERGED / mergedAt set

The `To Do -> In Review` half of the counter comes from `agile-10-implement`'s
per-ticket outcomes this pass (each `✓ TICKET -> In Review`).

### Why the progress guard, not a retry counter

By the dependency gate, a ticket is un-startable until its blocker's PR merges.
If a whole implement+merge pass changes nothing — every remaining build ticket is
blocked, and every open PR failed to merge (CI red, review not converging in the
merge train's own ≤N cycles, or a parked critical decision) — then the remaining
work is **blocked on something this loop cannot resolve by itself**. Spinning
again would reproduce the identical pass. Stop and report instead.

This is strictly tied to the gate: A waits on B reaching `Done` + merged. The
guard fires exactly when no B advanced, so no A can have become eligible.

## Compaction

`/compact` after each orchestrator call. The only state the next pass needs is the
queue snapshot, which is cheap to recompute from Jira/`gh` anyway — so the
compaction summary just has to preserve: sprint id, ticket->status map,
ticket->blockers map, open PR list, and the running per-pass counters. Per-ticket
plans, diffs, and review threads are disposable; the underlying skills re-derive
them from Jira markers and git artifacts on the next pass (both orchestrators
already resume from markers, never restart).

## What it does NOT do

- It does not bypass either orchestrator's own pauses. A **critical decision**
  parked by `agile-10-implement` still parks that one ticket and surfaces the
  consolidated question; the drain treats a parked ticket as "no progress on that
  ticket" for the guard, and will STUCK-stop if the parked ticket is the only
  thing left.
- It does not write `Done` itself, open PRs itself, or merge itself — it only
  sequences the two orchestrators. All invariants they enforce (strictly
  sequential builds, single shared Docker stack, repo-scope gate, three-role
  review) are preserved because the work still flows through them unchanged.
- It does not touch `agile-sprint-close`. When the board is DRAINED, it hands off:
  "build + merge queues empty — run `agile-sprint-close`."

## Reports

**DRAINED** — every sprint ticket `Done` + merged (or legitimately exited:
out-of-scope, Needs Info). List Done tickets, and any that exited with the reason.
Then point at `agile-sprint-close`.

**STUCK** — a pass made zero progress. For each remaining item, state why it could
not advance, in terms of the gate:
- build ticket -> which blocker(s) are not yet `Done`+merged;
- open PR -> why the merge train could not merge it (CI check name, unconverged
  review, conflict, or parked critical decision).
This is the human's work list — resolve any one upstream PR and re-invoke.

## Markers

Reuse the orchestrators' streaming markers; add pass banners so the alternation is
legible:

    ══ drain pass 1 ══  build:5  merge:0
    ▶ VC-101 — implementing
    ✓ VC-101 → In Review
    … (implement drains 5)
    /compact
    ══ drain pass 1 (merge) ══  open PRs:5
    ✓ VC-101 PR #88 merged → Done
    … (merge train drains 5)
    /compact
    ══ drain pass 2 ══  build:3  merge:0   (3 newly unblocked by pass-1 merges)
    …
    ══ DRAINED ══  12 tickets Done, 0 remaining
