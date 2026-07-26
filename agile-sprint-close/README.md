# agile-sprint-close

**Close** plugin — ends the sprint cleanly: housekeeping, a global engineering+product gate, post-merge QA sign-off, and the retrospective that feeds the next iteration. Uses the **`gh`** CLI + git and **Confluence + Jira**.

Part of [agile-skills](../README.md). Needs `gh` + the Atlassian MCP.

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-sprint-close@agile-skills
/reload-plugins
```

## Skills (run in this order)

| # | Skill | Role | Trigger |
|---|-------|------|---------|
| 12 | `agile-12-tech-debt-sweep` | pre-closeout housekeeping — audit cross-repo leakage, useless CI, prebuild-image wins, CLAUDE.md/SKILL.md cruft, misplaced artifacts. Report before apply | "tech debt sweep", "cleanup sweep", "housekeeping" |
| 13 | `agile-13-sprint-closeout` | mandatory epic-level gate, 3 lenses (below) | "sprint closeout", "close sprint", "/sprint-closeout" |
| 14 | `agile-14-qa-validation` | QA, confirm-after-merge (below) | "validate the story", "QA check", "confirm ACs" |
| 15 | `agile-15-retro` | sprint retro in Confluence + Roadmap update (index, child page, and the published Roadmap Artifact — now carrying real delivered-vs-committed numbers); feeds the next iteration | "run retro", "sprint retrospective", "what did we learn" |

## Sprint closeout — the third review layer

`agile-13-sprint-closeout` is a **global, impartial** review of the *whole wired-together sprint* against its goal — distinct from the per-PR reviews ([author self-review](../agile-execution/README.md) + [independent merge review](../agile-merge-review/README.md), which already happened). Three lenses:

1. **Engineer** — does the system actually work on a freshly rebuilt dev stack? (smoke + integration)
2. **Architect / PM** — does delivered code match the documented intent (Vision/PRD/ADR/Roadmap/epic ACs)?
3. **Tech Lead** — does it hold up under an impartial deep review of all sprint diffs?

A single Critical from any lens blocks closeout. It publishes a report to the `Closeouts` Confluence folder (sibling of `Retrospectives`), which the retro reads. Catches the "every AC green in isolation, but the wired system is broken" class of bug.

## QA — confirm-after-merge only

By the time `agile-14-qa-validation` runs, the Story is already **Done** (merged via the [merge train](../agile-merge-review/README.md), which owns the `Done` transition). QA confirms the ACs hold on `main` and stamps a sign-off comment — it **never** transitions the Story. A post-merge regression is filed as a new Bug (linked `is caused by`, Story labelled `qa-regression`), **never** a reopen — reversing a Done story would lose the merge audit trail.

## Retro → next iteration

`agile-15-retro` writes the retro page in the `Retrospectives` folder, reads the closeout report, marks the iteration ✅ Complete in the Roadmap index + child page, and hands its outputs (velocity, feedback, debt, actions) to `agile-5-roadmap` (ITERATION mode) to plan the next iteration.

## Confluence layout

`Retrospectives` and `Closeouts` are sibling folders under the project root — never nested. See the [canonical folder tree](../agile-planning/README.md#confluence-structure).

## Where it fits

After **agile-merge-review**; loops back to **agile-planning** (roadmap iteration). See the [full cycle](../README.md#cycle-order).
