---
name: implement-pr
description: "Sub-skill of agile-10-implement. Open or update the pull request for the ticket's pushed branch, linked to the Jira Story, with AC coverage + ADR-compliance sections. Posts the 🤖 pr marker. Not user-invoked."
user-invocable: false
---

# implement_pr

PR phase for `agile-10-implement`. Invoked via the Skill tool after `implement-code` has pushed the branch. Idempotent — updates an existing open PR rather than opening a duplicate. Posts the `🤖 agile:phase=pr` marker with the PR URL.

## Open or update

- `findExistingPR`: `gh pr list --state open --head <branch> --json number,url`.
  - found → `gh pr edit` (refresh title/body)
  - none → `gh pr create --base <base-branch>`
- **Title:** `[TICKET] <Story summary>`
- **Body sections:**
  - **Story** — link to the Jira ticket
  - **What this PR does** — 2–3 sentences
  - **AC coverage** — each AC → the test / verification that covers it
  - **Changes** — files/modules touched and why
  - **Testing** — unit / integration / manual; edge cases covered
  - **Specs UI match** — states implemented; any deviation + reason (UI Stories)
  - **ADR compliance** — new decisions / libraries introduced, each flagged for the reviewer
  - **Checklist** — ACs tested · lint/type clean · no regressions · PR linked to Jira · Specs UI match · ADR compliance

Post `🤖 agile:phase=pr` with the PR URL. Return the PR number/URL to the orchestrator.

> This phase does **not** transition the Story — the orchestrator transitions to `In Review` only after `implement-review` approves. Never transition to `Done`.
