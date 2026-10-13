# Per-PR sequence

[← agile-merge-review](../README.md)

```text
3a merge-update-pr            rebase on main (push only if a merge commit was created)
3b merge-review-pr            read every changed file in full, against the Jira ACs
3c merge-fix-until-satisfied  ALWAYS: fix Critical + Minor; satisfaction gate even on a clean review
3d bad-PR escape hatch        too broken to fix in one pass: postmortem (blocked), don't merge
3e CI wait                    fresh, post-rebase green
3f reviewed-sha gate          landing tip == the sha 3b reviewed, else re-review the delta, back to 3e
3f gh pr merge --squash --match-head-commit <reviewed sha>
                              verify with `gh pr view --json state,mergedAt` (exit code is not the signal)
3g merge-jira-postmortem      comment (opens with the post_merge marker) + transition Done
—  branch cleanup            end of train, best effort
```

## Review and fix rounds

Review and fix converge under a round budget: at most 2 rounds per PR, the full review, then one delta review of the fix.

- The delta review judges only what the fix changed and is final.
- An open Critical blocks the PR.
- Remaining Minors merge at the last reviewed-and-green sha and are reported as a follow-up.
- Across train runs a PR gets at most 3 fix rounds, rework from `agile-10-implement` included. A 4th sends it to 3d for a human.

Any PR whose review found something goes through the second review. That is normal flow.

## Collisions

Cross-PR file collisions are detected up front into a structured `conflict_map` (per PR: colliding file, other PR, other ticket). It is passed verbatim into each postmortem dispatch and linked in Jira (`relates to`) at the end.

## Concurrent builds

A PR built concurrently (`integration-deferred` label) has integration and e2e gated by the fresh CI-green run, not a local re-run.

## Agents

| Agent | Runs | Model / effort | Why |
|---|---|---|---|
| `agile-merge-review:pr-updater` | `merge-update-pr` (3a) | sonnet / low | 3b re-reads every changed file at the reviewed sha, so a bad resolution is caught |
| `agile-merge-review:pr-reviewer` | `merge-review-pr` (3b) | opus / medium | last read before the base branch; nothing downstream re-reads the code |
| `agile-merge-review:fix-until-satisfied` | `merge-fix-until-satisfied` (3c) | sonnet / medium | the independent review re-reads the result |
| `agile-merge-review:jira-postmortem` | `merge-jira-postmortem` (3g) | sonnet / low | a templated comment and one transition |

At the top level the train sends one push notification when a PR goes to 3d or a stop condition ends the run.
