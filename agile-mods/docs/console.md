# Agile console

[← agile-mods](../README.md)

`/agile-board [board | flow | wip | drain | guards | links | show | hide | retro | reset]` · always active · code: `hooks/state/board.ts` (state), `hooks/state/flow.ts` (spend, cache, aging, forecast, overlap), `hooks/state/agents.ts` (agents lane), `hooks/state/console.ts` (views), drawing in `hooks/register.tsx`

A live view of the agile loop. It answers "where is the loop, is it stuck, what does it cost, when will it be done, and what did the guards refuse?" without reading the transcript. It draws in three places, from one board the mod reads itself from gh and Jira (see [What updates the board](#what-updates-the-board)), kept in `$.store` per repo, so a resumed session shows where the loop stood.

| Where | Shows |
|---|---|
| Status line | `agile ▸ drain p3 merge · 13/21 pts · 4 merged · $3.10/h $1.40/PR · 85% by Thu` (with a budget set, `$12.40/$20` too); cleared when the loop is idle |
| One row above the prompt | Only when something needs a person or just ended: parked tickets, looping work, a spent budget, a PR open past the repo's 85th percentile, a stage whose cache hit rate dropped (yellow), `STUCK` (red), `DRAINED` (green). Nothing otherwise, so the band stays free for other mods |
| The console pane | Six tabs, below |

`/agile-board` opens the pane (focused, Esc closes it) at the tab you last used, or at the tab you name. The pane docks beside the transcript in a fullscreen terminal of 110 columns or more and sits above the prompt otherwise. When an `agile-sprint-drain` starts, the pane also opens by itself, unfocused, where the terminal is 144 columns or more wide; the `autoOpen` option (`/plugin configure agile-mods@agile-skills`) turns that off. Tabs have the hotkeys `1` to `6` while the pane has the keyboard (click it, or `ctrl+x` then `tab`).

## Tabs

| Tab | Shows |
|---|---|
| 1 Board | Loop and drain header with elapsed time; when gh and Jira last answered, or why they failed; work left as a gauge; tiles for built, merged and parked or blocked; the burnup; the forecast; everything that needs a person |
| 2 Flow | Build: one row per open ticket, five dots for `plan`, `implement`, `validate`, `review`, `pr`, its latest Jira marker (or its Jira status) and PR. Merge: one row per PR with a cell per train step (`3a 3b 3c 3e 3f 4`: `✔` reached, `●` current, `✖` red CI) and the CI state of its head |
| 3 WIP | Aging: each open PR and each in-progress ticket without one, as a bar of its age with the repo's 50th and 85th percentile lines. Overlap: open PRs that change the same file, and top directories more than one open PR changes |
| 4 Drain | One bar per pass, split into build time (cyan) and merge time (magenta), with what the pass moved, its duration, its cost and its prompt-cache hit rate per stage; totals, cost per merged PR and spend per hour; then the loop's agents: type, ticket or PR, status, age, tokens, cache hit rate, and the CI run it watches or how long it has been quiet |
| 5 Guards | Calls the guards refused this session (newest first, with the rule and the agent), the allowed count, and each agent receipt checked against the contract |
| 6 Links | Each ticket's Jira page and each PR, once Jira and gh have answered |

**Burnup.** Work done (cyan) under the total scope (grey) over time, drawn as a `Raster` of half blocks in the terminal and as eighth-block text elsewhere (the Desktop app has no `Raster`). A ticket filed mid-sprint raises the scope instead of hiding in a flat burndown; the header says how much the scope grew. The unit is story points once every ticket on the board has them, and tickets until then: a sum of points for some tickets and 1 for others would mean neither. A change of unit restarts the line. Points come from the mod's own Jira search, in the field named by the repo's `story-points-field` (read from `AGENTS.md`, then `CLAUDE.md`; default `customfield_10016`). Work done means tickets in a done status category in Jira or with a merged PR; parked tickets are neither done nor left.

**Forecast.** A Monte Carlo over the repo's own merges: each of 1000 trials draws days at random from the last 30 days of merged PRs (from `gh pr list`) until the tickets left are merged. The Board tab shows the day by which 50% and 85% of trials finished, and a histogram of the trials by day; the status line shows the 85% day. It waits for 10 days of merge history, and a board gives the same forecast until its inputs change. It counts tickets, not points, and assumes the next weeks merge like the last month.

**Aging.** A PR's age runs from when gh says it opened; a ticket's from when Jira says it entered its status category (`statuscategorychangedate`), shown only while it has no open PR. The percentile lines come from how long the repo's merged PRs (the latest 100 gh lists) stayed open, drawn once there are 5. A PR past the 85th percentile goes to the alert row.

**Overlap.** Each open PR's files are read with `gh api …/pulls/<n>/files` once per head (5 PRs per refresh). Two open PRs on the same file merge one after the other, and the second will likely need a rebase: merge the disjoint ones first.

**Cost and spend.** `$.session.usage()` gives the session's spend. The board records it where each drain pass starts and ends, so a pass shows what that pass cost, not what the session cost; a pass that started before this version's board was saved shows no cost. The loop's spend counts the ledger only while a loop runs, across sessions, and gives `$/h` (since the first loop started) and `$/PR` (per PR merged since). With the `budgetUsd` option set, the guards stop new build work at that spend ([Guards](guards.md)).

**Prompt cache.** Every model request's usage comes from the engine (`turn.step`), counted for the stage it served: an `agile-execution` agent or `build-session` for build, an `agile-merge-review` agent or `merge-session` for merge, the main loop by the board's stage. The hit rate is cache reads over all prompt tokens. A stage whose rate in the running pass falls 15 points under its average in earlier passes (above 200k prompt tokens each) goes to the alert row: a long CI wait past the cache's lifetime, or a prompt that changed, makes every request pay full price.

## What updates the board

The board is read from the sources, not from what the model says it did.

| Source | Read with | Board update |
|---|---|---|
| GitHub PRs | `gh pr list --state all --limit 100 --json number,title,headRefName,headRefOid,state,createdAt,mergedAt,url` | Open PRs, and closed ones created since the first loop started or naming a board ticket: ticket key (from branch or title), head, merged, when created and merged. A drain pass's `build N → merge N` counts PRs created and merged inside it. Every merged PR in the list, on the board or not, feeds the aging percentiles and the forecast |
| PR files | `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files`, once per open PR head | The overlap map |
| CI runs | `gh run list --limit 100 --json databaseId,headSha,status,conclusion,workflowName,createdAt` | The latest run per workflow on each sha; a PR's CI cell is red if any is red, pending if any is running |
| Jira sprint | `searchJiraIssuesUsingJql` on the session's Atlassian MCP server: `(project in (<projects>) AND sprint in openSprints()) OR key in (<board keys>)`, fields `summary, status, labels, statuscategorychangedate, <points field>`, 50 a page, 4 pages at most | Ticket, status and status category, when it entered that category, points, parked (`needs-info` label or a Needs Info status) |
| Jira comments | The same search, `key = <key>` with field `comment`, for up to 4 open tickets the loop is working per refresh, least recently read first | Latest `agile:phase=<x>` marker and the count of `rework` markers |
| Tool calls (the call itself, not its result) | The `tool.call` hook | The orchestrator `Skill` call sets the loop and stage and opens a drain pass; a `pr-updater` / `pr-reviewer` / `fix-until-satisfied` / `jira-postmortem` dispatch (or its `merge-*` sub-skill) sets the PR's step and counts it toward a stall; `gh pr merge` sets step `3f merge`; a Jira call's `issueIdOrKey` and `cloudId` tell the next sync which project to read; an agent's call is its last activity, and a `gh run watch <id>` is the run it waits on |
| The engine | `$.session.usage()`, `turn.step`, `$.agent.list()` | Spend; tokens and cache hit rate by stage and by agent; the agents lane |

The projects come from the ticket keys on the board (named by the loop's Jira calls or in PR branches and titles). The `cloudId` comes from the repo's `## Skill configuration` (`cloudId`), else from the loop's own Atlassian calls.

**When it refreshes.** On the loop's own events: 3 s after a call that writes to GitHub or Jira or waits on CI (`gh pr|run|api`, so a `gh run watch` that returns, `git push`, a Jira transition, comment or edit, an MCP PR create or merge), after each `Skill` or `Agent` call while a loop runs, when the main loop goes idle, and when `/agile-board` opens. A 5-minute timer catches changes made outside the loop (a PR merged by hand in GitHub) while a loop runs or the pane is open. An event refreshes gh at most every 10 s and Jira at most every 30 s, so a busy loop makes at most about 720 list calls an hour to GitHub (plus one files read per new PR head), under its 5,000. The drain's outcome comes from the same data: `DRAINED` once Jira has answered and no ticket is left open, unparked and unmerged, and no ticket PR is open; `STUCK` when the session goes idle with work left, no CI running on an open ticket PR, and a current pass that created and merged nothing. A STUCK drain that acts again is running again. The drain's own banners are not read.

**Jira permission.** The mod's search goes through the session's permissions. It asks first with `$.tool.check`, which opens no dialog: if `mcp__<server>__searchJiraIssuesUsingJql` is not allowed, the board says so on its `synced` line and shows gh data only. Allow that tool (read-only) in `/permissions` for the Jira side.

## Limits

- Jira pages hold 50 issues; a sprint over 200 tickets shows its first 200. A ticket's phase is read a few tickets per refresh, so a large sprint takes a few minutes to fill in.
- A train step is read from its dispatch text: a dispatch that names no PR (`#42`, `PR 42`, `/pull/42`) moves no step. PR state, CI and tickets do not depend on it.
- The pane and the alert row draw in the interactive terminal and the Desktop Code tab; elsewhere (VS Code chat panel, `claude -p`) the hooks still run and nothing draws.
- A pane the mod opens by itself waits for a 144-column terminal; `/agile-board` opens it at any width.
