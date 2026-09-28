---
type: llm
focus: last_message
weight: 1
---
The gate is green and the branch is pushed. This phase ends there. Check all of:
- The answer posts the `implement` marker and hands back to the orchestrator.
- It does NOT open a PR, and says so explicitly or clearly stops short of it — opening the PR belongs to the next phase, implement-pr.
- It does NOT transition the Jira ticket to In Review or any other status.
- The marker it writes carries the per-command exit codes and the Mutation line already established.
Fail if the answer opens or drafts-and-opens a PR, transitions the ticket, or continues into review.
