---
name: agile-sprint-drain
description: "Drain the active sprint to a fixed point: auto-alternate agile-10-implement (build) and agile-11-merge-train (merge) until both empty (DRAINED) or blocked (STUCK). Optional concurrency=N. Triggers: drain the sprint, run the sprint to completion, implement and merge until done, clear the whole board, ship the sprint."
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
  `agile-11-merge-train`) by **dispatching each to an `Agent` subagent** (which
  invokes the orchestrator via the Skill tool) and does nothing if either is absent.
- Consumer repo `CLAUDE.md` / `AGENTS.md` `## Skill configuration` is present
  (this skill reads nothing extra — it inherits both orchestrators' config:
  `cloudId`, status names, `base-branch`, lint/test commands, `max-build-concurrency`, etc.).

**Input:** optional `concurrency=N` — passed straight through to `agile-10-implement`
on the build (step 4) call only; the merge call is never given concurrency (the train is
always sequential). Absent → the build orchestrator's own default (`max-build-concurrency`
or `1`).

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
           dispatch a subagent: agile-10-implement [concurrency=N]   # build queue
           # the subagent returns ONLY a pass-outcome ledger, never its transcript
           fold its ledger into LEDGER

      5. if merge_count > 0:
           dispatch a subagent: agile-11-merge-train                # merge queue -> Done
           # strictly sequential; returns ONLY a pass-outcome ledger
           fold its ledger into LEDGER

      6. ACTIONABLE-WORK GUARD (update LEDGER, then decide):
           for each remaining item (build ticket / open PR):
             recompute its fingerprint (below)
             fingerprint changed vs last pass -> stall_count = 0    (real progress)
             fingerprint identical            -> stall_count += 1
             stall_count >= K                 -> retire as HUMAN-BLOCKED (reason)
           actionable = remaining items that are NOT human-blocked
                        AND have a loop-performable retry
           if actionable is empty AND items remain  -> STUCK (report each reason)
           if pass_count > MAX_PASSES               -> STUCK (oscillation ceiling)
           else                                     -> goto PASS

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

### The LEDGER, fingerprints, and what counts as actionable

The loop carries a small **LEDGER** across passes — the one piece of state that is
**not** re-derivable from Jira/`gh` each pass. Per remaining item: `id`, `type`
(build | pr), `fingerprint`, `stall_count`, `state` (actionable | human-blocked +
reason). Loop-level: `pass_count`, constants `K` and `MAX_PASSES`.

**Fingerprint** — the check for "did this item actually change this pass":
- **build ticket:** `(jira status, latest 🤖 phase-marker id, blocker-set hash, park/needs-info flag)`
- **open PR:** `(head SHA, hash of sorted failing-check-names+conclusions, reviewDecision, mergeStateStatus)`

A **changed** fingerprint (new commit, a check flipped green, a new review, a blocker
moved) means real progress → reset `stall_count = 0`. An **identical** fingerprint with
no progress → `stall_count += 1`. At `stall_count >= K` the item is **retired as
human-blocked** — it is failing identically and the loop can't move it.

**Actionable** = a remaining item the loop itself can still advance:
- **build ticket** — eligible (unblocked) with a build attempt left (`stall < K`); OR
  deferred but its blocker chain bottoms out in an actionable item (the blocker may
  still clear). A ticket parked on a critical decision, sent to Needs Info, or whose
  blocker chain is entirely human-blocked → **human-blocked**.
- **open PR** — a CI check not yet retried, a rework/review-fix cycle the merge train
  hasn't attempted, or a rebasable conflict. Review unconverged but still inside the
  train's ≤N fix cycles → actionable; cycles exhausted / awaiting a human reviewer, or a
  parked critical decision → **human-blocked**.

Recommended **K = 3** for PR/CI items (a legitimate long rework can look identical for
a pass or two; a new commit or check run resets it), **K = 2** for build tickets (a park
/ Needs-Info is human-blocked on pass 1 anyway). `MAX_PASSES` is an oscillation ceiling
for the A/B/A/B case the per-item counter can't catch.

### Why an actionable-work guard, not "zero progress this pass"

By the dependency gate, a ticket is un-startable until its blocker's PR merges — that
core insight stands: A waits on B reaching `Done` + merged. But a pass that nets zero
board movement is **not** proof the work is unresolvable. It may still hold **actionable
retries**: a flaky CI check that reruns green, a rework the loop hasn't attempted yet, a
review one fix-cycle from converging, a transient infra blip. The old "progress == 0 →
STUCK" guard stopped on the first such pass and abandoned exactly the work the loop was
built to grind through. That was the premature stop.

