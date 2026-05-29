# agile-merge-review

**Merge** plugin (formerly `dev-skills`) — clears the open-PR queue *safely*: every PR that lands on `main` has been rebased, deeply reviewed file-by-file against its Jira ACs, re-verified by a fresh CI run, merged, and closed out in Jira. Uses the **`gh`** CLI + git and **Jira**.

Part of [agile-skills](../README.md). Needs `gh` + the Atlassian MCP.

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-merge-review@agile-skills
/reload-plugins
```

## What's in it

| # | Skill | Role |
|---|-------|------|
| 11 | `agile-11-merge-train` | **Orchestrator** (user-invoked) — processes every open PR sequentially |
| — | `merge-update-pr` | rebase on main, resolve conflicts, lint-after-rebase, push only if a merge commit was created |
| — | `merge-review-pr` | deep **independent** PR review — read every changed file, check vs ACs, report by severity |
| — | `merge-fix-until-satisfied` | fix every finding (Critical + Minor), re-verify, until satisfied |
| — | `merge-jira-postmortem` | post structured post-merge comment + transition the Story to Done |

The `merge-*` blocks are **unnumbered sub-skills** the train composes via the Skill tool; you don't call them directly. Invoke `/agile-merge-review:agile-11-merge-train` ("merge train", "process all open PRs").

## The per-PR sequence

```
3a merge-update-pr        rebase on main (push only if a merge commit was created)
3b merge-review-pr        read every changed file in full, vs the Jira ACs
3c merge-fix-until-satisfied  ALWAYS — fix Critical + Minor; satisfaction gate even on a clean review
3d bad-PR escape hatch    too broken to fix in one pass → postmortem (blocked), don't merge
3e CI wait                fresh, post-rebase green (not "green yesterday")
3f gh pr merge --squash --delete-branch
3g merge-jira-postmortem  comment + transition Done
```

One PR at a time — each merge changes `main`, so the next PR rebases on the new tip and re-runs CI. Cross-PR file collisions are detected up front and retro-linked in Jira (`relates to`) at the end.

## Independent review — the second of three layers

`merge-review-pr` is the **independent** review by someone other than the author. The implementer already self-reviewed and fixed the obvious in [`implement-review`](../agile-execution/README.md); this is the authoritative pre-merge gate before code hits `main`. (The third layer is the global [sprint closeout](../agile-sprint-close/README.md).) Review as a reviewer who didn't write the code — verify against the spec + ADR yourself.

## Configuration

Reads the consumer repo's `CLAUDE.md` / `AGENTS.md`: `cloudId` (required), `ticket-prefix-regex`, `done-status-name` (+ optional `done-transition-id` fast path), and lint commands per touched path family.

## Where it fits

After **agile-execution** opens the PRs; before **agile-sprint-close**. See the [full cycle](../README.md#cycle-order).
