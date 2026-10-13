# Reference

[← agile-merge-review](../README.md)

## Sub-skills

| Skill | Role |
|---|---|
| `merge-update-pr` | Rebase on main (`merge --no-ff`), resolve conflicts, lint-after-rebase gate, push only if a merge commit was created |
| `merge-review-pr` | Independent deep review: every changed file, against ACs; receipt with files-read = diff and a cite per lens and per AC |
| `merge-fix-until-satisfied` | Fix every finding (Critical and Minor), re-verify, run the whole CI lint job before the push; returns the pre-push run id and pushed sha. The caller gates the fresh run |
| `merge-jira-postmortem` | Structured post-merge comment and Done transition; receipt with comment id and done-category |

## Dispatch and verify

The train's main agent orchestrates only. It runs no step's work in its own context. Each step 3a to 3g runs in its named agent and returns a receipt; the train verifies it against `gh` and Jira before advancing.

- A shallow review is caught because the `merge-review-pr` receipt must list a files-read set equal to the PR diff, with a `file:line` cite per lens and per AC.
- A skipped postmortem is caught because Phase 5 refuses to report a merged PR as Done without a verified receipt (comment id and done-category), and re-dispatches it.

## Never merge a sha no review has read

3b reviews the tip as it stood then; 3c pushes fixes onto it. So 3b records the **reviewed sha** and 3f asserts the landing tip equals it. A mismatch means the delta is unreviewed (the fixer re-examining its own fix is not an independent gate). The reviewer is re-dispatched on the delta and the PR re-enters the CI wait.

## Base-branch proof

"Pre-existing", "unrelated", "environment" and "tooling drift" are claims. No step may write off a red check by reading its output. Run the same command on the base branch, compare exit codes, state the comparison in the receipt. Filenames in the output being untouched by the diff is not evidence: a diff can cause a failure reported against files it never edited.

Three triage rules ride with it:

1. Isolate the failing item **by severity** (the error, not the noisier warnings) before diagnosing.
2. Treat a **SKIPPED** job as a symptom and walk the dependency chain to the gate that failed.
3. Check **reachability** before calling an identical repeat failure real. A subtree byte-identical to a base branch where the test is green cannot be the cause; retry on an uncontended runner.

## What the reviewer checks

The author already self-reviewed with `implement-review`; this review is the authoritative one.


- Every file is read **at the reviewed sha** (`git show <sha>:<path>`), never from a working tree that may be on another branch.
- The diff against the ACs, the out-of-scope section, **and the documented invariants and conventions**. A change that makes a documented invariant false is a defect even when the code is correct. A limitation comment that outlives its limitation is its own defect. A doc entry is verified accurate, not merely present.
- A negative or guard test must **reach the guard it names**, not be rejected first by an earlier validation layer.
- A change labelled "cosmetic" that touches control flow still gets per-branch equivalence proof.
- A standing convention that conflicts with the ticket's DoD wording becomes a **labelled conscious accept** in the satisfaction receipt and the postmortem, never a silent deviation.

## Pushes

Each push names its branch: `git push <remote> <branch>`, alone or after `git add` / `git commit` in the same command. With [agile-mods](../../agile-mods/docs/guards.md) installed, the push rule and the fix-round cap are enforced at the call.
