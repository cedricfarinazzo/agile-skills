# agile-product

Product **discovery** plugin — the *what & why* of the cycle. Turns a raw idea into the approved Confluence docs that everything downstream derives from. Integrates with **Confluence** (and reads Jira for context).

Part of [agile-skills](../README.md). Needs the Atlassian MCP.

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-product@agile-skills
/reload-plugins
```

## Skills

| # | Skill | Produces | Trigger |
|---|-------|----------|---------|
| 1 | `agile-1-create-vision-doc` | Vision Doc + the project root folder | New product idea, "start a new project", "create vision doc" |
| 2 | `agile-2-create-prd` | PRD (from the Vision Doc) | "write the PRD", "draft product requirements" |
| 3 | `agile-3-design-brief` | Design Brief (BRIEF mode) → Specs UI (INTEGRATE mode) | "write the design brief", "create Specs UI", "integrate mockups" |
| 4 | `agile-4-create-adr` | ADR + tech feasibility + Epic breakdown proposal | "write the ADR", "architecture decisions", "technical feasibility" |

Invoke directly with `/agile-product:<skill>`, or let Claude auto-fire on a matching phrase.

## How it works

Each skill **reads what the previous one wrote, then interviews you only for the gaps** — it never drafts a section it has no real information for, asks all missing questions in one message, and states every assumption explicitly. Runs are idempotent + resumable: re-running fills only what's missing, never duplicates a page.

`agile-3-design-brief` is two-mode: **BRIEF** writes the brief that goes *to* the designer; **INTEGRATE** documents the designer's outputs back as a Specs UI page. They are separate pages, never merged.

`agile-4-create-adr` ends with an **Epic Breakdown Proposal** (section 11) — the direct input to `agile-5-roadmap` in the planning plugin.

## Confluence layout

All four pages are children of the project root folder created by `agile-1`. See the [canonical folder tree](../agile-planning/README.md#confluence-structure) (shared by every agile-skills plugin).

## Where it fits

Cycle start → hands off to **agile-planning**. See the [full cycle](../README.md#cycle-order).
