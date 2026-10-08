# agile-mods

[Claude Mods](https://github.com/anthropics/claude-code/issues/91870) for the agile-skills loop. A mod runs TypeScript inside Claude Code, so it can see what the loop does, draw it, and refuse a call that breaks a rule the skills only state in prose.

**Early access.** Mods load only with function hooks enabled, and the API may change between releases:

```json
// ~/.claude/settings.json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Without it the plugin installs and does nothing.

Install: `/plugin marketplace add cedricfarinazzo/agile-skills`, then `/plugin install agile-mods@agile-skills`.

Each mod has its own page:

| Mod | Command | Active |
|---|---|---|
| [Sprint board](docs/board.md) — loop, burndown, queues, parked and looping work; PR pipeline, drain timeline and links panes | `/agile-board [show \| hide \| prs \| drain \| links \| retro \| reset]` | always |
| [Guards](docs/guards.md) — tool grants, 3f merge gates (pinned reviewed head, fresh green CI), push guard | — | always |
| [Receipt inspector](docs/receipts.md) — agent receipts checked against the receipt contract | `/receipts [all \| clear]` | always |
| [Retro data](docs/retro.md) — loop counts for `agile-15-retro` | `/agile-board retro` | always |
| [Authoring checks](docs/authoring.md) — trigger phrases, MCP names, version bumps, invariants | `/agile-verify` | only in the agile-skills repo |

Every hook calls `next`. The board, receipts and retro only observe. The guards and authoring checks can refuse a call (`deny`, which the model reads as the tool's error) or add context after a result.

## Where the data comes from

The mods make no Jira or GitHub call of their own. They read the calls the loop already makes, with their arguments and results: Jira comments and searches, `gh pr` and `gh run` output, agent dispatches and receipts. So the board shows what this session saw. A ticket the loop has not touched, or a status changed by hand in Jira, does not appear. The only commands a mod runs itself are `git rev-parse` (push guard), `git diff`/`git show` and the invariants script (authoring checks, this repo only), and `notify-send`/`osascript` (drain notice).

## Layout

```
hooks/hooks.json          # names the one module
hooks/register.tsx        # every hook; binds $ into a Host for the modules below
hooks/host.ts             # the Host type
hooks/guards.ts           # guards: grant backstop, 3f merge gates, push guard
hooks/receipts.ts         # /receipts
hooks/authoring.ts        # authoring checks, /agile-verify
hooks/state/*.ts          # pure logic: board, guards, receipts, retro, authoring
docs/*.md                 # one page per mod
tests/*.test.ts           # bun test over hooks/state, and over the hook modules through tests/fake-host.ts (the invariants test runs on this repo)
```

The engine allows one hooks module per plugin, one unmatched hook per event, and `$` only in that module's own top-level functions: `register.tsx` owns the hooks and hands the other modules a `Host` of bound calls, as the built-in `diff` mod does.

## Develop

```bash
cd agile-mods && bun test
claude plugin validate ./agile-mods
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir ./agile-mods
```

To typecheck, point a tsconfig at `hooks/` and the declarations `/plugin-types` writes (or `mods/types/claude-code.d.ts` in anthropics/claude-code), with `jsx: react`, `jsxFactory: h` and `allowImportingTsExtensions`.
