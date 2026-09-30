---
type: llm
focus: last_message
weight: 1
---
Judge only what it does in pass 1. Check all of:
- It counts the 2 open PRs against the limit: 2 started-and-unmerged tickets, `concurrency=2`, so 0 free slots.
- It admits no new To Do ticket in pass 1 (no `agile-10-implement` call, or one with no new keys).
- It sends the actionable open PR(s) to the merge train in pass 1. Passing only #40 and waiting on #41's running CI is correct.
Describing a later pass that admits a ticket once a PR has merged is correct, not a failure.
Fail if it starts building any of APP-901…APP-904 in pass 1, or treats `concurrency=2` as "2 tickets building" independent of open PRs.