So the loop keeps going while **any** item is actionable, and STUCKs only when **every**
remaining item is human-blocked (blocked on something outside the loop's power). The
anti-spin guarantee is the **per-item state fingerprint**, not a global retry cap: a
flake that reruns green changes the fingerprint and stays actionable; a genuinely stuck
check reproduces the identical fingerprint K passes running and is retired — while every
other item keeps advancing. A global counter would blindly halt the whole loop after N
passes regardless of progress elsewhere; the per-item fingerprint retires only the item
that is actually stuck. That distinction is why the counter is safe here where a global
one was not. **DRAINED — all tickets Done and PRs merged — is the only healthy stop.**

## Lean context — the loop runs uninterrupted

Both orchestrators run **inside `Agent` subagents** (step 4 dispatches
`agile-10-implement`; step 5 dispatches `agile-11-merge-train`), and each returns **only a
size-capped pass-outcome ledger** — never its transcript. The heavy detail (per-ticket
plans, diffs, review threads, CI-poll logs) stays in the subagent and is discarded on
return, so the outer loop holds only the LEDGER and stays lean across every pass without
interruption.

The subagent's return must be **only** the structured pass-outcome block (per-item outcome
+ fingerprint inputs), size-capped — never echo a full report into the outer loop, or it
regrows. The queue snapshot (ticket→status, open PRs, blocker map) is recomputed from the
live board each pass; only the fingerprint/stall history is carried in the LEDGER, since it
is the one thing not re-derivable from Jira/`gh`.

## Shared-CI note

A drain pass can leave several open PRs at once. On a **capacity-limited CI runner** (a self-hosted / single shared runner), several PRs' heavy jobs (full-stack / e2e) running concurrently can OOM-cancel each other — reported as `CANCELLED`, not `FAILURE`. When the CI backend is capacity-limited, monitor and merge the open PRs **serially** (one PR's heavy jobs at a time) rather than watching them all in parallel.

**Concurrency raises this pressure.** A concurrent build (`concurrency=N`) intentionally opens N PRs at once — and because it defers integration + e2e to CI, those N PRs each run their heaviest jobs *in CI* rather than locally. So N multiplies the simultaneous heavy-CI load: keep N ≤ the CI runner's real parallel capacity, or `1` on a single shared runner. The `CANCELLED`-not-`FAILURE` fingerprint of an OOM-cancelled job is exactly the kind of transient the actionable-work guard keeps retrying (the fingerprint changes on rerun) rather than STUCK-ing on.

## What it does NOT do

- It does not bypass either orchestrator's own pauses. A **critical decision**
  parked by `agile-10-implement` still parks that one ticket and surfaces the
  consolidated question; the drain marks that ticket **human-blocked** in the LEDGER
  (removed from the actionable set) and keeps running on every other actionable item —
  it STUCK-stops only when the actionable set empties, not on the first pass a parked
  ticket makes no progress.
- It does not write `Done` itself, open PRs itself, or merge itself — it only
  **dispatches and sequences** the two orchestrators (each in its own subagent for
  context isolation, so the loop runs uninterrupted). All invariants they enforce
  (builds **sequential by default, opt-in concurrent** via the passed-through
  `concurrency=N`; single shared Docker stack; strictly sequential merge; repo-scope
  gate; three-role review; per-step receipt verification) are preserved because the
  work still flows through them unchanged.
- It does not touch `agile-sprint-close`. When the board is DRAINED, it hands off:
  "build + merge queues empty — run `agile-sprint-close`."

## Reports

**DRAINED** — the only healthy stop: **nothing remains** — every sprint ticket `Done`
+ merged (or legitimately exited: out-of-scope, Needs Info). Any item still on the
board that is human-blocked means items remain, so the outcome is STUCK, not DRAINED.
List Done tickets, and any that exited with the reason. Then point at `agile-sprint-close`.

**STUCK** — the actionable set is empty (or the `MAX_PASSES` ceiling was hit) while
items remain. The loop kept retrying every actionable item and stopped only when all
remaining work was human-blocked. For each remaining item, name its human-blocked class:
- **parked critical decision** — awaiting the user's answer;
- **Needs Info / under-spec** — validation-rejected;
- **dead blocker chain** — name the human-blocked blocker it waits on;
- **CI failed identically K passes** — name the check + the fingerprint that repeated;
- **unconverged review** — >N fix cycles, or awaiting a human reviewer;
- **persistent conflict**.
If the stop was the `MAX_PASSES` ceiling, list separately any items that were still
actionable but hit the ceiling (oscillation) — the human can just re-invoke for those.
This is the human's work list — resolve any one upstream blocker and re-invoke.

## Markers

Reuse the orchestrators' streaming markers; add pass banners so the alternation is
legible:

    ══ drain pass 1 ══  build:5  merge:0  (concurrency 3)
    ▶ agile-10-implement subagent → ledger
    ✓ VC-101 → In Review  ✓ VC-102 → In Review  … (build subagent drains 5)
    ══ drain pass 1 (merge) ══  open PRs:5
    ▶ agile-11-merge-train subagent → ledger
    ✓ VC-101 PR #88 merged → Done  … (merge subagent drains 5)
    ══ drain pass 2 ══  build:3  merge:0   (3 newly unblocked by pass-1 merges)
    …
    ══ DRAINED ══  12 tickets Done, 0 remaining

Each orchestrator runs in a subagent and streams its own markers inside; the outer
loop shows only the pass banners + per-item outcomes folded from each ledger.
