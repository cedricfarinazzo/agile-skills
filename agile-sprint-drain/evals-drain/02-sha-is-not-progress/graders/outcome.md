---
type: llm
focus: last_message
weight: 1
---
The stall key deliberately excludes the head SHA. Check all of:
- It says the PR is NOT making progress: failing checks, reviewDecision and mergeStateStatus are identical across the passes; a SHA moved only by rebasing onto main is not progress.
- It counts the identical passes toward the stall threshold for PR/CI items (K = 3). Three passes are two identical transitions, so stall_count 2 — one pass short of retiring the item — is correct; so is treating it as at the threshold. What fails is resetting the counter because the SHA moved.
Fail if the changing SHA is taken as progress.
