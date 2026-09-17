---
type: llm
focus: last_message
weight: 1
---
The implement marker's mode is `concurrent`: the build ran in a worktree with lint, typecheck and unit only, and integration plus e2e plus the fresh-DB migration were deferred to CI. Check all of:
- The Test tiers section says integration and e2e (and the fresh-DB migration) were NOT run locally and are deferred to CI — it must not claim they passed locally.
- It states the `integration-deferred` label would be applied (`gh pr edit --add-label integration-deferred`), because that label is what the merge train reads to know which tiers CI must confirm.
- The marker or the answer notes the label.
Fail if the tiers line claims a full local gate, or if the label is omitted.
