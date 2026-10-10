# Agile console

[← agile-mods](../README.md)

`/agile-board [board | flow | drain | guards | links | show | hide | retro | reset]` · always active · code: `hooks/state/board.ts` (state), `hooks/state/console.ts` (views), drawing in `hooks/register.tsx`

A live view of the agile loop. It answers "where is the loop, is it stuck, what did it cost, and what did the guards refuse?" without reading the transcript. It draws in three places, from one board folded from the loop's own tool calls and kept in `$.store`, so a resumed session shows where the loop stood.

| Where | Shows |
|---|---|
| Status line | `agile ▸ drain p3 merge · 13/21 pts · 4 merged`; cleared when the loop is idle |
| One row above the prompt | Only when something needs a person or just ended: parked tickets and looping work (yellow), `STUCK` (red), `DRAINED` (green). Nothing otherwise, so the band stays free for other mods |
| The console pane | Five tabs, below |

`/agile-board` opens the pane (focused, Esc closes it) at the tab you last used, or at the tab you name. The pane docks beside the transcript in a fullscreen terminal of 110 columns or more and sits above the prompt otherwise. When an `agile-sprint-drain` starts, the pane also opens by itself, unfocused, where the terminal is 144 columns or more wide; the `autoOpen` option (`/plugin configure agile-mods@agile-skills`) turns that off. Tabs have the hotkeys `1` to `5` while the pane has the keyboard (click it, or `ctrl+x` then `tab`).

## Tabs

| Tab | Shows |
|---|---|
| 1 Board | Loop and drain header with elapsed time; work left as a gauge; tiles for built, merged and parked or blocked; the burndown; parked tickets and looping steps |
| 2 Flow | Build: one row per ticket without a merged PR, five dots for `plan`, `implement`, `validate`, `review`, `pr`, its latest marker and PR. Merge: one row per PR with a cell per train step (`3a 3b 3c 3e 3f 4`: `✔` reached, `●` current, `✖` red CI), the CI state of its head and the reviewed sha |
| 3 Drain | One bar per pass, split into build time (cyan) and merge time (magenta), with what the pass moved, its duration and its cost; totals and cost per merged PR |
| 4 Guards | Calls the guards refused this session (newest first, with the rule and the agent), the allowed count, and each agent receipt checked against the contract |
| 5 Links | Each ticket's Jira page and each PR, once a tool result has named the Jira site and GitHub repo |

**Burndown.** Work left over time, drawn as a `Raster` of half blocks in the terminal and as eighth-block text elsewhere (the Desktop app has no `Raster`). The unit is story points once every ticket on the board has them, and tickets until then: a sum of points for some tickets and 1 for others would mean neither. A change of unit restarts the line. Points are read from the `mcp__atlassian__searchJiraIssuesUsingJql` and `mcp__atlassian__getJiraIssue` results the loop gets, in the field named by the repo's `story-points-field` (read from `AGENTS.md`, then `CLAUDE.md`; default `customfield_10016`). `agile-10-implement` requests that field in its sprint search. Work left means tickets with no merged PR that are not parked. The chart has no ideal line: the board does not know the sprint's end.

**Cost.** `$.session.usage()` gives the session's spend. The board records it where each drain pass starts and ends, so a pass shows what that pass cost, not what the session cost. A pass that started before this version's board was saved shows no cost.

## What updates the board

| Tool call | Board update |
|---|---|
| `Skill` → `agile-sprint-drain` / `agile-10-implement` / `agile-11-merge-train` (at start) | Active loop and stage; each implement run inside a drain opens a pass |
| `mcp__atlassian__addCommentToJiraIssue` with `agile:phase=<x>` | Ticket phase; `rework` markers count toward a loop |
| `mcp__atlassian__searchJiraIssuesUsingJql` / `mcp__atlassian__getJiraIssue` returning the points field | Story points per ticket |
| `Agent` → `ticket-validator` answering `rejected` / `critical-park` | Ticket parked (Needs Info / awaiting decision) |
| `gh pr create` / `mcp__github__create_pull_request` | PR number (ticket key read from title or branch); counts as built in the current drain pass |
| `gh pr list --state open --json …` (the train's first read) | Merge queue |
| `Agent` → `pr-updater` / `pr-reviewer` / `fix-until-satisfied` / `jira-postmortem`, or `Skill` → the matching `merge-*` sub-skill (at start) | PR step and its start count; the PR number is read from the dispatch prompt, description or args (`#42`, `PR 42`, `/pull/42`) |
| `Agent` → `pr-reviewer` receipt, or a response of a loop running `merge-review-pr` inline (main loop or a drain's `merge-session`), with `Reviewed sha:` | PR's reviewed sha |
| `gh pr view <n> --json …headRefOid`, `gh pr list --json …headRefOid` | PR's head |
| `gh run view/list --json …headSha…` | CI run on that sha; an unchanged repeat read counts as a second agreeing read |
| `gh pr merge <n>` (at start) | Step `3f merge`, not merged |
| `gh pr view <n> --json …mergedAt` with `mergedAt` set, `gh pr list --state merged --json …`, or `mcp__github__merge_pull_request` | PR merged; counts as merged in the current drain pass |
| Main-loop `turn.complete` answer with `══ STUCK ══` / `══ DRAINED ══` | Drain outcome; closes the last pass |

`gh pr merge`'s exit code is not treated as a merge, following `agile-11-merge-train`: only `mergedAt` is. The drain's own `build:N merge:N` banners are text inside one long turn, which the board reads only from the turn's final answer, so the Drain tab counts PRs created and merged instead.

## Limits

- The board shows only what this session saw (see [where the data comes from](../README.md#where-the-data-comes-from)).
- Step, PR and ticket keys are read from dispatch text and command lines. A dispatch that names no PR (`#42`, `PR 42`, `/pull/42`) moves nothing.
- The pane and the alert row draw in the interactive terminal and the Desktop Code tab; elsewhere (VS Code chat panel, `claude -p`) the hooks still run and nothing draws.
- A pane the mod opens by itself waits for a 144-column terminal; `/agile-board` opens it at any width.
