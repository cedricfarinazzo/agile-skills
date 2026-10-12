# agile-mods

[Claude Mods](https://code.claude.com/docs/en/plugins/mods/overview) for the agile-skills loop. A mod runs TypeScript inside Claude Code, so it can see what the loop does, draw it, and refuse a call that breaks a rule the skills only state in prose.

Needs Claude Code 2.1.287 or later (Desktop app 2.1.286). Mods are on by default; to turn them off, disable the plugin in `/plugin`, start with `--safe-mode`, or set `disableAllHooks` in `~/.claude/settings.json`. The pane and alert row draw in the terminal and the Desktop Code tab; elsewhere the hooks (guards, receipts, retro counts) still run.

Install: `/plugin marketplace add cedricfarinazzo/agile-skills`, then `/plugin install agile-mods@agile-skills`.

Each mod has its own page:

| Mod | Command | Active |
|---|---|---|
| [Agile console](docs/console.md) — status line with spend rate and an 85% date, alert row, and a six-tab pane: board with burnup and a Monte Carlo forecast, ticket and PR flow, aging WIP and PR overlap, drain passes with cost, cache hit rate and the loop's agents, guards and receipts, links | `/agile-board [board \| flow \| wip \| drain \| guards \| links \| show \| hide \| retro \| reset \| allow <n>]` | always |
| [Guards](docs/guards.md) — tool grants, 3f merge gates (pinned live head, green CI, every file reviewed), push guard, fix-round cap, budget stop, and the side doors around them (branch writes through the GitHub API or MCP, `gh repo sync`, git aliases); each set to enforce, warn or off; refusals, warnings, review coverage and one-time bypasses on the Guards tab | — | always |
| [Receipt inspector](docs/receipts.md) — agent receipts checked against the receipt contract | `/receipts [all \| clear]` | always |
| [Retro data](docs/retro.md) — loop counts for `agile-15-retro` | `/agile-board retro` | always |

Every hook calls `next`. The console, receipts and retro only observe. The guards can refuse a call (`deny`, which the model reads as the tool's error).

Options, set in `/plugin configure agile-mods@agile-skills` and applied at the next session start:

| Option | Default | What it does |
|---|---|---|
| `autoOpen` | `true` | Opens the console, unfocused, when an `agile-sprint-drain` starts, in a terminal of 144 columns or more |
| `budgetUsd` | `0` (none) | Stops new build work once a loop run has spent this much; open PRs still merge. Can be lifted for one ticket from the Guards tab |
| `guardGrants` | `enforce` | Agents keep to their tool grants (reviewers never edit or post, the postmortem never links issues) |
| `guardMergePin` | `enforce` | A merge pins the reviewed head, and it is the PR's live head |
| `guardMergeCi` | `enforce` | Every CI run on that head finished green |
| `guardMergeReview` | `enforce` | A reviewer read every file of the PR at that head, in full or by a diff since a full read |
| `guardPush` | `enforce` | No push to main/master, no force push without a lease, no computed push target. `enforce` or `warn` only |
| `guardSideDoor` | `enforce` | No branch write or merge through the GitHub API or MCP, no git/gh alias, no git config override |
| `fixRounds` | `3` | Fix rounds per PR after a review before the loop blocks it (3d); `0` is no cap |
| `allowBypass` | `true` | A person can allow a refused merge, one more fix round, or a ticket past the budget, once, from the Guards tab |

`enforce` refuses the call, `warn` lets it through with a toast and a Guards-tab entry, `off` skips the check. A repo's `AGENTS.md` or `CLAUDE.md` can set the same keys (`guardMergeReview: enforce`, `fixRounds: 2`), but only to tighten: a looser value is ignored and flagged on the Guards tab, since the loop can edit those files. See [Guards](docs/guards.md#settings-and-bypass).

The board needs `gh` logged in for the repo. For its Jira side, the repo's `## Skill configuration` names `cloudId` (as `agile-10-implement` already requires) and the session allows the read-only `mcp__<server>__searchJiraIssuesUsingJql` in `/permissions`; without either, the board shows gh data and says what is missing.

## What the mods read, run and send

The board and the guards take their data from GitHub, git and Jira, read by the mod itself, never from what the model says it did. Nothing goes to any other host, there is no telemetry, and no credential is read from the environment or from files. State stays on the machine, in the plugin's local store (`$.store`), one entry per repo; `/agile-board reset` clears it, and disabling the plugin in `/plugin` stops everything below.

**Programs run.** Only `gh` and `git`, and only to read. Each command is written out argument by argument in `hooks/register.tsx` and passed as a list of arguments, never through a shell. The only arguments that come from data are a PR number, a commit sha and a branch name, each checked against a strict pattern first, and a directory, which is only ever the value of `git -C`.

| Command | Why | When |
|---|---|---|
| `git -C <dir> rev-parse --abbrev-ref HEAD` | Push guard and fix-round cap: the branch a push that names none, or names `HEAD`, sends | Before such a push, inside a loop |
| `gh pr list --state all --limit 100 --json …` | Board: PRs, their heads, merged or not; merge history for aging and the forecast | 3 s after the loop's GitHub writes, CI waits and dispatches, when the main loop goes idle, when `/agile-board` opens, and every 5 minutes while a loop runs or the pane is open |
| `gh run list --limit 100 --json …` | Board: CI per sha | Same |
| `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files` | Board: each open PR's files, for the overlap map. 3f gate: the files a review must have read | With the PR list, once per PR head; at a merge call |
| `gh pr view <n> --json headRefOid,state` | 3f gate: the PR's live head | At a merge call |
| `git -C <dir> rev-parse --abbrev-ref --symbolic-full-name @{push}` | Fix-round cap: where a bare `git push` sends the branch | Before such a push, inside a loop |
| `gh pr list --head <branch> --state open --json number,headRefOid,baseRefName` | Fix-round cap: the open PR a push sends to, and its head | Before a push, inside a loop |
| `git -C <dir> rev-list --no-merges <head>..<ref> ^origin/<base>` | Fix-round cap: whether a push to a PR is an update (merges and the base's own commits only) | Before a push to an open PR's branch, unless the same command commits |
| `gh run list --commit <sha> --json …` | 3f gate: every CI run on that head | At a merge call |
| `git -C <session dir> diff --name-status -M -z <sha> <head>` | 3f gate and Guards tab: which files changed between a reviewed sha and the head | At a merge call, and on the Guards tab, for each earlier reviewed sha |
| `gh api repos/{owner}/{repo}/compare/<sha>...<head>` | 3f gate: the same, when local git cannot answer (the sha is not fetched) | As above, as a fallback |
| `git -C <session dir> show <sha>:<path>` | 3f gate: the line count of a file the review read in line ranges, and the chunk plan for a file too large for one read | At a merge call; after a reviewer read whose output was cut |
| `git -C <dir> rev-parse --verify --quiet <sha>^{commit}` | Review coverage: the full sha of an abbreviated one a reviewer read at | After such a read |
| `git -C <dir> rev-parse --verify --quiet <ref>^{tree}` | Fix-round cap: whether a push restores a tree already reviewed | Before a push that would start a new round |

`gh` talks to GitHub with the user's own `gh` login; the mod reads its output and keeps it local.

**MCP call:** `searchJiraIssuesUsingJql` on the session's connected Atlassian server (`$.mcp.call`), read-only: the sprint's tickets (`summary`, `status`, `labels`, `statuscategorychangedate`, the story-points field) and, a few tickets at a time, their comments for the `agile:phase` markers. It sends Atlassian a JQL query naming the repo's Jira projects and ticket keys, and the `cloudId`. It runs only when that tool is already allowed in the session's permissions (checked first with `$.tool.check`, which opens no dialog), on the same events as the gh refresh but at most every 30 s, and every 5 minutes as a fallback.

**Read:**
- The loop's tool calls (`tool.call`): which orchestrator or train step was dispatched, which agent type made a call, the `git show <sha>:<path>` and `git diff <sha>..<sha>` commands a reviewer ran, a merge or push command about to run, the git and `gh api` commands and GitHub MCP calls a loop makes (for the side doors the guards close), the ticket keys and `cloudId` a Jira call names. Agent receipts are read only for the `/receipts` contract check.
- Two files at session start: `AGENTS.md` and `CLAUDE.md` in the working directory, for `story-points-field`, `cloudId` and any guard setting that tightens the plugin's options.
- `$.session.usage()`, for the cost of each drain pass and the loop's spend. `turn.step`, for each model request's token counts (input, cache reads and writes, output); the request and its answer are not read. `turn.complete` on the main loop, to judge a drain STUCK when the session goes idle; the answer text is not read. `$.agent.list()`, for the type and status of the loop's agents.

**Send:** nothing to any host but GitHub through `gh` and Atlassian through the session's MCP server, as above. Three things go back into the session: a guard's refusal, which the model reads as the tool's error; a one-line note on a reviewer's read that did not count for review, added as context to that call; and the retro counts, added as context to the `agile-15-retro` Skill call.

## Layout

```
hooks/hooks.json          # names the one module
hooks/register.tsx        # every hook; binds $ into a Host for the modules below
hooks/host.ts             # the Host type
hooks/guards.ts           # guards: grant backstop, 3f merge gates, push guard, fix-round cap, side doors (the budget check is in register.tsx)
hooks/receipts.ts         # /receipts
hooks/state/*.ts          # pure logic: board, flow metrics, agents lane, console views, guards, guard settings, bypasses, review coverage, receipts, retro
docs/*.md                 # one page per mod
tests/unit/*.spec.ts      # bun test over hooks/state, and over the hook modules through tests/unit/fake-host.ts;
                          # skills.spec.ts runs every git and gh command the skills write through the guards
tests/engine/*.test.ts    # claude plugin test: register.tsx in the engine, hooks and the pane and alert row mounted per surface
tests/engine/world.ts     # the stubbed machine beneath: gh, git, Jira, store, clock, model, the prompt's own drawing
```

The engine allows one hooks module per plugin, one unmatched hook per event, and `$` only in that module's own top-level functions: `register.tsx` owns the hooks and hands the other modules a `Host` of bound calls, as the built-in `diff` mod does.

## Develop

```bash
cd agile-mods && bun test        # unit: tests/unit, pure state and the hook modules over a fake host
claude plugin test ./agile-mods  # engine: tests/engine, register.tsx in the engine with gh, git and Jira stubbed
claude plugin validate ./agile-mods
claude --plugin-dir ./agile-mods
```

To typecheck, point a tsconfig at `hooks/` and the declarations `/plugin-types` writes (or `mods/types/claude-code.d.ts` in anthropics/claude-code), with `jsx: react`, `jsxFactory: h` and `allowImportingTsExtensions`.
