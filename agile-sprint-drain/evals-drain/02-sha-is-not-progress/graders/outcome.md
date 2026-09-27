---
type: llm
focus: last_message
weight: 1
---
The stall key deliberately excludes the head SHA. Check all of:
- It says the PR is NOT making progress: failing checks, reviewDecision and mergeStateStatus are identical across the passes; a SHA moved only by rebasing onto main is not progress.
- It counts this as a stall reaching the PR/CI threshold (K = 3) and treats the item as stuck/blocked rather than rebasing it again.
Fail if the changing SHA is taken as progress.
