---
type: llm
focus: last_message
weight: 1
---
Check all of:
- It counts the 2 open PRs against the limit: 2 started-and-unmerged tickets, `concurrency=2`, so 0 free slots.
- It admits no new To Do ticket this pass (no `agile-10-implement` call, or one with no new keys).
- It runs the merge train on the open PRs this pass.
Fail if it starts building any of APP-901…APP-904 this pass, or treats `concurrency=2` as "2 tickets building" independent of open PRs.
