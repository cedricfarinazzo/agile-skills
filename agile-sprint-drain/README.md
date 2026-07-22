# agile-sprint-drain

**Sprint-drain** plugin — runs the active sprint to a fixed point in one watched session by auto-alternating the **build** queue ([agile-10-implement](../agile-execution/README.md)) and the **merge** queue ([agile-11-merge-train](../agile-merge-review/README.md)) until the Jira dependency graph is fully resolved. It removes the human from the implement ↔ merge alternation — you watch, you no longer schedule.

Part of [agile-skills](../README.md). **Requires the `agile-execution` and `agile-merge-review` plugins installed** (it composes their orchestrators). Needs the Atlassian MCP + `gh`.

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-execution@agile-skills
/plugin install agile-merge-review@agile-skills
/plugin install agile-sprint-drain@agile-skills
/reload-plugins
```

## What's in it

| # | Skill | Role |
|---|-------|------|
| — | `agile-sprint-drain` | **Outer orchestrator** (user-invoked) — alternates agile-10-implement and agile-11-merge-train (invoked inline via the Skill tool) to a fixed point, with an actionable-work guard; optional `concurrency=N` passed through to the build |

One user-invoked skill. Invoke `/agile-sprint-drain:agile-sprint-drain` ("drain the sprint", "run the sprint to completion", "implement and merge until done", "clear the whole board", "ship the sprint").

**No agents.** This plugin ships no `agents/` dir: the drain invokes both orchestrators **inline via the Skill tool**. Wrapping an orchestrator in a subagent cannot work — subagent dispatch does not nest, and an orchestrator's whole job is to dispatch. The parallelism lives one layer down, in `agile-10-implement`'s per-ticket worktree dispatch (`concurrency=N`), which is unaffected.

## Why it exists

`agile-10-implement` clears the build queue (`To Do` Story → open PR, `In Review`); `agile-11-merge-train` clears the merge queue (open PR → merged + `Done`). The two alternate to unblock each other: a ticket A blocked by B is eligible only once **B is `Done` and B's PR is merged**, so every merge pass can unlock new build work. Until now a human ran that loop by hand — deciding implement-vs-merge, re-running each pass. This skill is that scheduler: it calls each orchestrator inline and folds only structured per-item outcomes into its ledger.

## The loop (one **pass** per iteration; recomputed from the live board each time)

```
1. BUILD QUEUE — eligible To-Do tickets in sprint + repo scope, minus any with an
                 unresolved blocker (blocker must be Done AND PR merged).      → build_count
2. MERGE QUEUE — open PRs linked to this sprint's tickets (gh pr list).        → merge_count
3. EXIT      — build_count == 0 AND merge_count == 0  → DRAINED
4. build>0   → call agile-10-implement (Skill tool) [concurrency=N]            → fold outcomes
5. merge>0   → call agile-11-merge-train (Skill tool)                          → fold outcomes
6. GUARD     — recompute each item's fingerprint; retire an item human-blocked after
               K identical passes. actionable = items the loop can still advance.
               actionable empty & items remain → STUCK ;  else loop
```

Pass banners stream so the alternation is legible: `══ drain pass N ══ build:X merge:Y`, interleaved with the orchestrators' own `▶ TICKET` / `✓ TICKET` markers. Context stays lean because every per-ticket phase and per-PR step runs in its own subagent and returns a capped receipt — the loop itself keeps only structured per-item outcomes, never a re-narrated pass.

## Actionable-work guard, not "zero progress"

By the dependency gate a ticket is un-startable until its blocker's PR merges — that insight stands. But a pass that nets zero board movement is **not** proof the work is unresolvable: it may still hold actionable retries (a flaky CI check that reruns green, a rework not yet attempted, a review one fix-cycle from converging). The old "progress == 0 → STUCK" guard stopped on the first such pass and gave up too early. Instead the loop keeps going while **any** item is actionable and STUCKs only when **every** remaining item is human-blocked (parked decision, dead blocker chain, CI failing identically K passes, unconverged review, persistent conflict). The anti-spin guarantee is a **per-item state fingerprint**: a flake that reruns green changes the fingerprint and stays actionable; a genuinely stuck item reproduces identically K passes running and is retired — while every other item keeps advancing. **DRAINED — all tickets Done and PRs merged — is the only healthy stop.**

## Eligibility & merged signal (mirrors the real sub-skills)

- **Blocker eligibility** mirrors `agile-10-implement`'s dependency-graph gate exactly: every **"is blocked by"** link must point to a ticket that is `<done-status-name>` **and** whose PR is merged. `In Review` ≠ cleared. (The gate is in `agile-10-implement`, not `implement-validate`, which only does repo-scope + readiness scoring.)
- **"PR merged this pass"** is read from **`gh` merge state** (`mergedAt` / `state == MERGED`) — `agile-11-merge-train` merges at 3f and only then transitions Jira to `Done` at 3g, so `gh` is the authoritative signal for the counter.

## What it does NOT do

- Never writes `Done`, opens PRs, or merges itself — it only **sequences** the two orchestrators, so every invariant they enforce (builds sequential by default / opt-in concurrent via a passed-through `concurrency=N`; single shared Docker stack; strictly sequential merge; repo-scope gate; three-role review; per-step receipt verification) is preserved.
- Does not bypass either orchestrator's pauses — a critical-decision park in implement still parks that one ticket; the guard marks it human-blocked and keeps running on other actionable items, STUCK-stopping only when the actionable set empties.
- Does not invoke `agile-sprint-close`. On DRAINED it hands off to it.

## Reports

- **DRAINED** — lists Done + merged tickets and any that legitimately exited (out-of-scope, Needs Info); then points at [`agile-sprint-close`](../agile-sprint-close/README.md).
- **STUCK** — the actionable set emptied (or the `MAX_PASSES` ceiling hit) while items remain; per remaining item, names its human-blocked class: parked critical decision, Needs Info, dead blocker chain, CI failed identically K passes (+ the repeated check), unconverged review, or persistent conflict. That's your work list — resolve one upstream blocker and re-invoke.

## Configuration

Reads nothing extra — it inherits both orchestrators' `## Skill configuration` from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`cloudId`, status names, `base-branch`, repo / `repo-component-map`, lint/test commands, etc.).

## Where it fits

Between **agile-execution + agile-merge-review** (which it drives) and **agile-sprint-close** (which it hands off to). See the [full cycle](../README.md#cycle-order).
