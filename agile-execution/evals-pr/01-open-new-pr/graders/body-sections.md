---
type: llm
focus: last_message
weight: 1
---
No PR exists for this branch, the implement marker's mode is `sequential`, and the plan carries a four-entry AC→test map. Check all of:
- The answer states it would open a NEW PR with `gh pr create` against base `main`, rather than editing an existing one.
- The PR title is `[APP-204]` followed by the Story summary.
- The body carries the required sections: Story link, what the PR does, AC coverage, Changes, Testing, Test tiers, ADR compliance, and a checklist.
- AC coverage maps all four ACs to the test names the plan gives.
- The Test tiers line states that lint, unit, integration and the fresh-DB migration were verified locally. It must NOT claim anything was deferred to CI.
- No `integration-deferred` label is applied, and the Story is NOT transitioned — this phase never moves the ticket.
Fail if the tiers line claims deferral, a label is added, or the ticket is transitioned.
