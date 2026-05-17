# Skill authoring — Shared GUIDELINES

This document consolidates the shared principles and authoring rules used by all skills under skills/*. Extracted from existing SKILL.md files to avoid duplication.

## Principles (apply to every run)

- Ask before writing — never produce final content when essential information is missing; ask the user instead.
- Group questions — collect all clarifications in a single message; do not drip questions across multiple turns.
- Read before write — always read existing Confluence/Jira state before creating or updating pages/issues.
- Never infer silently — any assumption must be stated explicitly to the user.
- Idempotent — re-running a skill must not duplicate content or create repeated artifacts.
- Resumable — re-running picks up from incomplete sections and only fills what is missing.
- No placeholder or blank sections — provide real content or a clear "TBD — [reason + owner]" marker.
- Be concrete and falsifiable — acceptance criteria and DoD items must be testable and specific.
- Propose before acting — present plans (e.g., Story list, sprint composition, Roadmap changes) and wait for confirmation before writing.
- Keep Confluence and Jira linked — when creating items in one system, add references/links in the other.
- End runs with a concise status summary: "✅ Done / ⚠️ Still needed / 👉 Next step".

## Authoring rules for SKILL.md files

- Include YAML frontmatter with at least `name` and `description` (description must contain trigger phrases).
- Skills are idempotent and resumable by design.
- Ask all missing info in a single message before proceeding.
- State every assumption explicitly.
- Prefer small, actionable changes when updating SKILL.md files; keep shared rules in this GUIDELINES.md to avoid duplication.

---

Place this file at skills/GUIDELINES.md and reference it from SKILL.md files that previously duplicated these principles.
