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

Every hook calls `next`: the board, receipts and retro only observe; the guards and authoring checks refuse a call (`deny`, which the model reads as the tool's error) or add context after a result.

## Sprint board

A board in the band above the prompt (interactive terminal only), shown once an agile loop starts:

- the active loop: `implement`, `merge-train`, or `drain`;
- for a drain: the pass number, whether the pass is in `build` or `merge`, and the outcome (`running`, then `STUCK` in red or `DRAINED` in green, with a toast and a desktop notification through `notify-send` or `osascript` where one exists);
- **burndown**: work left (no merged PR, not parked) out of every ticket seen, as a sparkline sampled on each change. It counts story points once every ticket on the board has them, else tickets; a switch of unit restarts the line. Points come from the `searchJiraIssuesUsingJql` / `getJiraIssue` results the loop reads, in the field its `story-points-field` names (read from the repo's `AGENTS.md`, then `CLAUDE.md`; default `customfield_10016`). The mod makes no Jira call of its own;
- **parked and looping work**, in yellow: a ticket `ticket-validator` sent back as Needs Info or parked on a critical decision, a PR whose train step started 3 times or more, a ticket reworked 3 times or more. Each new one also toasts;
- **build queue**: one line per ticket without a merged PR, with its latest `agile:phase=` marker (or `needs info` / `parked`) and PR number;
- **merge queue**: one line per PR with its ticket key and merge-train step (`queued`, `3a update`, `3b review`, `3c fix`, `3f merge`, `4 postmortem`, `merged`), open PRs first, and `⟳3b×3` on a looping step.

The section of the running stage is bold. State is kept in `$.store`, so a resumed session shows where the loop stood.

Panes:

- `/agile-board prs`: the PR pipeline, one row per PR and a column per train step (`3a 3b 3c 3e 3f 4`): `✔` reached, `●` current, `✖` red CI. Each row also shows the CI state of the PR's head and the reviewed sha.
- `/agile-board drain`: the drain timeline, one bar per pass split into build time and merge time, with what the pass moved (`build 3 → merge 2`, or `nothing moved`) and how long it took.
- `/agile-board links`: each ticket's Jira page and each PR, once a tool result has named the Jira site and GitHub repo.

| Tool call | Board update |
|---|---|
| `Skill` → `agile-sprint-drain` / `agile-10-implement` / `agile-11-merge-train` (at start) | Active loop and stage; each implement run inside a drain opens a pass |
| `mcp__atlassian__addCommentToJiraIssue` with `agile:phase=<x>` | Ticket phase |
| `gh pr create` / `mcp__github__create_pull_request` | PR number (ticket key read from title or branch) |
| `gh pr list --state open --json …` (the train's first read) | Merge queue |
| `Agent` → `pr-updater` / `pr-reviewer` / `fix-until-satisfied` / `jira-postmortem`, or `Skill` → the matching `merge-*` sub-skill (at start) | PR step; the PR number is read from the dispatch prompt, description or args (`#42`, `PR 42`, `/pull/42`) |
| `gh pr merge <n>` (at start) | Step `3f merge` — not merged |
| `Agent` → `ticket-validator` answering `rejected` / `critical-park` | Ticket parked (Needs Info / awaiting decision) |
| `Agent` → `pr-reviewer` receipt, or an inline `merge-review-pr` turn's answer, with `Reviewed sha:` | PR's reviewed sha |
| `gh pr view <n> --json …headRefOid`, `gh pr list --json …headRefOid` | PR's head |
| `mcp__atlassian__searchJiraIssuesUsingJql` / `mcp__atlassian__getJiraIssue` returning the points field | Story points per ticket |
| `gh run view/list --json …headSha…` | CI run on that sha; an unchanged repeat read counts as a second agreeing read |
| `gh pr view <n> --json …mergedAt` with `mergedAt` set, `gh pr list --state merged --json …`, or `mcp__github__merge_pull_request` | PR merged |
| Main-loop `turn.complete` answer with `══ STUCK ══` / `══ DRAINED ══` | Drain outcome |

`gh pr merge`'s exit code is not treated as a merge, following `agile-11-merge-train`: only `mergedAt` is. The per-pass `build:N merge:N` counts in the drain's banners are not shown: they are text inside one long turn, which a hook reads only when the turn ends.

## Guards

| Rule (where the prose lives) | Enforcement |
|---|---|
| `review-lens` and `pr-reviewer` never edit or post; `review-lens` never invokes `implement-review` (CLAUDE.md, tool grants) | A call from inside that agent's loop to `Write`/`Edit`/`NotebookEdit`, a posting GitHub/Atlassian MCP tool, `gh pr comment/review/merge/edit`, `gh issue comment/…`, `gh api -X POST/PATCH/PUT/DELETE` or `git push` is refused |
| `jira-postmortem` never creates issue links | `mcp__atlassian__createIssueLink` from that agent is refused |
| 3f merge gates (`agile-11-merge-train` 3e and 3f) | From a merge train's or drain's start to its final report, `gh pr merge <n>` / `mcp__github__merge_pull_request` is refused unless: the head is pinned (`--match-head-commit <sha>` / `expectedHeadSha`), so GitHub itself refuses a head that moved; the pin equals the reviewed sha, when a `pr-reviewer` receipt named one; and a CI run on that sha read `completed`/`success` on two agreeing reads (`gh run view <id> --json status,conclusion,headSha`) |
| No push to the base branch, force push only with a lease (`agile-10-implement`, `merge-update-pr`) | From an implement, merge-train or drain start to its final report, and in any `agile-execution` / `agile-merge-review` agent: a `git push` to `main`/`master` (by refspec, or with none from a checkout of it) and `--force` / `-f` / `--mirror` are refused; `--force-with-lease` passes |

A loop ends with its final report: `## Sprint implementation`, `Per-PR outcome`, or a drain's `══ DRAINED ══` / `══ STUCK ══` (inside a drain, only the drain's banner). `/agile-board reset` also ends it. Merges and pushes outside a loop are not gated. For an inline `merge-review-pr`, whose reviewed sha a hook reads only when the turn ends, the gate checks the pin and CI, and GitHub checks the pin.

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
