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

## What the mods read, run and send

**Nothing leaves your machine.** The mods make no network call: no Jira, GitHub or other HTTP request, and no telemetry. What they collect stays in the plugin's local store (`$.store`) and is drawn in the terminal.

**Read.**
- The loop's own tool calls and their results (`tool.call`): Jira comments and searches, `gh pr` and `gh run` output, agent dispatches and receipts. The board shows what this session saw; a ticket the loop has not touched, or a status changed by hand in Jira, does not appear.
- The model's answers (`turn.step`, `turn.complete`): the drain's closing banner, the final report of a merge train, and a review answered inline inside a `merge-session` agent. They update the board and the guards' state.
- Two files at session start: `AGENTS.md` and `CLAUDE.md` in the session's working directory, for the `story-points-field` key `agile-10-implement` pins there.
- `$.session.usage()`, for the cost of each drain pass.

**Run.** One program: `git -C <dir> rev-parse --abbrev-ref HEAD`, with a 5-second timeout. The push guard runs it before a `git push` that names no branch, to learn which branch the push would send, and refuses the push when it is `main`. `<dir>` is the directory the push command names (`git -C <dir>` or a leading `cd <dir> &&`), else the session's working directory. Its output is the branch name, used only for that check.

**Send.** Nothing to any host. Two things go back into the session itself: a guard's refusal, which the model reads as the tool's error, and the retro counts, added as context to the `agile-15-retro` Skill call. Both travel to the model with the rest of the conversation, as any tool result does.

## Layout

```
hooks/hooks.json          # names the one module
hooks/register.tsx        # every hook; binds $ into a Host for the modules below
hooks/host.ts             # the Host type
hooks/guards.ts           # guards: grant backstop, 3f merge gates, push guard
hooks/receipts.ts         # /receipts
hooks/state/*.ts          # pure logic: board, console views, guards, receipts, retro
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
