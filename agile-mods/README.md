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
| [Sprint board](#sprint-board) | `/agile-board [show \| hide \| links \| retro \| reset]` | always |
| [Guards](#guards) | — | always |
| [Receipt inspector](#receipt-inspector) | `/receipts [all \| clear]` | always |
| [Retro data](#retro-data) | `/agile-board retro` | always |
| [Authoring checks](#authoring-checks) | `/agile-verify` | only in the agile-skills repo |

Every hook calls `next`: the board, receipts and retro only observe; the guards and authoring checks refuse a call (`deny`, which the model reads as the tool's error) or add context after a result.

## Sprint board

A board in the band above the prompt (interactive terminal only), shown once an agile loop starts:

- the active loop: `implement`, `merge-train`, or `drain`;
- for a drain: the pass number, whether the pass is in `build` or `merge`, and the outcome (`running`, then `STUCK` in red or `DRAINED` in green, with a toast and a desktop notification through `notify-send` or `osascript` where one exists);
- **build queue**: one line per ticket without a merged PR, with its latest `agile:phase=` marker and PR number;
- **merge queue**: one line per PR with its ticket key and merge-train step (`queued`, `3a update`, `3b review`, `3c fix`, `3f merge`, `4 postmortem`, `merged`), open PRs first.

The section of the running stage is bold. `/agile-board links` opens a pane with each ticket's Jira page and each PR, once a tool result has named the Jira site and GitHub repo. State is kept in `$.store`, so a resumed session shows where the loop stood.

| Tool call | Board update |
|---|---|
| `Skill` → `agile-sprint-drain` / `agile-10-implement` / `agile-11-merge-train` (at start) | Active loop and stage; each implement run inside a drain opens a pass |
| `mcp__atlassian__addCommentToJiraIssue` with `agile:phase=<x>` | Ticket phase |
| `gh pr create` / `mcp__github__create_pull_request` | PR number (ticket key read from title or branch) |
| `gh pr list --state open --json …` (the train's first read) | Merge queue |
| `Agent` → `pr-updater` / `pr-reviewer` / `fix-until-satisfied` / `jira-postmortem`, or `Skill` → the matching `merge-*` sub-skill (at start) | PR step; the PR number is read from the dispatch prompt, description or args (`#42`, `PR 42`, `/pull/42`) |
| `gh pr merge <n>` (at start) | Step `3f merge` — not merged |
| `gh pr view <n> --json …mergedAt` with `mergedAt` set, `gh pr list --state merged --json …`, or `mcp__github__merge_pull_request` | PR merged |
| Main-loop `turn.complete` answer with `══ STUCK ══` / `══ DRAINED ══` | Drain outcome |

`gh pr merge`'s exit code is not treated as a merge, following `agile-11-merge-train`: only `mergedAt` is. The per-pass `build:N merge:N` counts in the drain's banners are not shown: they are text inside one long turn, which a hook reads only when the turn ends.

## Guards

| Rule (where the prose lives) | Enforcement |
|---|---|
| `review-lens` and `pr-reviewer` never edit or post; `review-lens` never invokes `implement-review` (CLAUDE.md, tool grants) | A call from inside that agent's loop to `Write`/`Edit`/`NotebookEdit`, a posting GitHub/Atlassian MCP tool, `gh pr comment/review/merge/edit`, `gh issue comment/…`, `gh api -X POST/PATCH/PUT/DELETE` or `git push` is refused |
| `jira-postmortem` never creates issue links | `mcp__atlassian__createIssueLink` from that agent is refused |
| 3f reviewed-sha gate (`agile-11-merge-train`) | Once a merge train or drain has started in the session, `gh pr merge <n>` / `mcp__github__merge_pull_request` is refused when no review recorded a sha for the PR, or when the PR's `headRefOid` (from `expectedHeadSha`, else `gh pr view`) differs from it. The reviewed sha comes from a `pr-reviewer` receipt's `Reviewed sha:` line, or, for an inline `merge-review-pr`, from its `gh pr view <n> --json …headRefOid` read and its answer |
| Base-branch proof (every agent's receipt contract) | An agent receipt claiming "pre-existing", "unrelated to the diff", "environment issue", "tooling drift" or "flaky" without mentioning a base-branch / exit-code comparison gets a context reminder |
| Untrusted tool output (orchestrators, receipt contract) | Output of `gh pr/issue view/list/diff`, `gh api`, GitHub/Atlassian read tools or `WebFetch` that contains instruction-like text ("ignore previous instructions", "you are now", `<system>` …) gets a context fence |

Manual merges outside a train are not gated. If the PR head cannot be read, the gate logs it and lets the merge through: the skill's own gate still applies.

## Receipt inspector

Each `agile-execution:*` / `agile-merge-review:*` agent receipt is checked as it returns. A flagged receipt toasts; `/receipts` lists flagged ones, `/receipts all` every one (last 40, kept in `$.store`).

Flags: `no receipt`, `preamble`, `summary/praise section`, `blocked: …`, `unapplied_mutations: …`, `"<claim>" without base-branch proof`, `no reviewed sha` (pr-reviewer), `agent errored`.

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
hooks/guards.ts           # guards: grant backstop, reviewed-sha gate, reminders
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
