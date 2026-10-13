# States

[← agile-sprint-drain](../README.md)

## One pass

Recomputed from the live board on every iteration.

```text
1. BUILD QUEUE  eligible To-Do tickets in sprint + repo scope, minus any with an
                unresolved blocker (blocker must be Done AND PR merged)     -> build_count
2. MERGE QUEUE  open PRs linked to this sprint's tickets (gh pr list)       -> merge_count
3. EXIT         build_count == 0 AND merge_count == 0                       -> DRAINED
4. ADMIT        free = N - (in-flight + open PRs); build in-flight + first `free` eligible
                call agile-10-implement (Skill tool) keys=<those>           -> fold outcomes
5. merge > 0    call agile-11-merge-train (Skill tool)                      -> fold outcomes
6. GUARD        recompute each item's fingerprint; retire an item human-blocked
                after K identical passes. actionable = items the loop can still advance
                actionable empty and items remain -> STUCK ; else loop
```

Pass banners stream so the alternation is readable: `══ drain pass N ══ eligible:X wip:W/N admit:A`, interleaved with the orchestrators' own `▶ TICKET` and `✓ TICKET` markers.

The loop keeps only structured per-item outcomes, never a re-narrated pass. Every phase and step (or each session, under `dispatch=session`) runs in its own agent and returns a capped receipt.

## A quiet pass is not a stop

A ticket is un-startable until its blocker's PR merges. But a pass that moves nothing is **not** proof the work is unresolvable: it may hold actionable retries, such as a flaky check that reruns green, a rework not yet attempted, or a review one fix-cycle from converging.

So the loop keeps going while **any** item is actionable and stops as STUCK only when **every** remaining item is human-blocked. The anti-spin guarantee is a per-item fingerprint: a flake that reruns green changes it and stays actionable; a genuinely stuck item repeats identically for K passes and is retired, while the others keep advancing.

## Audit-trail gate

Counters measure status, not evidence: a Done ticket with a merged PR may have no record of how it was built and reviewed. Before DRAINED, the loop re-reads **every** sprint ticket in a done status, not only those this invocation closed, and confirms each carries its phase markers and a post-merge comment naming the merged PR.

Missing either means **not drained**. Per ticket, backfill it (labelled retroactive, naming the PR and why it is late) or record a deliberate exception with the reason. The report shows `audit trail: N/N complete` or the exceptions.

## Ending states

**DRAINED.** Lists Done and merged tickets and any that exited legitimately (out-of-scope, Needs Info), then points at [agile-sprint-close](../../agile-sprint-close/README.md).

**STUCK.** The actionable set emptied, or the `MAX_PASSES` ceiling hit, with items remaining. Each remaining item is named with its class:

| Class | What you do |
|---|---|
| Parked critical decision | Answer the question |
| Needs Info / under-specified | Fix the ticket |
| Dead blocker chain | Resolve the named upstream blocker |
| CI failed identically K passes | Look at the repeated check |
| Unconverged review | Decide the review |
| Persistent conflict | Resolve it |
| Over its cost cap (agile-mods `ticketBudgetUsd`) | Raise the cap or allow once; its open PR still merges |

On a ceiling stop, still-actionable items are listed separately. Re-invoking handles them.

**PAUSED.** `max-merges` reached with actionable items left. Prints merged this invocation and items remaining. Not a failure.
