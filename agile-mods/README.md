# agile-mods

[Claude Mods](https://code.claude.com/docs/en/plugins/mods/overview) for the agile-skills loop. A mod runs TypeScript inside Claude Code, so it can see what the loop does, draw it, and refuse a call that breaks a rule the skills only state in prose.

Needs Claude Code 2.1.287 or later (Desktop app 2.1.286). Mods are on by default; to turn them off, disable the plugin in `/plugin`, start with `--safe-mode`, or set `disableAllHooks` in `~/.claude/settings.json`. The pane and alert row draw in the terminal and the Desktop Code tab; elsewhere the hooks (guards, receipts, retro counts) still run.

Install: `/plugin marketplace add cedricfarinazzo/agile-skills`, then `/plugin install agile-mods@agile-skills`.

Each mod has its own page:

| Mod | Command | Active |
|---|---|---|
| [Agile console](docs/console.md) — status line, alert row and a five-tab pane: board with burndown, ticket and PR flow, drain passes with cost, guards and receipts, links | `/agile-board [board \| flow \| drain \| guards \| links \| show \| hide \| retro \| reset]` | always |
| [Guards](docs/guards.md) — tool grants, 3f merge gates (pinned reviewed head, fresh green CI), push guard; refusals logged on the Guards tab | — | always |
| [Receipt inspector](docs/receipts.md) — agent receipts checked against the receipt contract | `/receipts [all \| clear]` | always |
| [Retro data](docs/retro.md) — loop counts for `agile-15-retro` | `/agile-board retro` | always |

Every hook calls `next`. The console, receipts and retro only observe. The guards can refuse a call (`deny`, which the model reads as the tool's error).

One option, set in `/plugin configure agile-mods@agile-skills`: `autoOpen` (default on) opens the console, unfocused, when an `agile-sprint-drain` starts, in a terminal of 144 columns or more.

The board needs `gh` logged in for the repo. For its Jira side, the repo's `## Skill configuration` names `cloudId` (as `agile-10-implement` already requires) and the session allows the read-only `mcp__<server>__searchJiraIssuesUsingJql` in `/permissions`; without either, the board shows gh data and says what is missing.

## What the mods read, run and send

The board and the guards take their data from GitHub, git and Jira, read by the mod itself, never from what the model says it did. Nothing goes to any other host, and there is no telemetry. State stays in the plugin's local store (`$.store`), one entry per repo.

**Programs run** (each written out argument by argument in `hooks/register.tsx`; the only computed arguments are a PR number and a commit sha, each checked against its pattern first, and the directory a push names):

| Command | Why | When |
|---|---|---|
| `git -C <dir> rev-parse --abbrev-ref HEAD` | Push guard: the branch a `git push` that names none would send | Before such a push, inside a loop |
| `gh pr list --state all --limit 100 --json …` | Board: PRs, their heads, merged or not | Every 15 s while a loop runs or the pane is open, 3 s after a GitHub write, when `/agile-board` opens |
| `gh run list --limit 100 --json …` | Board: CI per sha | Same |
| `gh pr view <n> --json headRefOid,state` | 3f gate: the PR's live head | At a merge call |
| `gh run list --commit <sha> --json …` | 3f gate: every CI run on that head | At a merge call |
| `gh api repos/{owner}/{repo}/pulls/<n>/files` | 3f gate: the files a review must have read | At a merge call |
| `gh api repos/{owner}/{repo}/compare/<sha>...<head>` | 3f gate: which files changed since an earlier review | At a merge call, for each earlier reviewed sha |

`gh` talks to GitHub with the user's own `gh` login; the mod reads its output and keeps it local.

**MCP call:** `searchJiraIssuesUsingJql` on the session's connected Atlassian server (`$.mcp.call`), read-only: the sprint's tickets (`summary`, `status`, `labels`, the story-points field) and, a few tickets at a time, their comments for the `agile:phase` markers. It sends Atlassian a JQL query naming the repo's Jira projects and ticket keys, and the `cloudId`. It runs only when that tool is already allowed in the session's permissions (checked first with `$.tool.check`, which opens no dialog), every 60 s while a loop runs or the pane is open.

**Read:**
- The loop's tool calls (`tool.call`): which orchestrator or train step was dispatched, which agent type made a call, the `git show <sha>:<path>` commands a reviewer ran, a merge or push command about to run, the ticket keys and `cloudId` a Jira call names. Agent receipts are read only for the `/receipts` contract check.
- Two files at session start: `AGENTS.md` and `CLAUDE.md` in the working directory, for `story-points-field` and `cloudId`.
- `$.session.usage()`, for the cost of each drain pass. `turn.complete` on the main loop, to judge a drain STUCK when the session goes idle; the answer text is not read.

**Send:** nothing to any host but GitHub through `gh` and Atlassian through the session's MCP server, as above. Two things go back into the session: a guard's refusal, which the model reads as the tool's error, and the retro counts, added as context to the `agile-15-retro` Skill call.

## Layout

```
hooks/hooks.json          # names the one module
hooks/register.tsx        # every hook; binds $ into a Host for the modules below
hooks/host.ts             # the Host type
hooks/guards.ts           # guards: grant backstop, 3f merge gates, push guard
hooks/receipts.ts         # /receipts
hooks/state/*.ts          # pure logic: board, console views, guards, review coverage, receipts, retro
docs/*.md                 # one page per mod
tests/*.test.ts           # bun test over hooks/state, and over the hook modules through tests/fake-host.ts 
```

The engine allows one hooks module per plugin, one unmatched hook per event, and `$` only in that module's own top-level functions: `register.tsx` owns the hooks and hands the other modules a `Host` of bound calls, as the built-in `diff` mod does.

## Develop

```bash
cd agile-mods && bun test
claude plugin validate ./agile-mods
claude --plugin-dir ./agile-mods
```

To typecheck, point a tsconfig at `hooks/` and the declarations `/plugin-types` writes (or `mods/types/claude-code.d.ts` in anthropics/claude-code), with `jsx: react`, `jsxFactory: h` and `allowImportingTsExtensions`.
