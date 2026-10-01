# Authoring checks

[← agile-mods](../README.md)

`/agile-verify` · active only in the agile-skills repo · code: `hooks/authoring.ts`, checks in `hooks/state/authoring.ts`

For maintainers of this marketplace. Each check turns a step of `CLAUDE.md`'s "verify before you call an edit done" list into a check on the call, so the regression is caught when it is made rather than in review.

Active only when the session's directory is this repo (its `.claude-plugin/marketplace.json` is named `agile-skills`). Each is a "verify before you call an edit done" step of CLAUDE.md:

| Check | When | Effect |
|---|---|---|
| Trigger-phrase guard | `Edit`/`Write` to `*/skills/*/SKILL.md` | Refused when the result drops a `Triggers:` phrase present at `HEAD` (case-insensitive; rewording is fine) |
| MCP name lint | After an `Edit`/`Write` to a `.md` file | Context reminder listing MCP tool names written bare (`getJiraIssue`) that `HEAD` did not already have |
| Version bump | `git commit` (`-a` reads `git diff HEAD`, else the index) | Refused when a marketplace plugin's files change but its `.claude-plugin/plugin.json` diff adds no `"version"` line |
| Invariants | End of a main-loop turn that edited files, or `/agile-verify` | CLAUDE.md's verify block (agents ↔ dispatch points, mid-phase block hash, Confluence tree variants, frontmatter and names); drift toasts and is logged |

## Why these four

- A dropped `Triggers:` phrase is a silent auto-invocation regression: no test fails, a user's usual phrasing just stops matching.
- A bare MCP name (`getJiraIssue`) is uncallable; `CLAUDE.md` asks for fully qualified names.
- A plugin changed without a version bump does not reach users who already installed it.
- The invariants (agent files ↔ dispatch points, byte-identical shared blocks, frontmatter) drift one file at a time.
