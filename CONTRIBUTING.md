# Contributing

Thanks for improving agile-skills. This file is the short path from idea to merged PR. The full rules live in [CLAUDE.md](CLAUDE.md) (shared by Claude Code and Codex, see [AGENTS.md](AGENTS.md)); read the section it points to before you change that area.

## Layout

Each plugin is a top-level directory. The marketplace file `.claude-plugin/marketplace.json` is the authoritative plugin list.

```text
<plugin>/README.md                   overview, about 80 lines
<plugin>/docs/                       long user-facing detail and exact rules (some plugins)
<plugin>/.claude-plugin/plugin.json  manifest (also .codex-plugin/ and plugin.json for shared packages)
<plugin>/skills/<name>/SKILL.md      one directory per skill
<plugin>/agents/<name>.md            scoped subagents (execution, merge-review, sprint-drain)
docs/                                Codex compatibility notes and the root pictures
```

## Set up

You need `git`, `python3`, [Claude Code](https://claude.ai/code), and `bun` for `agile-mods` and the root pictures.

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
claude --plugin-dir ./agile-skills/<plugin>   # one plugin dir at a time
```

## Make a change

1. **Branch from `master`.** One concern per PR.
2. **Edit the source of truth.** A skill's behavior lives in its `SKILL.md`. Change that first, then the README or `docs/` page that describes it.
3. **Keep the shared blocks in sync.** The Confluence tree, the untrusted-tool-output rule, the receipt contract, the work-discovered-mid-phase block and the waiting-on-CI block are embedded in several files. Change every carrier in the same commit. CLAUDE.md lists them with a check for each.
4. **Bump the version** of every plugin you touched, in all its manifests, in the same PR: patch for a typo or doc fix, minor for a backwards-compatible capability, major for a removed skill, a renamed trigger or a changed config key.
5. **Run the checks** below.
6. **Open the PR** against `master` with what changed and how you verified it.

## Rules that are easy to break

- **Never drop a `Triggers:` phrase** from a skill `description`. Rewording is fine; subtracting a trigger silently breaks auto-invocation.
- **A skill has exactly three frontmatter fields:** `name` (equal to its directory), `description`, and `user-invocable` on user-facing skills. Sub-skills use `user-invocable: false`.
- **Add or remove an orchestrator dispatch point and its `agents/` file in the same change.** Every agent has `name`, `description`, `model`, `effort` and an explicit `tools` list.
- **Say a thing once.** A skill is a short guide for a capable model, not a rulebook. Do not restate a rule in several sections.
- **Write MCP tools fully qualified**, for example `mcp__atlassian__getJiraIssue`.
- **Invoke bundled scripts through `${CLAUDE_PLUGIN_ROOT}`.** A bare relative path fails when the plugin is installed.
- **A mod guard mirrors a prose rule.** Change the rule and update `agile-mods/hooks/state/` together; read `agile-mods/hooks/CLAUDE.md` first.

## Checks

Run what applies to your change. CI runs the same.

```bash
claude plugin validate .                      # marketplace
claude plugin validate ./<plugin>             # each plugin you touched
python3 .github/scripts/check-parity.py       # names and versions across manifests
python3 -m unittest discover -s .github/scripts -p 'test_*.py'
cd agile-mods && bun test && claude plugin test ./agile-mods   # if you touched agile-mods
python3 .github/scripts/generate-icons.py     # icons: edit the shape in the script, then rerun
bun docs/img/generate.ts                      # root pictures, after the cycle, drain or train flow changes
```

The verify block in CLAUDE.md (agent files against dispatch points, Confluence tree identical everywhere, frontmatter complete) catches the regressions the validators miss. A bundled script's tests sit beside it; run `python3 -m pytest <dir>`.

## Docs

READMEs follow the pattern in CLAUDE.md under "README conventions": a short overview with a "What you get" table, one diagram, install, and links. Write for the person running the skill, in plain direct prose. Before removing a line from a README, check that its commands, flags, config keys and trigger phrases survive somewhere.

## Security and secrets

A skill, script or agent must not read a token from the environment or a file and send it anywhere. Reach Jira and Confluence through the Atlassian MCP tools, and keep bundled scripts offline. A plugin that needs a secret declares it as a `userConfig` option with `sensitive: true`.

## License

By contributing you agree your work is released under the [MIT License](LICENSE).
