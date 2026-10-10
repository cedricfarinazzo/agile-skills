# Claude Code and Codex compatibility

Claude Code is the primary host; Codex compatibility is best effort. Preserve Claude workflows and bundled-script commands when adapting skills. Intentional differences and accepted limitations are tracked in [Known parity gaps](KNOWN_PARITY_GAPS.md).

Every shared package ships three aligned manifests: Claude Code at `.claude-plugin/plugin.json`, Codex compatibility metadata at `.codex-plugin/plugin.json`, and a portable root `plugin.json`. Both marketplaces must expose the same packages except `agile-mods`, which is Claude-only and ships only its Claude manifest.

## Runtime differences

| Capability | Claude Code | Codex |
|---|---|---|
| Invoke a skill | `/<plugin>:<skill>` | `$skill` |
| Plugin-local `agents/*.md` | Registered named agents; `model`, `effort`, and `tools` apply | Not registered; those fields are not translated to OpenAI models |
| Execution and merge workflows | Named phase agents | Inline phase chain with `concurrency=0` |
| Sprint drain `dispatch=session` | `build-session` then a fresh `merge-session` | Normalize every `dispatch` value to full inline execution; report the normalization |
| CI wait without notifications | Host background wait | Reissue bounded foreground `timeout 270 gh run watch` waits |
| Claude live Artifact | Publish when the tool is available | Skip when unavailable; Confluence remains the source of truth |

Codex is intentionally locked to full inline execution. It retains the workflow gates but not Claude’s isolated-worker model selection or independent review contexts; no Codex-native orchestration is planned in this package.

## Runtime preflight

Before a skill performs a write, transition, push, merge, or CI wait, verify only the prerequisites it needs:

1. Read consumer `CLAUDE.md/AGENTS.md` for `## Skill configuration`; keep both supported and follow the host's instruction precedence on conflicts.
2. Confirm required CLIs (`git`, `gh`, and the configured build/test commands) are available before starting a mutation phase.
3. Confirm the required Atlassian MCP tools are available before Jira or Confluence reads/writes. If unavailable, return a blocked result naming the missing tool; never substitute scraping or credentials.
4. Confirm an Artifact tool before an Artifact-only step; when absent, skip it and record that Confluence is complete.
5. On Codex, normalize unsupported named-agent/session dispatch to the documented inline mode before running. Sprint drain resolves a positive WIP limit separately, then passes `concurrency=0` to its child orchestrators.
6. Keep `${CLAUDE_PLUGIN_ROOT}` in bundled-script commands on both hosts; Codex uses its compatibility binding. Do not rewrite Claude commands for Codex.

Consumer skill inventories cover both `.claude/skills/` and `.agents/skills/`, with Claude listed first.

## Markdown conventions

Each skill that differs by host places `## Host execution` before `## Purpose`. That section states both contracts explicitly: Claude Code retains its existing named-agent/concurrency behavior; Codex runs inline and does not claim agent or subagent dispatch.

## Release verification

Run the Claude checks from the repository root before release:

```bash
python3 .github/scripts/check-parity.py
python3 -m unittest discover -s .github/scripts -p 'test_*.py'
claude plugin validate .
for plugin in agile-* deep-refactor project-review session-audit; do
  claude plugin validate "$plugin"
done
python3 -m pytest agile-planning/skills/agile-8-refinement/scripts \
  agile-sprint-close/skills/agile-13-sprint-closeout/scripts \
  session-audit/skills/session-audit/scripts -q
```

Then perform a clean-host smoke test: add the repository marketplace in Claude Code and Codex, install one package, invoke one read-only skill, and verify bundled-resource lookup. Repeat for a workflow requiring each optional integration (Atlassian MCP, `gh`, and Artifact fallback).
