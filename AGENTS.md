# AGENTS.md

Codex maintainer guidance for this repository.

Read and follow [CLAUDE.md](CLAUDE.md) for the shared workflow and invariants. This file records the Codex adapters so those rules stay single-sourced.

## Codex adapters

- Canonical packages are the root-level plugin directories. Codex manifests live in `<plugin>/.codex-plugin/plugin.json`; keep their identity, version, and skill source aligned with the matching Claude manifests.
- The Codex marketplace is `.agents/plugins/marketplace.json`. Its entries must match package directories and manifest names.
- Codex is locked to full inline execution: installed plugins never discover, request, or claim plugin-local named agents or subagents. Execution, merge, and sprint-drain run every phase with `concurrency=0`; all `dispatch` values normalize to inline execution. With no background notifications, CI waits use the bounded foreground `timeout 270 gh run watch` fallback in each skill's `## Waiting on CI`.
- On Codex, invoke skills as `$skill-name`; Claude Code uses its Skill tool and plugin namespace.
- Prefer the consumer repository's `AGENTS.md` for `## Skill configuration`; retain `CLAUDE.md` as a compatibility fallback.
- Resolve bundled scripts relative to the loaded `SKILL.md` on Codex. Codex currently supplies `${CLAUDE_PLUGIN_ROOT}` for compatibility, but relative resolution remains the portable fallback.
- Keep the existing `.claude/worktrees/<ticket-key>` convention; do not use Codex's protected `.agents/` control path for ticket worktrees.

## Verify

Run the existing Claude invariants, then validate portable/Codex packaging and every Claude manifest:

```bash
python3 scripts/validate_dual_host_packaging.py
for plugin in agile-* deep-refactor project-review session-audit; do
  claude plugin validate "$plugin"
done
```

See `docs/CODEX_COMPATIBILITY.md` for the host runtime matrix and clean-host smoke test.

Confirm that every marketplace entry names a root package, both marketplaces expose the same package set, and every manifest name matches its package.
