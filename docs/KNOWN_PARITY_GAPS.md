# Known Claude Code / Codex parity gaps

Claude Code is the primary host. Codex support is best effort: preserve the shared skills and their gates without weakening Claude workflows to fit Codex. These differences are accepted and are not planned for remediation. Revisit an entry only after an explicit maintainer decision and evidence that the alternative works.

| Accepted difference | Codex behavior | Why we keep it |
|---|---|---|
| Scoped agents, per-phase model/effort selection, tool grants, and isolated review contexts | Run all phases and review lenses inline, sequentially. Normalize dispatch to inline; retain receipts and review gates. | Maintainer policy: Codex subagents do not meet the desired quality bar. No Codex agent adapter or parallel agent execution is planned. Inline review cannot claim an independent reviewer context. |
| `agile-mods` UI and enforced guards, including spend limits | No mods package, board pane, or mod-enforced budget stop. Shared prose gates still apply. | Mods depend on Claude's engine. Exclude this package from Codex marketplace parity and three-manifest requirements. |
| Background CI notifications and push notifications | Use the bounded foreground CI fallback; report stops in the conversation when no notification tool exists. | Preserve Claude's background workflow without introducing a Codex notification subsystem. |
| Claude Artifact publication and its design skills | Skip publication when unavailable, record the omission, and complete the Confluence workflow. | Confluence is the source of truth. No replacement publishing service is planned. |
| Native session-cost auditing | `session-audit` accepts Claude Code transcripts even when invoked from Codex. It does not audit native Codex sessions. | The offline parser and cost model are Claude-specific. Native Codex parsing and pricing are outside the supported scope. |
| `${CLAUDE_PLUGIN_ROOT}` in bundled-script commands | Use the host's compatibility binding; an existing documented fallback may be used. If unavailable, report the limitation or use the skill's manual fallback. | Claude requires this variable. Do not replace its commands or add a separate Codex command set merely to avoid the Claude name. |
| `.claude/worktrees/<ticket-key>` | Retain the shared location where a workflow uses worktrees. | A different Codex path adds divergence; `.agents/` is a control path, not a ticket-worktree location. |

These exceptions do not excuse version drift, missing shared packages, ignored consumer instructions, skipped gates, or a zero WIP admission limit. CI checks marketplace membership, manifest names and versions, and shared skill sources. Both `CLAUDE.md/AGENTS.md` and `.claude/skills/` / `.agents/skills/` remain supported, with Claude mentioned first. Host instruction precedence still applies.

See [compatibility and verification](CODEX_COMPATIBILITY.md) for the supported runtime contract. Automated checks do not replace a clean-host smoke test; do not claim live integration parity from manifest validation alone.
