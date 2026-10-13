# <img src=".claude-plugin/icon.svg" width="40" alt="" align="top"> project-review

Read-only technical assessment of any software or IT project, outside the agile cycle. It reads the repository, traces behavior across files, and writes an evidence-backed Markdown report with a file-coverage ledger.

Part of [agile-skills](../README.md). Needs nothing: no Jira, Confluence or `gh`.

## What you get

| Skill | What it does | Say |
|---|---|---|
| `deep-it-project-review` | Assesses architecture, code, security, delivery, operations and lifecycle domains, where applicable, and writes `PROJECT_REVIEW.md` | "deep IT project review", "technical project review", "architecture audit", "assess this codebase" |

The report is the only file it writes: `PROJECT_REVIEW.md`, or a non-conflicting timestamped name. It never modifies source, configuration, tests, existing documentation, infrastructure or remote systems.

## Profiles

| Profile | Covers | Stops when |
|---|---|---|
| `deep` (default) | Every review-relevant file, every applicable domain | The file inventory is fully read, the ledger is reconciled and the report is written |
| `standard` | Mapped critical paths, all deployment, configuration and CI evidence, the highest-risk package in each layer | Declared scope is complete; omissions are listed |
| `quick` | Recon plus the highest-risk reachable paths | Same |
| a focus (`security`, `tests`, `performance`, `architecture`, …) | Recon, then that domain and its direct dependencies | Same |
| `branch` | A changed-path list you supply, plus direct callers and importers | Same |

A scoped profile names what it left out instead of claiming exhaustive coverage. The skill never runs Git, so give `branch` the path list yourself.

## Install

```text
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install project-review@agile-skills
```

Run `/project-review:deep-it-project-review`. On Codex:

```text
codex plugin marketplace add cedricfarinazzo/agile-skills
codex plugin add project-review@agile-skills
```

then `$deep-it-project-review`.

## Where it fits

Independent of the agile cycle. It does not replace per-PR review, [sprint closeout](../agile-sprint-close/README.md), or the [deep-refactor](../deep-refactor/README.md) audit-to-PR workflow. Full cycle: [root README](../README.md#cycle-order).
