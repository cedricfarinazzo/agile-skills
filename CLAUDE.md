# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code marketplace shipping **five focused plugins** (split by cycle phase so users load only what they run):

- **`agile-product`** — discovery: Vision Doc, PRD, Design Brief / Specs UI, ADR (Confluence).
- **`agile-planning`** — Roadmap, Epics, Stories, Refinement, Sprint Planning (Confluence + Jira).
- **`agile-execution`** — autonomous build loop: Implement (10) + Dev Review (11). Needs `gh`.
- **`agile-merge-review`** — PR workflow (formerly `dev-skills`): update-pr, review-pr, fix-until-satisfied, jira-postmortem, merge-train. Needs `gh`.
- **`agile-sprint-close`** — tech-debt sweep, sprint closeout, QA validation (confirm-after-merge), retro. Needs `gh` + Atlassian.

User-facing skills keep global cycle numbering (`agile-1` … `agile-15`) across plugins; composed sub-skills (the `implement-*` blocks and the `dev-*` merge-train blocks) are **unnumbered** because the user does not call them directly. Namespace = plugin name, e.g. `/agile-planning:agile-5-roadmap`, `/agile-merge-review:agile-11-merge-train`.

Execution (skill 10, `agile-10-implement`) is an **autonomous sprint loop** modelled on `nightshift jira run` + `agile-11-merge-train`. It is an orchestrator that composes its unnumbered `implement-*` sub-skills (validate → plan → code → pr → review → monitor) per ticket: it pulls the active board (Scrum sprint or Kanban ready column — never backlog/future), orders tickets by Jira dependency links, and drives each to In Review with an open, self-reviewed PR — no mid-loop confirmation. `agile-10-implement` clears the build queue (`To Do` → open PR); `agile-11-merge-train` clears the merge queue (open PR → `main`).

Install: `/plugin marketplace add cedricfarinazzo/agile-skills` then `/plugin install <plugin>@agile-skills` for any subset.
Test locally: `claude --plugin-dir ./agile-skills/<plugin>` (one plugin dir at a time).

## Structure

```
README.md                                 # root README — OVERVIEW only (plugin table, cycle diagram, install, links)
.claude-plugin/marketplace.json          # marketplace — lists all 5 plugins (git-subdir per path)
<plugin>/README.md                        # per-plugin README — the detail for that plugin
<plugin>/.claude-plugin/plugin.json       # one manifest per plugin
<plugin>/skills/<name>/SKILL.md           # one dir per skill
agile-planning/skills/agile-8-refinement/scripts/   # bundled scripts — invoke via ${CLAUDE_PLUGIN_ROOT}
```

Plugin → skills:
- `agile-product/`: agile-1..4
- `agile-planning/`: agile-5..9
- `agile-execution/`: **agile-10-implement** (orchestrator, numbered) + unnumbered sub-skills `implement-validate` / `implement-plan` / `implement-code` / `implement-pr` / `implement-review` / `implement-monitor`
- `agile-merge-review/`: **agile-11-merge-train** (orchestrator, numbered) + unnumbered sub-skills `merge-update-pr` / `merge-review-pr` / `merge-fix-until-satisfied` / `merge-jira-postmortem`
- `agile-sprint-close/`: agile-12-tech-debt-sweep, agile-13-sprint-closeout, agile-14-qa-validation, agile-15-retro

There is **no root plugin** — the repo root holds only `README.md`, `.claude-plugin/marketplace.json`, and the five plugin dirs.

**Docs split:** the root `README.md` is an **overview** (plugin table, cycle diagram, three-review-roles note, install, requirements) that **links** to each plugin's README; plugin-specific detail (skill tables, the Confluence tree, per-repo config, the autonomous-loop / merge-train internals) lives in `<plugin>/README.md`. When you change a skill, update its plugin README; keep the root as overview-only and don't re-duplicate plugin detail there. The canonical Confluence tree lives in full in `agile-planning/README.md` (others link to it).

## SKILL.md format

Each `SKILL.md` has YAML frontmatter + markdown instructions:

```yaml
---
name: agile-N-<slug>
description: <when Claude should invoke this — include trigger phrases>
---

# Instructions...
```

Key frontmatter fields: `name`, `description`, `when_to_use`, `allowed-tools`, `disable-model-invocation`, `user-invocable`.

**Sub-skills composed by an orchestrator use `user-invocable: false`, NOT `disable-model-invocation: true`.** `disable-model-invocation: true` means *only the user* can invoke it — Claude can't, which would break an orchestrator calling it via the Skill tool. `user-invocable: false` hides the skill from the `/` menu while keeping it Claude-invocable (so `agile-10-implement` can compose the `implement-*` blocks). The `merge-*` blocks leave both open (also fine — orchestrator-invocable).

