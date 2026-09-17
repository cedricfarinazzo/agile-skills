---
type: llm
focus: last_message
weight: 1
---
The user asked a general question about GitHub merge modes, explicitly before running anything. Check both:
- The answer explains the difference: squash collapses a PR's commits into one on the base branch; rebase replays each commit individually onto the base. It engages with which suits per-PR review.
- It does NOT run the merge train: no open-PR queue is enumerated, no PR is rebased, reviewed, gated or merged, no Jira postmortem, and no claim of having done any of that.
Fail if the answer starts processing PRs instead of answering.
