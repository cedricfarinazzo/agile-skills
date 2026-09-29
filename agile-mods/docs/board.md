# Sprint board

[← agile-mods](../README.md)

`/agile-board [show | hide | prs | drain | links | retro | reset]` · always active · code: `hooks/state/board.ts`, rendering in `hooks/register.tsx`

A live view of the agile loop above the prompt, and three panes for detail. It answers "where is the loop, and is it stuck?" without reading the transcript.

```
agile · drain · /agile-board links · hide
drain · pass 2 · merge · running
burn ▇▇▆▅▅▃  13/21 pts left
⏸ VC-9 Needs Info  ⟳ PR #42 3b review ×3
build queue
VC-12      implement     
VC-14      pr            PR #45
merge queue
#42     VC-7       3b review ⟳3b×3
#45     VC-14      queued
#40     VC-3       merged
```

## The band

A board in the band above the prompt (interactive terminal only). It appears once an agile loop starts and shows, top to bottom:

| Line | Shows |
|---|---|
| Header | The active loop: `implement`, `merge-train` or `drain` |
| Drain | Pass number, whether the pass is in `build` or `merge`, and the outcome: `running`, then `STUCK` (red) or `DRAINED` (green). The end also toasts and sends a desktop notification through `notify-send` or `osascript` where one exists |
| Burndown | Work left as a sparkline, sampled on each change: `burn ▇▆▅▃  13/21 pts left`. Work left means tickets with no merged PR that are not parked |
| Parked and looping (yellow) | Tickets `ticket-validator` sent back as Needs Info or parked on a critical decision; PRs whose train step started 3 times or more; tickets reworked 3 times or more. Each new entry also toasts once |
| Build queue | One line per ticket without a merged PR: its latest `agile:phase=` marker (or `needs info` / `parked`) and PR number |
| Merge queue | One line per PR: ticket key and train step (`queued`, `3a update`, `3b review`, `3c fix`, `3f merge`, `4 postmortem`, `merged`), open PRs first, `⟳3b×3` on a looping step |

The section of the running stage is bold. State is kept in `$.store`, so a resumed session shows where the loop stood.

**Burndown unit.** The line counts story points once every ticket on the board has them, and tickets until then: a sum of points for some tickets and 1 for others would mean neither. A change of unit restarts the line. Points are read from the `mcp__atlassian__searchJiraIssuesUsingJql` and `mcp__atlassian__getJiraIssue` results the loop gets, in the field named by the repo's `story-points-field` (read from `AGENTS.md`, then `CLAUDE.md`; default `customfield_10016`). `agile-10-implement` requests that field in its sprint search.

## Panes

| Command | Pane |
|---|---|
| `/agile-board prs` | PR pipeline: one row per PR, one column per train step (`3a 3b 3c 3e 3f 4`): `✔` reached, `●` current, `✖` red CI. Each row ends with the CI state of the PR's head and the reviewed sha |
| `/agile-board drain` | Drain timeline: one bar per pass, split into build time (cyan) and merge time (magenta), with what the pass moved (`build 3 → merge 2`, or `nothing moved`) and how long it took |
| `/agile-board links` | Each ticket's Jira page and each PR, once a tool result has named the Jira site and GitHub repo |

`/agile-board retro` prints the [retro data](retro.md); `/agile-board reset` clears the board and the retro counts, and ends the guards' loop state.

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

`gh pr merge`'s exit code is not treated as a merge, following `agile-11-merge-train`: only `mergedAt` is. The drain's own `build:N merge:N` banners are text inside one long turn, which the board reads only from the turn's final answer, so the timeline counts PRs created and merged instead.

## Limits

- The board shows only what this session saw (see [where the data comes from](../README.md#where-the-data-comes-from)).
- Step, PR and ticket keys are read from dispatch text and command lines. A dispatch that names no PR (`#42`, `PR 42`, `/pull/42`) moves nothing.
- The band draws in the interactive terminal only.
