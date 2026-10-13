# AGENTS.md

Codex maintainer guidance for this repository.

Read and follow [CLAUDE.md](CLAUDE.md) for the shared workflow and invariants. Also read [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow, checks, evals and token-efficiency rules. This file records the Codex adapters so those rules stay single-sourced.

## Codex adapters

- Canonical packages are the root-level plugin directories. Codex manifests live in `<plugin>/.codex-plugin/plugin.json`; keep their identity, version, and skill source aligned with the matching Claude manifests and portable root `plugin.json`. Claude Code is the primary host; Codex parity is best effort (see `docs/KNOWN_PARITY_GAPS.md`).
- The Codex marketplace is `.agents/plugins/marketplace.json`. Its entries must match package directories and manifest names.
- Codex is locked to full inline execution: installed plugins never discover, request, or claim plugin-local named agents or subagents. Execution, merge, and sprint-drain run every phase with `concurrency=0`; all `dispatch` values normalize to inline execution. With no background notifications, CI waits use the bounded foreground `timeout 270 gh run watch` fallback in each skill's `## Waiting on CI`.
- On Codex, invoke skills as `$skill-name`; Claude Code uses its Skill tool and plugin namespace.
- Read consumer `CLAUDE.md/AGENTS.md` for `## Skill configuration`; mention Claude first and retain both. Follow the host's instruction precedence if they conflict.
- Keep `${CLAUDE_PLUGIN_ROOT}` in bundled-script commands: Claude requires it and Codex currently supplies it for compatibility. Do not replace it to accommodate Codex. Existing relative fallbacks may remain.
- Keep the existing `.claude/worktrees/<ticket-key>` convention; do not use Codex's protected `.agents/` control path for ticket worktrees.

## Verify

Run the existing Claude invariants and every Claude manifest:

```bash
for plugin in agile-* deep-refactor project-review session-audit; do
  claude plugin validate "$plugin"
done
```

See `docs/CODEX_COMPATIBILITY.md` for the host runtime matrix, Markdown conventions, and clean-host smoke test.

Confirm that every marketplace entry names a root package, both marketplaces expose the same package set except Claude-only `agile-mods`, and every manifest name matches its package.

Run `python3 .github/scripts/check-parity.py` and `python3 -m unittest discover -s .github/scripts -p 'test_*.py'` to verify the parity gate.
