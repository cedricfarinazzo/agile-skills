# project-review

Read-only, out-of-cycle project assessment. It performs a deep technical review of a software or IT project, applies only relevant review domains, traces source code when present, and writes an evidence-backed Markdown report.

The review never modifies project source, configuration, tests, existing documentation, infrastructure, or remote systems. Its only permitted project-file write is the final report (`PROJECT_REVIEW.md`, or a non-conflicting timestamped name).

## Install

```text
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install project-review@agile-skills
```

For Codex:

```text
codex plugin marketplace add cedricfarinazzo/agile-skills
codex plugin add project-review@agile-skills
```

## Skill

| Skill | Purpose | Triggers |
|---|---|---|
| `deep-it-project-review` | Deep, evidence-backed assessment across applicable architecture, code, security, delivery, operations, and lifecycle domains | “deep IT project review”, “technical project review”, “architecture audit”, “assess this codebase” |

Invoke it directly as `/project-review:deep-it-project-review` in Claude Code or `$deep-it-project-review` in Codex.

## Where it fits

This is an out-of-cycle assessment tool. It is independent of the Agile product-to-sprint cycle and does not replace per-PR review, sprint closeout, or the `deep-refactor` audit-to-ticket-to-PR workflow.