## Skill authoring rules

- `description` must include trigger phrases — Claude uses it for auto-invocation
- Skills are **idempotent**: re-running must not duplicate Confluence pages or Jira issues (read before write)
- Skills are **resumable**: if interrupted, re-run picks up where it stopped. The autonomous loop (`agile-10-implement`) resumes per ticket via `🤖 <!-- agile:phase=x -->` Jira comment markers
- Every assumption must be stated explicitly (no silent inference)
- **Interactive skills** (1–9, 14, 15) ask all missing info in a single message, never drip; they stop on missing prerequisites. **The autonomous loop** (`agile-10-implement` + its `implement-*` sub-skills) is the exception: it does NOT pause for confirmation — it infers-and-flags, escalates only on a critical decision, and its validation gate sends an under-specified ticket back (Needs Info) rather than asking. `agile-11-merge-train` is likewise autonomous across the open-PR queue
- End every interactive skill run with a clear `✅ Done / ⚠️ Still needed / 👉 Next step` summary; the autonomous loop ends with a per-ticket outcome report

## Confluence structure invariant

All `agile-skills` skills share one canonical folder layout (root → Vision/PRD/Brief/Specs/ADR/Roadmap → `MVP`/`Iteration N` child pages of Roadmap; `Retrospectives` + `Closeouts` sibling folders). The full tree is embedded verbatim under a `## Confluence structure (canonical …)` heading in **every** Confluence-using skill.

**RULE — when you change the Confluence structure (add/rename/move a page or folder, change a parent, change the short-index split, or renumber a skill referenced in the tree), you MUST update the `## Confluence structure` block in ALL skills that carry it, in the same change. Updating one copy and leaving the others stale is a bug.**

- Skills carrying the block: `agile-1-create-vision-doc`, `agile-2-create-prd`, `agile-3-design-brief`, `agile-4-create-adr`, `agile-5-roadmap`, `agile-6-create-epics`, `agile-8-refinement`, `agile-9-sprint-planning`, `agile-14-qa-validation`, `agile-15-retro` (plus the README "Confluence structure" section). Re-confirm the list with `grep -rl "Confluence structure (canonical" agile-*/skills` before editing.
- Watch the **bare skill-number attributions inside the tree** (e.g. `(folder, agile-15; one Retro page per sprint)`, `(agile-5 — SHORT INDEX…)`) — these are not slugs, so a name-only find/replace will miss them. Update them too.
- Edit all copies with a single scripted pass (Python, not a hand sed loop), then `grep` to prove zero stale copies remain.

**The Roadmap is a short index** — guiding principle + iterations index table + per-sprint progress rollup + parking lot only. All deep detail (goal, success criteria, epics-in-scope, per-sprint backlog, decisions, retro write-ups) lives on the `MVP` / `Iteration N` child pages, which use an Epic Sprint Plan index table + one detail section per sprint. Skills must never inline that detail into the Roadmap.

## Cycle order

Canonical schema in `README.md` (covers all five plugins, the autonomous execution loop, confirm-after-merge QA, agile-11-merge-train integration, sprint-closeout gate).

Invariant for all skills: read existing Confluence pages + Jira issues before creating anything.

Bundled scripts (e.g. `agile-planning/skills/agile-8-refinement/scripts/sprint-shared-file-audit.sh`) must be invoked via `${CLAUDE_PLUGIN_ROOT}` — a bare relative path won't resolve when installed as a plugin (cwd is the consumer repo).

Cross-plugin references: skills call siblings by name (Skill tool / prose). Most compose within one plugin (agile-11-merge-train → its 4 sub-skills; agile-10 → agile-11). Cross-plugin links that matter: `agile-14-qa-validation` + `agile-15-retro` read `agile-13-sprint-closeout`'s output (all in `agile-sprint-close`); `agile-9` hands off to `agile-10` (planning → execution).

## Plugin + marketplace manifests

Each plugin has `<plugin>/.claude-plugin/plugin.json`: `name` (sets the skill namespace prefix), `version` (bump on releases), author/homepage/repo/license. Skills are auto-discovered from that plugin's `skills/*/SKILL.md`.

`.claude-plugin/marketplace.json` (repo root) lists all five plugins, each via a `git-subdir` source pointing at its path (`cedricfarinazzo/agile-skills` + `path: <plugin>`). Adding a plugin = new dir with a manifest + a new marketplace entry. Keep plugin `name` in `plugin.json` and the marketplace entry in sync.
