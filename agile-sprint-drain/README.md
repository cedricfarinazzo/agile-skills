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
| — | `agile-sprint-drain` | **Outer orchestrator** (user-invoked) — alternates agile-10-implement and agile-11-merge-train to a fixed point, with a progress guard |

One user-invoked skill. Invoke `/agile-sprint-drain:agile-sprint-drain` ("drain the sprint", "run the sprint to completion", "implement and merge until done", "clear the whole board", "ship the sprint").

## Why it exists

`agile-10-implement` clears the build queue (`To Do` Story → open PR, `In Review`); `agile-11-merge-train` clears the merge queue (open PR → merged + `Done`). The two alternate to unblock each other: a ticket A blocked by B is eligible only once **B is `Done` and B's PR is merged**, so every merge pass can unlock new build work. Until now a human ran that loop by hand — deciding implement-vs-merge, `/compact`ing between calls, re-running. This skill is that scheduler.

## The loop (one **pass** per iteration; recomputed from the live board each time)

```
1. BUILD QUEUE — eligible To-Do tickets in sprint + repo scope, minus any with an
                 unresolved blocker (blocker must be Done AND PR merged).      → build_count
2. MERGE QUEUE — open PRs linked to this sprint's tickets (gh pr list).        → merge_count
3. EXIT      — build_count == 0 AND merge_count == 0  → DRAINED
4. build>0   → invoke agile-10-implement   → /compact
5. merge>0   → invoke agile-11-merge-train → /compact
6. GUARD     — progress = (To Do→In Review this pass) + (PRs merged this pass)
               progress == 0 → STUCK ;  else loop
```

Pass banners stream so the alternation is legible: `══ drain pass N ══ build:X merge:Y`, interleaved with the orchestrators' own `▶ TICKET` / `✓ TICKET` markers.

## Progress guard, not a retry counter

By the dependency gate a ticket is un-startable until its blocker's PR merges. If a full implement+merge pass moves zero tickets and merges zero PRs, no ticket can have become newly eligible — re-running would reproduce the identical pass. So the loop stops and reports instead of spinning. The guard is exact: A waits on B reaching `Done`+merged; it fires precisely when no B advanced.

## Eligibility & merged signal (mirrors the real sub-skills)

- **Blocker eligibility** mirrors `agile-10-implement`'s dependency-graph gate exactly: every **"is blocked by"** link must point to a ticket that is `<done-status-name>` **and** whose PR is merged. `In Review` ≠ cleared. (The gate is in `agile-10-implement`, not `implement-validate`, which only does repo-scope + readiness scoring.)
- **"PR merged this pass"** is read from **`gh` merge state** (`mergedAt` / `state == MERGED`) — `agile-11-merge-train` merges at 3f and only then transitions Jira to `Done` at 3g, so `gh` is the authoritative signal for the counter.

## What it does NOT do

- Never writes `Done`, opens PRs, or merges itself — it only **sequences** the two orchestrators, so every invariant they enforce (strictly sequential builds, single shared Docker stack, repo-scope gate, three-role review) is preserved.
- Does not bypass either orchestrator's pauses — a critical-decision park in implement still parks that one ticket; the guard treats it as no-progress and STUCK-stops if it's the only thing left.
- Does not invoke `agile-sprint-close`. On DRAINED it hands off to it.

## Reports

- **DRAINED** — lists Done + merged tickets and any that legitimately exited (out-of-scope, Needs Info); then points at [`agile-sprint-close`](../agile-sprint-close/README.md).
- **STUCK** — per remaining item, names the specific reason in terms of the gate: build ticket → which blocker(s) aren't yet Done+merged; open PR → why the merge train couldn't merge it (CI check name, unconverged review, conflict, parked critical decision). That's your work list — resolve one upstream PR and re-invoke.

## Configuration

Reads nothing extra — it inherits both orchestrators' `## Skill configuration` from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`cloudId`, status names, `base-branch`, repo / `repo-component-map`, lint/test commands, etc.).

## Where it fits

Between **agile-execution + agile-merge-review** (which it drives) and **agile-sprint-close** (which it hands off to). See the [full cycle](../README.md#cycle-order).
