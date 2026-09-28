---
type: llm
focus: last_message
weight: 1
---
An append-only route table conflicted. Check all of:
- It keeps BOTH routes — never takes one side wholesale (`--ours`/`--theirs`).
- Order is chronological by merge order: APP-599's contacts route (earlier, on main) before APP-607's pause route.
- It completes with `GIT_EDITOR=true git merge --continue` (not `--no-edit`).
- Because a conflict was hand-resolved it runs the linters AND the touched tests on the merged tree before pushing.
Fail if a route is dropped, `--no-edit` is used, or it pushes without re-running lint and tests.
