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
<plugin>/evals-<skill>/<NN-case>/      eval cases: prompt.md and graders/*.md (results/ is gitignored)
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
3. **Keep the shared blocks in sync.** The Confluence section (tree, page placement, page layouts, one home per fact, drift rule), the untrusted-tool-output rule, the receipt contract, the work-discovered-mid-phase block and the waiting-on-CI block are embedded in several files. Change every carrier in the same commit. CLAUDE.md lists them with a check for each.
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

## Evals

Each skill has an eval suite in `<plugin>/evals-<skill>/`. A case is a directory `NN-name/` holding a `prompt.md` and one or more `graders/*.md`. A skill change that alters behavior should add or update a case.

- **`prompt.md`** starts with frontmatter (`max_turns`, `timeout_seconds`, `allowed_tools`, `runs`, `model`), then the task. Inline every tool output the skill would read, so the case is hermetic and the without-plugin arm stays honest. Name the skill in the prompt when the case tests it firing.
- **Graders** are small files with frontmatter. `type: tool_used` checks that a tool (usually `Skill`) was called; `type: llm` grades the last message against a list of checks and an explicit fail condition.
- **Negative cases** (named `NN-neg-...`) check that the skill does not fire or does not overreach.
- Test what the skill adds: the gate that gets skipped, the marker format, what it must not do. Re-skin real runs onto a generic domain; never paste private data.

Run one suite from the repo root:

```bash
claude plugin eval ./<plugin> --eval-dir evals-<skill> --ablation with-without --judge-model sonnet
```

The headline number is the with/without delta. Run it before and after a change to a skill; `--case <glob>` narrows to one case.

## Keep skills token efficient

Every skill's `description` loads into context in every session, and a skill's body loads each time it runs. Both are paid on every use, so keep them lean.

**Descriptions: short, and still enough to route.**

- A description is a routing key. State what the skill does, when to use it, and its `Triggers:` phrases. Leave out mechanism, receipt fields, config keys and step lists; those belong in the body.
- Aim for one or two sentences. Most existing descriptions are 100 to 250 characters; treat anything near 300 as a prompt to cut.
- Keep the phrases people actually say ("sprint closeout", "merge train"). Cut words around them, not the phrases. Never remove a trigger to save space.
- Say what distinguishes it from a neighboring skill when two could match ("Use instead of /review for file-level depth").

```yaml
# routes well, short
description: "Launch sprint in Jira. Triggers: plan sprint, start sprint, sprint planning. After skill 8."

# too long: mechanism and receipts belong in the body
description: "Reads refined Stories, computes capacity, orders by dependency, creates the sprint, posts a rollup row, refreshes the artifact, then writes a receipt with ..."
```

**Bodies: say each thing once.**

- State a rule in one place. A section followed by a `Rules` bullet and a `Principles` bullet that repeat it triples the cost and adds nothing.
- Keep the gotcha, cut the lecture: the check that is easy to forget stays, the rationale and war stories go.
- Templates are skeletons: list the sections and any non-obvious field meaning, not sentences telling the model what to write.
- Trust the model on interview mechanics and ordinary judgment. "Ask what is missing, infer what is implied, state every inference" is one sentence.
- An agent file stays short and points at its sub-skill. The SKILL.md is the source of truth.
- Size model and effort to what a miss costs and what re-reads the output, not to how few tool calls the phase makes. Lower a tier only when something downstream checks the result.
- Move long user-facing detail to `<plugin>/docs/`, which is read on demand, not on every run.

To see where tokens go before and after a change, run the `session-audit` skill on two runs of similar work.

## Checks

Run what applies to your change. CI runs the same.

```bash
claude plugin validate .                      # marketplace
claude plugin validate ./<plugin>             # each plugin you touched
python3 .github/scripts/check-parity.py       # names and versions across manifests
python3 -m unittest discover -s .github/scripts -p 'test_*.py'
cd agile-mods && bun test && claude plugin test ./agile-mods   # if you touched agile-mods
python3 docs/img/generate-icons.py     # icons: edit the shape in the script, then rerun
bun docs/img/generate.ts                      # root pictures, after the cycle, drain or train flow changes
```

The verify block in CLAUDE.md (agent files against dispatch points, Confluence section identical everywhere, frontmatter complete) catches the regressions the validators miss. A bundled script's tests sit beside it; run `python3 -m pytest <dir>`.

## Docs

READMEs follow the pattern in CLAUDE.md under "README conventions": a short overview with a "What you get" table, one diagram, install, and links. Write for the person running the skill, in plain direct prose. Before removing a line from a README, check that its commands, flags, config keys and trigger phrases survive somewhere.

## Security and secrets

A skill, script or agent must not read a token from the environment or a file and send it anywhere. Reach Jira and Confluence through the Atlassian MCP tools, and keep bundled scripts offline. A plugin that needs a secret declares it as a `userConfig` option with `sensitive: true`.

## License

By contributing you agree your work is released under the [MIT License](LICENSE).
