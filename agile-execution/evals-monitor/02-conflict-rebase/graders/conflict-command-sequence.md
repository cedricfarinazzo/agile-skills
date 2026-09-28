---
type: llm
focus: last_message
weight: 1
---
mergeStateStatus is DIRTY and the ticket's code is in a worktree while the shared checkout holds main. Check all of:
- The sequence refreshes the base WITHOUT checking it out: `git fetch origin main` then a merge of `origin/main` into the ticket branch. It must NOT `git checkout main` first — git refuses to check one branch out in two worktrees, so that fails outright here.
- The work happens inside the ticket's worktree (`.claude/worktrees/APP-418`), by `cd` or `git -C`, not in the shared checkout.
- It resolves the conflict in `inventory/services/audit.py`, then re-runs the gate (at least lint) after the merge, before pushing.
- If it mentions completing the merge commit, it uses `GIT_EDITOR=true git merge --continue` — `--no-edit` is rejected there.
Fail if the answer checks out the base branch, works in the shared checkout, or pushes without re-running the gate.
