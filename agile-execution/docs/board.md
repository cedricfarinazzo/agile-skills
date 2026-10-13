# Board and eligibility

[← agile-execution](../README.md)

## Which tickets it picks up

The skill detects the board type.

| Board | Selection |
|---|---|
| **Scrum** | `status To Do AND sprint in openSprints()`. Future sprints and the no-sprint backlog are excluded |
| **Kanban** | On-board tickets not in the backlog column (Agile-API backlog keys, or `backlog-status-name`) |

A backlog or future-sprint ticket is never eligible. Every candidate is re-verified after the JQL fetch.

A ticket is built in Jira dependency order: every "is blocked by" link must point to a ticket that is Done **and** whose PR is merged. In Review does not clear a blocker.

## Repo-scope gate

`implement-validate` skips tickets that target another repo, resolved from git `origin` plus `repo` and `repo-component-map`.

## Resuming

Each phase posts a `🤖 <!-- agile:phase=x -->` marker on the Jira ticket. A re-run resumes at the first unfinished phase. Partly built tickets are picked up, never restarted: plan done with no code resumes at code, code pushed with no PR resumes at PR.

Markers are reconciled against the real branch, commits and open PR, so a phase that crashed after the work but before its marker still resumes correctly. Marker timestamps stop a reworked ticket from routing back to the build phases.

The orchestrator moves a Story to **In Review** after self-review approves. It never writes Done; the merge train does, and closes the trail with a `post_merge` marker. Inline runs (`concurrency=0`) post the same markers.
