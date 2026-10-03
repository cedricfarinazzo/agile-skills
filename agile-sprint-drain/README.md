# <img src=".claude-plugin/icon.svg" width="40" alt="" align="top"> agile-sprint-drain

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
| — | `agile-sprint-drain` | **Outer orchestrator** (user-invoked) — alternates agile-10-implement and agile-11-merge-train (invoked inline via the Skill tool) to a fixed point, with an actionable-work guard; optional `concurrency=N` = WIP limit on the whole chain (build + open PRs); optional `dispatch=session`; optional `max-merges=N` stops as PAUSED after N merges, resumable from the on-disk ledger |

One user-invoked skill. Invoke `/agile-sprint-drain:agile-sprint-drain` in Claude Code or `$agile-sprint-drain` in Codex ("drain the sprint", "run the sprint to completion", "implement and merge until done", "clear the whole board", "ship the sprint").

On Codex, plugin-local agent files are not registered. The entire workflow runs inline with `concurrency=0`; every `dispatch` value is normalized to inline execution, and no phase, `build-session`, or `merge-session` agent is dispatched.

**Two agents, used only under `dispatch=session`.** By default (`dispatch=phase`) the drain invokes both orchestrators **inline via the Skill tool**, and every phase runs in its own named agent one layer down. Under `dispatch=session` each pass instead dispatches `build-session` (runs `agile-10-implement` with `concurrency=0`, at most `session-batch` tickets, returns at `In Review` without waiting on CI) and then a fresh `merge-session` (runs `agile-11-merge-train` with `concurrency=0`), dispatched only when a PR is actionable — while every PR is still in CI the drain watches each run in the background itself rather than paying a session to poll. A session that reaches a CI wait ends with a handoff (`waiting: <run id>`, `resume_at`), and the drain dispatches a fresh session from it once the run finishes; sessions are never resumed (subagent caches last 5 minutes). Dispatch depth stays 1: the session agents never dispatch.

| Agent | Model / effort | Runs |
|---|---|---|
| `build-session` | opus / low | one build pass, all phases inline, prompt cache shared across a ticket's phases |
| `merge-session` | sonnet / medium | one merge pass in a context that never saw the authoring — the independent reviewer |

Trade-off: `session` reuses cached reads (ticket, ADR, plan, touched files) across a ticket's phases instead of re-reading them cold in every phase agent. It gives up parallel builds (one session at a time; the WIP limit still applies), the per-phase tool-grant enforcement, and an independent build-side review — `implement-review` becomes a self-check, and the merge session's review is the independent gate.

## Why it exists

`agile-10-implement` clears the build queue (`To Do` Story → open PR, `In Review`); `agile-11-merge-train` clears the merge queue (open PR → merged + `Done`). The two alternate to unblock each other: a ticket A blocked by B is eligible only once **B is `Done` and B's PR is merged**, so every merge pass can unlock new build work. Until now a human ran that loop by hand — deciding implement-vs-merge, re-running each pass. This skill is that scheduler: it calls each orchestrator inline and folds only structured per-item outcomes into its ledger.

## The loop (one **pass** per iteration; recomputed from the live board each time)

```
1. BUILD QUEUE — eligible To-Do tickets in sprint + repo scope, minus any with an
                 unresolved blocker (blocker must be Done AND PR merged).      → build_count
2. MERGE QUEUE — open PRs linked to this sprint's tickets (gh pr list).        → merge_count
3. EXIT      — build_count == 0 AND merge_count == 0  → DRAINED
4. ADMIT     — free = N − (in-flight + open PRs); build in-flight + first `free` eligible
               → call agile-10-implement (Skill tool) keys=<those>              → fold outcomes
5. merge>0   → call agile-11-merge-train (Skill tool)                          → fold outcomes
6. GUARD     — recompute each item's fingerprint; retire an item human-blocked after
               K identical passes. actionable = items the loop can still advance.
               actionable empty & items remain → STUCK ;  else loop
```

Pass banners stream so the alternation is legible: `══ drain pass N ══ eligible:X wip:W/N admit:A`, interleaved with the orchestrators' own `▶ TICKET` / `✓ TICKET` markers. Context stays lean because every per-ticket phase and per-PR step (or, under `dispatch=session`, each session) runs in its own subagent and returns a capped receipt — the loop itself keeps only structured per-item outcomes, never a re-narrated pass.

## Actionable-work guard, not "zero progress"

By the dependency gate a ticket is un-startable until its blocker's PR merges — that insight stands. But a pass that nets zero board movement is **not** proof the work is unresolvable: it may still hold actionable retries (a flaky CI check that reruns green, a rework not yet attempted, a review one fix-cycle from converging). The old "progress == 0 → STUCK" guard stopped on the first such pass and gave up too early. Instead the loop keeps going while **any** item is actionable and STUCKs only when **every** remaining item is human-blocked (parked decision, dead blocker chain, CI failing identically K passes, unconverged review, persistent conflict). The anti-spin guarantee is a **per-item state fingerprint**: a flake that reruns green changes the fingerprint and stays actionable; a genuinely stuck item reproduces identically K passes running and is retired — while every other item keeps advancing. **DRAINED — all tickets Done and PRs merged — is the only healthy stop.**

## Eligibility & merged signal (mirrors the real sub-skills)

- **Blocker eligibility** mirrors `agile-10-implement`'s dependency-graph gate exactly: every **"is blocked by"** link must point to a ticket that is `<done-status-name>` **and** whose PR is merged. `In Review` ≠ cleared. (The gate is in `agile-10-implement`, not `implement-validate`, which only does repo-scope + readiness scoring.)
- **"PR merged this pass"** is read from **`gh` merge state** (`mergedAt` / `state == MERGED`) — `agile-11-merge-train` merges at 3f and only then transitions Jira to `Done` at 3g, so `gh` is the authoritative signal for the counter.

## What it does NOT do

- Never writes `Done`, opens PRs, or merges itself — it only **sequences** the two orchestrators, so every invariant they enforce (at most `concurrency=N` tickets started-but-unmerged across the whole chain; single shared Docker stack; strictly sequential merge; repo-scope gate; three-role review; per-step receipt verification) is preserved.
- Does not bypass either orchestrator's pauses — a critical-decision park in implement still parks that one ticket; the guard marks it human-blocked and keeps running on other actionable items, STUCK-stopping only when the actionable set empties.
- Does not invoke `agile-sprint-close`. On DRAINED it hands off to it.

## Reports

- **DRAINED** — lists Done + merged tickets and any that legitimately exited (out-of-scope, Needs Info); then points at [`agile-sprint-close`](../agile-sprint-close/README.md).
- **STUCK** — the actionable set emptied (or the `MAX_PASSES` ceiling hit) while items remain; per remaining item, names its human-blocked class: parked critical decision, Needs Info, dead blocker chain, CI failed identically K passes (+ the repeated check), unconverged review, or persistent conflict. That's your work list — resolve one upstream blocker and re-invoke.

## Configuration

`session-batch` (optional, default `1`) — max tickets per `build-session` under `dispatch=session`. Run state (`context.md`, `ledger.md`) lives in `.git/agile-drain/`, never committed; for a long sprint, `/loop /agile-sprint-drain max-merges=N` runs each chunk in a fresh context. Otherwise reads nothing extra — it inherits both orchestrators' `## Skill configuration` from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`cloudId`, status names, `base-branch`, repo / `repo-component-map`, lint/test commands, etc.).

## Where it fits

Between **agile-execution + agile-merge-review** (which it drives) and **agile-sprint-close** (which it hands off to). See the [full cycle](../README.md#cycle-order).
