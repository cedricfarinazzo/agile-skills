# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code marketplace shipping **two plugins**:

- **`agile-skills`** — 13 skills, full product cycle (Vision Doc → Retro), integrated with Confluence + Jira via Atlassian MCP.
- **`dev-skills`** — 7 skills, developer workflow (deep PR review, fix-until-satisfied, rebase, Jira postmortem, multi-PR merge train, tech-debt sweep, sprint closeout). Needs the `gh` CLI.

Execution (agile skills 10 Implement + 11 Dev Review) is an **autonomous sprint loop** modelled on `nightshift jira run` + `dev-merge-train`: it pulls the sprint, orders tickets by Jira dependency links, and runs validate → plan → implement → commit → PR → self-review → In Review per ticket with no mid-loop confirmation, then monitors each PR. `agile-10-implement` clears the build queue (`To Do` → open PR); `dev-merge-train` clears the merge queue (open PR → `main`).

Install: `/plugin marketplace add cedricfarinazzo/agile-skills` then `/plugin install agile-skills@agile-skills` (and/or `dev-skills@agile-skills`).
Test locally: `claude --plugin-dir ./agile-skills`

## Structure

```
.claude-plugin/{plugin.json,marketplace.json}   # agile-skills manifest + marketplace (ships both plugins)
skills/<name>/SKILL.md                           # agile-skills — one dir per skill
skills/agile-8-refinement/scripts/               # bundled scripts — invoke via ${CLAUDE_PLUGIN_ROOT}
dev-skills/.claude-plugin/plugin.json            # dev-skills manifest
dev-skills/skills/<name>/SKILL.md                # dev-skills — one dir per skill
```

Skills are namespaced per plugin: `/agile-skills:<skill-name>`, `/dev-skills:<skill-name>`.

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
- Skills are **resumable**: if interrupted, re-run picks up where it stopped. The autonomous loop (`agile-10-implement`) resumes per ticket via `🤖 <!-- agile:phase=x -->` Jira comment markers
- Every assumption must be stated explicitly (no silent inference)
- **Interactive skills** (1–9, 12, 13) ask all missing info in a single message, never drip; they stop on missing prerequisites. **The autonomous loop** (`agile-10-implement` + its `agile-11-dev-review` self-review gate) is the exception: it does NOT pause for confirmation — it infers-and-flags, and its per-ticket validation gate sends an under-specified ticket back (Needs Info) rather than asking
- End every interactive skill run with a clear `✅ Done / ⚠️ Still needed / 👉 Next step` summary; the autonomous loop ends with a per-ticket outcome report

## Confluence structure invariant

All `agile-skills` skills share one canonical folder layout (root → Vision/PRD/Brief/Specs/ADR/Roadmap → `MVP`/`Iteration N` child pages of Roadmap; `Retrospectives` + `Closeouts` sibling folders). The full tree is embedded verbatim in every Confluence-using skill (`## Confluence structure (canonical …)`) — when it changes, update **all** copies, not one.

**The Roadmap is a short index** — guiding principle + iterations index table + per-sprint progress rollup + parking lot only. All deep detail (goal, success criteria, epics-in-scope, per-sprint backlog, decisions, retro write-ups) lives on the `MVP` / `Iteration N` child pages, which use an Epic Sprint Plan index table + one detail section per sprint. Skills must never inline that detail into the Roadmap.

## Cycle order

Canonical schema in `README.md` (covers both `agile-skills` and `dev-skills` plugins, the autonomous execution loop, Mode A vs Mode B QA, dev-merge-train integration, sprint-closeout gate).

Invariant for all skills: read existing Confluence pages + Jira issues before creating anything.

Bundled scripts (e.g. `skills/agile-8-refinement/scripts/sprint-shared-file-audit.sh`) must be invoked via `${CLAUDE_PLUGIN_ROOT}` — a bare relative path won't resolve when installed as a plugin (cwd is the consumer repo).

## Plugin manifest

`plugin.json` fields that matter: `name` (sets skill namespace prefix), `version` (bump on releases). Skills are auto-discovered from `skills/*/SKILL.md`.
