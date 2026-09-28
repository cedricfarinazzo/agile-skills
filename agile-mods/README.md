# agile-mods

[Claude Mods](https://github.com/anthropics/claude-code/issues/91870) for the agile-skills loop. A mod runs TypeScript inside Claude Code, so it can see what the loop does, draw it, and refuse a call that breaks a rule the skills only state in prose.

**Early access.** Mods load only with function hooks enabled, and the API may change between releases:

```json
// ~/.claude/settings.json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Without it the plugin installs and does nothing.

| Feature | Command | Active |
|---|---|---|
| [Sprint board](#sprint-board) | `/agile-board [show \| hide \| prs \| drain \| links \| retro \| reset]` | always |
| [Guards](#guards) | — | always |
| [Receipt inspector](#receipt-inspector) | `/receipts [all \| clear]` | always |
| [Retro data](#retro-data) | `/agile-board retro` | always |
| [Authoring checks](#authoring-checks) | `/agile-verify` | only in the agile-skills repo |

Every hook calls `next`. The board, receipts and retro only observe. The guards and authoring checks can refuse a call (`deny`, which the model reads as the tool's error) or add context after a result.

**Where the data comes from.** The mods make no Jira or GitHub call of their own. They read the calls the loop already makes, with their arguments and results: Jira comments and searches, `gh pr` and `gh run` output, agent dispatches and receipts. So the board shows what this session saw. A ticket the loop has not touched, or a status changed by hand in Jira, does not appear. The only commands a mod runs itself are `git rev-parse` (push guard), `git diff`/`git show` and the invariants script (authoring checks, this repo only), and `notify-send`/`osascript` (drain notice).

## Sprint board

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

### Panes

| Command | Pane |
|---|---|
| `/agile-board prs` | PR pipeline: one row per PR, one column per train step (`3a 3b 3c 3e 3f 4`): `✔` reached, `●` current, `✖` red CI. Each row ends with the CI state of the PR's head and the reviewed sha |
| `/agile-board drain` | Drain timeline: one bar per pass, split into build time (cyan) and merge time (magenta), with what the pass moved (`build 3 → merge 2`, or `nothing moved`) and how long it took |
| `/agile-board links` | Each ticket's Jira page and each PR, once a tool result has named the Jira site and GitHub repo |

`/agile-board retro` prints the [retro data](#retro-data); `/agile-board reset` clears the board and the retro counts, and ends the guards' loop state.

### What updates the board

| Tool call | Board update |
|---|---|
| `Skill` → `agile-sprint-drain` / `agile-10-implement` / `agile-11-merge-train` (at start) | Active loop and stage; each implement run inside a drain opens a pass |
| `mcp__atlassian__addCommentToJiraIssue` with `agile:phase=<x>` | Ticket phase; `rework` markers count toward a loop |
| `mcp__atlassian__searchJiraIssuesUsingJql` / `mcp__atlassian__getJiraIssue` returning the points field | Story points per ticket |
| `Agent` → `ticket-validator` answering `rejected` / `critical-park` | Ticket parked (Needs Info / awaiting decision) |
| `gh pr create` / `mcp__github__create_pull_request` | PR number (ticket key read from title or branch); counts as built in the current drain pass |
| `gh pr list --state open --json …` (the train's first read) | Merge queue |
| `Agent` → `pr-updater` / `pr-reviewer` / `fix-until-satisfied` / `jira-postmortem`, or `Skill` → the matching `merge-*` sub-skill (at start) | PR step and its start count; the PR number is read from the dispatch prompt, description or args (`#42`, `PR 42`, `/pull/42`) |
| `Agent` → `pr-reviewer` receipt, or an inline `merge-review-pr` turn's answer, with `Reviewed sha:` | PR's reviewed sha |
| `gh pr view <n> --json …headRefOid`, `gh pr list --json …headRefOid` | PR's head |
| `gh run view/list --json …headSha…` | CI run on that sha; an unchanged repeat read counts as a second agreeing read |
| `gh pr merge <n>` (at start) | Step `3f merge`, not merged |
| `gh pr view <n> --json …mergedAt` with `mergedAt` set, `gh pr list --state merged --json …`, or `mcp__github__merge_pull_request` | PR merged; counts as merged in the current drain pass |
| Main-loop `turn.complete` answer with `══ STUCK ══` / `══ DRAINED ══` | Drain outcome; closes the last pass |

`gh pr merge`'s exit code is not treated as a merge, following `agile-11-merge-train`: only `mergedAt` is. The drain's own `build:N merge:N` banners are text inside one long turn, which a hook reads only when the turn ends, so the timeline counts PRs created and merged instead.

## Guards

| Rule (where the prose lives) | Enforcement |
|---|---|
| `review-lens` and `pr-reviewer` never edit or post; `review-lens` never invokes `implement-review` (CLAUDE.md, tool grants) | A call from inside that agent's loop to `Write`/`Edit`/`NotebookEdit`, a posting GitHub/Atlassian MCP tool, `gh pr comment/review/merge/edit`, `gh issue comment/…`, `gh api -X POST/PATCH/PUT/DELETE` or `git push` is refused |
| `jira-postmortem` never creates issue links | `mcp__atlassian__createIssueLink` from that agent is refused |
| 3f merge gates (`agile-11-merge-train` 3e and 3f) | From a merge train's or drain's start to its final report, `gh pr merge <n>` / `mcp__github__merge_pull_request` is refused unless: the head is pinned (`--match-head-commit <sha>` / `expectedHeadSha`), so GitHub itself refuses a head that moved; the pin equals the reviewed sha, when a `pr-reviewer` receipt named one; and a CI run on that sha read `completed`/`success` on two agreeing reads (`gh run view <id> --json status,conclusion,headSha`) |
| Work reaches the base branch only through a PR; force push only with a lease (`agile-11-merge-train` Rules) | From an implement, merge-train or drain start to its final report, and in any `agile-execution` / `agile-merge-review` agent: a `git push` to `main`/`master` (by refspec, or with none from a checkout of it) and `--force` / `-f` / `--mirror` are refused; `--force-with-lease` passes |

**When a loop counts as running.** A loop spans several turns (3e waits a turn for CI), so it runs from its orchestrator's start to its final report: `## Sprint implementation` (implement), `Per-PR outcome` (merge train), or `══ DRAINED ══` / `══ STUCK ══` (drain; inside a drain, only this banner ends it). `/agile-board reset` also ends it. Merges and pushes outside a loop are not gated.

**Why the head is pinned.** The pin moves the "is this still the reviewed head?" check to GitHub, at the moment of the merge, where nothing can move in between. When the train runs the review inline (`concurrency=0`), a hook reads the reviewed sha only when the turn ends, after the merge; the gate then checks that a pin and green CI exist, and GitHub checks the pin.

## Receipt inspector

Each `agile-execution:*` / `agile-merge-review:*` agent receipt is checked as it returns. A flagged receipt toasts; `/receipts` lists flagged ones, `/receipts all` every one (last 40, kept in `$.store`).

Flags: `no receipt`, `preamble`, `summary/praise section`, `blocked: …`, `unapplied_mutations: …`, `no reviewed sha` (pr-reviewer), `agent errored`.

## Retro data

The loop is counted as it runs: phase markers and `rework` markers per ticket, `3a`/`3b`/`3c` runs and merge attempts per PR, blocked receipts, drain passes and outcome. When `agile-15-retro` is invoked, the counts ride its Skill call as context, so its Step 1 can quote them. `/agile-board retro` prints them; `/agile-board reset` clears them with the board.

## Authoring checks

Active only when the session's directory is this repo (its `.claude-plugin/marketplace.json` is named `agile-skills`). Each is a "verify before you call an edit done" step of CLAUDE.md:

| Check | When | Effect |
|---|---|---|
| Trigger-phrase guard | `Edit`/`Write` to `*/skills/*/SKILL.md` | Refused when the result drops a `Triggers:` phrase present at `HEAD` (case-insensitive; rewording is fine) |
| MCP name lint | After an `Edit`/`Write` to a `.md` file | Context reminder listing MCP tool names written bare (`getJiraIssue`) that `HEAD` did not already have |
| Version bump | `git commit` (`-a` reads `git diff HEAD`, else the index) | Refused when a marketplace plugin's files change but its `.claude-plugin/plugin.json` diff adds no `"version"` line |
| Invariants | End of a main-loop turn that edited files, or `/agile-verify` | CLAUDE.md's verify block (agents ↔ dispatch points, mid-phase block hash, Confluence tree variants, frontmatter and names); drift toasts and is logged |

## Layout

```
hooks/hooks.json          # names the one module
hooks/register.tsx        # every hook; binds $ into a Host for the modules below
hooks/host.ts             # the Host type
hooks/guards.ts           # guards: grant backstop, 3f merge gates, push guard
hooks/receipts.ts         # /receipts
hooks/authoring.ts        # authoring checks, /agile-verify
hooks/state/*.ts          # pure logic: board, guards, receipts, retro, authoring
tests/*.test.ts           # bun test over hooks/state (the invariants test runs on this repo)
```

The engine allows one hooks module per plugin, one unmatched hook per event, and `$` only in that module's own top-level functions: `register.tsx` owns the hooks and hands the other modules a `Host` of bound calls, as the built-in `diff` mod does.

## Develop

```bash
cd agile-mods && bun test
claude plugin validate ./agile-mods
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ./agile-mods
```

To typecheck, point a tsconfig at `hooks/` and the declarations `/plugin-types` writes (or `mods/types/claude-code.d.ts` in anthropics/claude-code), with `jsx: react`, `jsxFactory: h` and `allowImportingTsExtensions`.
