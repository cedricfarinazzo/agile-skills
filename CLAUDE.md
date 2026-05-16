# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Claude Code plugin — 13 agile workflow skills covering the full product cycle (Vision Doc → Retro), integrated with Confluence and Jira via Atlassian MCP.

Install: `/plugin marketplace add cedricfarinazzo/agile-skills` then `/plugin install agile-skills@agile-skills`
Test locally: `claude --plugin-dir ./agile-skills`

## Structure

```
.claude-plugin/plugin.json   # Plugin manifest (name, version, author)
skills/<name>/SKILL.md       # One directory per skill
```

Skills are namespaced: `/agile-skills:<skill-name>` (e.g. `/agile-skills:agile-1-create-vision-doc`).

## SKILL.md format

Each `SKILL.md` has YAML frontmatter + markdown instructions:

```yaml
---
name: agile-N-<slug>
description: <when Claude should invoke this — include trigger phrases>
---
# Instructions...
```

Key frontmatter fields: `name`, `description`, `when_to_use`, `allowed-tools`, `disable-model-invocation`.

## Skill authoring rules

- `description` must include trigger phrases — Claude uses it for auto-invocation
- Skills are **idempotent**: re-running must not duplicate Confluence pages or Jira issues (read before write)
- Skills are **resumable**: if interrupted, re-run picks up where it stopped
- Every assumption must be stated explicitly to the user (no silent inference)
- Ask all missing info in a single message, never drip questions one by one
- End every skill run with a clear `✅ Done / ⚠️ Still needed / 👉 Next step` summary

## Agile cycle order

1 → 2 → 3, 4, 5 → 6 → 7 → 8 → 9 → 12 → 13 → 10, 11

Each skill reads from what the previous skill wrote (Confluence pages, Jira issues). Skills must check for existing state before creating anything.

## Plugin manifest

`plugin.json` fields that matter: `name` (sets skill namespace prefix), `version` (bump on releases). Skills are auto-discovered from `skills/*/SKILL.md`.
