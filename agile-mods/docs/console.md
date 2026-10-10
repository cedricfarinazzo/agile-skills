# Agile console

[← agile-mods](../README.md)

`/agile-board [board | flow | drain | guards | links | show | hide | retro | reset]` · always active · code: `hooks/state/board.ts` (state), `hooks/state/console.ts` (views), drawing in `hooks/register.tsx`

A live view of the agile loop. It answers "where is the loop, is it stuck, what did it cost, and what did the guards refuse?" without reading the transcript. It draws in three places, from one board the mod reads itself from gh and Jira (see [What updates the board](#what-updates-the-board)), kept in `$.store` per repo, so a resumed session shows where the loop stood.

| Where | Shows |
|---|---|
| Status line | `agile ▸ drain p3 merge · 13/21 pts · 4 merged`; cleared when the loop is idle |
| One row above the prompt | Only when something needs a person or just ended: parked tickets and looping work (yellow), `STUCK` (red), `DRAINED` (green). Nothing otherwise, so the band stays free for other mods |
| The console pane | Five tabs, below |

`/agile-board` opens the pane (focused, Esc closes it) at the tab you last used, or at the tab you name. The pane docks beside the transcript in a fullscreen terminal of 110 columns or more and sits above the prompt otherwise. When an `agile-sprint-drain` starts, the pane also opens by itself, unfocused, where the terminal is 144 columns or more wide; the `autoOpen` option (`/plugin configure agile-mods@agile-skills`) turns that off. Tabs have the hotkeys `1` to `5` while the pane has the keyboard (click it, or `ctrl+x` then `tab`).

## Tabs

| Tab | Shows |
|---|---|
| 1 Board | Loop and drain header with elapsed time; when gh and Jira last answered, or why they failed; work left as a gauge; tiles for built, merged and parked or blocked; the burndown; parked tickets and looping steps |
| 2 Flow | Build: one row per open ticket, five dots for `plan`, `implement`, `validate`, `review`, `pr`, its latest Jira marker (or its Jira status) and PR. Merge: one row per PR with a cell per train step (`3a 3b 3c 3e 3f 4`: `✔` reached, `●` current, `✖` red CI) and the CI state of its head |
| 3 Drain | One bar per pass, split into build time (cyan) and merge time (magenta), with what the pass moved, its duration and its cost; totals and cost per merged PR |
| 4 Guards | Calls the guards refused this session (newest first, with the rule and the agent), the allowed count, and each agent receipt checked against the contract |
| 5 Links | Each ticket's Jira page and each PR, once Jira and gh have answered |

**Burndown.** Work left over time, drawn as a `Raster` of half blocks in the terminal and as eighth-block text elsewhere (the Desktop app has no `Raster`). The unit is story points once every ticket on the board has them, and tickets until then: a sum of points for some tickets and 1 for others would mean neither. A change of unit restarts the line. Points come from the mod's own Jira search, in the field named by the repo's `story-points-field` (read from `AGENTS.md`, then `CLAUDE.md`; default `customfield_10016`). Work left means tickets neither in a done status category in Jira, nor with a merged PR, nor parked. The chart has no ideal line: the board does not know the sprint's end.

**Cost.** `$.session.usage()` gives the session's spend. The board records it where each drain pass starts and ends, so a pass shows what that pass cost, not what the session cost. A pass that started before this version's board was saved shows no cost.

## What updates the board

The board is read from the sources, not from what the model says it did.

| Source | Read with | Board update |
|---|---|---|
| GitHub PRs | `gh pr list --state all --limit 100 --json number,title,headRefName,headRefOid,state,createdAt,mergedAt,url` | Open PRs, and closed ones created since the first loop started or naming a board ticket: ticket key (from branch or title), head, merged, when created and merged. A drain pass's `build N → merge N` counts PRs created and merged inside it |
| CI runs | `gh run list --limit 100 --json databaseId,headSha,status,conclusion,workflowName,createdAt` | The latest run per workflow on each sha; a PR's CI cell is red if any is red, pending if any is running |
| Jira sprint | `searchJiraIssuesUsingJql` on the session's Atlassian MCP server: `(project in (<projects>) AND sprint in openSprints()) OR key in (<board keys>)`, fields `summary, status, labels, <points field>`, 50 a page, 4 pages at most | Ticket, status and status category, points, parked (`needs-info` label or a Needs Info status) |
| Jira comments | The same search, `key = <key>` with field `comment`, for up to 4 open tickets the loop is working per refresh, least recently read first | Latest `agile:phase=<x>` marker and the count of `rework` markers |
| Tool calls (the call itself, not its result) | The `tool.call` hook | The orchestrator `Skill` call sets the loop and stage and opens a drain pass; a `pr-updater` / `pr-reviewer` / `fix-until-satisfied` / `jira-postmortem` dispatch (or its `merge-*` sub-skill) sets the PR's step and counts it toward a stall; `gh pr merge` sets step `3f merge`; a Jira call's `issueIdOrKey` and `cloudId` tell the next sync which project to read |

The projects come from the ticket keys on the board (named by the loop's Jira calls or in PR branches and titles). The `cloudId` comes from the repo's `## Skill configuration` (`cloudId`), else from the loop's own Atlassian calls.

**When it refreshes.** Every 15 s for gh and every 60 s for Jira while a loop runs (from the orchestrator's `Skill` call until `/agile-board reset`) or while the pane is open; 3 s after a call that writes to GitHub or Jira (`gh pr|run|api`, `git push`, a Jira transition, comment or edit, an MCP PR create or merge); and when `/agile-board` opens. The drain's outcome comes from the same data: `DRAINED` once Jira has answered and no ticket is left open, unparked and unmerged, and no ticket PR is open; `STUCK` when the session goes idle with work left, no CI running on an open ticket PR, and a current pass that created and merged nothing. A STUCK drain that acts again is running again. The drain's own banners are not read.

**Jira permission.** The mod's search goes through the session's permissions. It asks first with `$.tool.check`, which opens no dialog: if `mcp__<server>__searchJiraIssuesUsingJql` is not allowed, the board says so on its `synced` line and shows gh data only. Allow that tool (read-only) in `/permissions` for the Jira side.

## Limits

- Jira pages hold 50 issues; a sprint over 200 tickets shows its first 200. A ticket's phase is read a few tickets per refresh, so a large sprint takes a few minutes to fill in.
- A train step is read from its dispatch text: a dispatch that names no PR (`#42`, `PR 42`, `/pull/42`) moves no step. PR state, CI and tickets do not depend on it.
- The pane and the alert row draw in the interactive terminal and the Desktop Code tab; elsewhere (VS Code chat panel, `claude -p`) the hooks still run and nothing draws.
- A pane the mod opens by itself waits for a 144-column terminal; `/agile-board` opens it at any width.
