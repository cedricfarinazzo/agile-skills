# AGENTS.md

Codex maintainer guidance for this repository.

Read and follow [CLAUDE.md](CLAUDE.md) for the shared workflow and invariants. This file records the Codex adapters so those rules stay single-sourced.

## Codex adapters

- Canonical packages live in `plugins/<plugin-name>/`; root-level plugin paths are compatibility symlinks for existing Claude local-development commands.
- Codex manifests live in `plugins/<plugin-name>/.codex-plugin/plugin.json`; keep their identity, version, and skill source aligned with the matching Claude manifests.
- The Codex marketplace is `.agents/plugins/marketplace.json`. Its entries must match package directories and manifest names.
- Codex phase agents live in `plugins/{agile-execution,agile-merge-review}/.codex/agents/*.toml`. Keep each paired with its Claude `agents/*.md` role and orchestrator dispatch point.
- On Codex, invoke skills as `$skill-name`; Claude Code uses its Skill tool and plugin namespace.
- Prefer the consumer repository's `AGENTS.md` for `## Skill configuration`; retain `CLAUDE.md` as a compatibility fallback.
- Resolve bundled scripts relative to the loaded `SKILL.md` on Codex. `${CLAUDE_PLUGIN_ROOT}` applies only to Claude Code.
- Use `.agents/worktrees/<ticket-key>` for shared ticket worktrees. Never mutate the shared checkout from a delegated phase.

## Verify

Run the existing Claude invariants, then validate each Codex manifest:

```bash
for plugin in plugins/*; do
  python3 /home/sed/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py "$plugin"
done
```

Confirm that all seven marketplace entries name a package under `plugins/` and every execution/merge Codex agent has the same stem as its Claude counterpart.
