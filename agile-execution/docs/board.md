# Board and eligibility

[← agile-execution](../README.md)

## Which tickets it picks up

The skill detects the board type.

| Board | Selection |
|---|---|
| **Scrum** | `status To Do AND sprint in openSprints()`. Future sprints and the no-sprint backlog are excluded |
| **Kanban** | On-board tickets not in the backlog column (Agile-API backlog keys, or `backlog-status-name`) |

A backlog or future-sprint ticket is never eligible. Every candidate is re-verified after the JQL fetch.

A ticket is built in Jira dependency order. It is eligible only if every blocker is Done. A blocker that is only In Review does not count, so its dependent is deferred, and a dependent is never branched off an unmerged blocker. A dependency cycle aborts the run.

## Repo-scope gate

`implement-validate` skips tickets that target another repo, resolved from git `origin` plus `repo` and `repo-component-map`.

## Resuming

Each phase posts a `🤖 <!-- agile:phase=x -->` marker on the Jira ticket. A re-run resumes at the first unfinished phase. Partly built tickets are picked up, never restarted: plan done with no code resumes at code, code pushed with no PR resumes at PR.

Markers are reconciled against the real branch, commits and open PR, so a phase that crashed after the work but before its marker still resumes correctly. Marker timestamps stop a reworked ticket from routing back to the build phases.

The orchestrator moves a Story to **In Review** after self-review approves. It never writes Done; the merge train does, and closes the trail with a `post_merge` marker. Inline runs (`concurrency=0`) post the same markers, before advancing, never batched at the end: with no agent boundary, the marker is the receipt.

## Board choice and rework queue

If both a Scrum and a Kanban board resolve, Scrum is used when a sprint is active, else Kanban. No question is asked.

In Review tickets carrying a `🤖 <!-- agile:phase=pr -->` marker form a rework queue: they skip the build phases and go straight to `implement-monitor`.
