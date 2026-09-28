---
type: llm
focus: last_message
weight: 1
---
A blocker is cleared only when Done AND merged. Check all of:
- APP-702 is NOT eligible: its blocker APP-701 is In Review, its code is not on the base branch.
- APP-703 is eligible.
- It does not branch APP-702 off APP-701's unmerged branch, stack PRs, or stub the dependency to fake eligibility.
- It routes APP-701 to the merge train, after which APP-702 becomes eligible in a later pass.
Fail if APP-702 is built this pass or stacked on the open PR.
