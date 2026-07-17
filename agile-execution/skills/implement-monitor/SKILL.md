---
name: implement-monitor
description: "Sub-skill of agile-10-implement. Monitor a pre-merge PR and rework it: process new review comments, diagnose + fix failing status checks, rebase on conflicts. Idempotent via the 🤖 rework marker. Not user-invoked."
user-invocable: false
---

# implement_monitor

PR monitoring + rework phase for `agile-10-implement` — the `nightshift` review-feedback loop plus the merge-train CI/conflict handling, applied to the **pre-merge** PR. Invoked per ticket whose PR is open (just-built or from the rework queue). **Rework touches the shared stack, so it always runs sequentially — never concurrently, in either mode.** Under `concurrency>1` the Phase-1 build fans out across worktrees (stack-free only), but this phase is the **serial tail**: after a batch converges, its PRs are monitored/reworked **one at a time** holding the stack. This is where the deferred stack-bound tiers (integration + e2e) actually run against the stack — a red integration/e2e check from CI is **reproduced and fixed here**, never pushed-and-deferred back to CI unfixed. Fixing a red check by re-pushing and hoping CI flips is not allowed.

For the PR, check three things and act:

1. **New review comments.** `gh pr view <N> --json reviews,comments` + `gh api` for review threads. **Filter to comments newer than the last `🤖 agile:phase=rework` marker** (idempotency — never re-process a comment). For each new actionable comment: implement the fix, commit, push, reply to the thread. Post `🤖 agile:phase=rework` recording what was addressed.
2. **Failing status checks.** Poll `statusCheckRollup`. On `FAILURE` / `UNSTABLE`, run the **flake-vs-regression diagnosis** before re-running — never blind-rerun. The diagnosis, in order:
   - **Read the actual failing assertion, not the job's teardown.** A truncated log (`gh <runner> view --log-failed` often shows only the cleanup/teardown step, not the failing test) hides the cause. Fetch the full job log (download the run-log archive via the forge API if needed) and grep for the real failure line — the failing test name, the assertion, the exception message. Diagnose from *that*, not from "a check is red".
   - **Compare the same check across sibling PRs and recent base-branch runs.** If the identical check is green on other open PRs built from the same base on the same CI — and intermittently red on unrelated base commits — it is an infra/environment flake, not your regression. If sibling PRs on the same CI are **green** and only this PR is red, treat it as a **real regression** this PR introduced, even if the failing test is not one you wrote (your change may have broken a pre-existing test — e.g. a schema/contract/shared-file change failing another module's test).
   - Other tells: was the same test green on a recent base run? does the PR add a test file collected before the failing one? repro locally `<runner> <new-test> <failing-test>`.
   - Real failure → fix, push. Confirmed flake → `gh run rerun --failed`.
3. **Merge conflicts / staleness.** `mergeStateStatus` `DIRTY` / `BEHIND` → rebase: `git checkout <base> && git pull`, then `git merge --no-ff <base>` on the branch, resolve conflicts, run lint-after-rebase, push. (`git merge --continue` rejects `--no-edit` — use `GIT_EDITOR=true git merge --continue`.)

**Poll without foreground `sleep`.** Use a single background `until` loop and read the output when it fires:
```bash
until [ "$(gh pr view <N> --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.status!="COMPLETED")]|length')" = "0" ]; do sleep 20; done; gh pr view <N> --json statusCheckRollup,mergeStateStatus,reviewDecision --jq '{merge:.mergeStateStatus,decision:.reviewDecision,checks:[.statusCheckRollup[]|{n:.name,c:.conclusion}]}'
```
Run it with `run_in_background: true`; the completion notification re-invokes you — read the file and act. Do not chain foreground `sleep`s, and do not poll in a foreground loop.

**Best-effort within the run:** process whatever review comments / check results / conflicts exist now. Do not block indefinitely waiting for a human reviewer — once the current state is handled and no new actionable signal remains, record status and return. A later re-run (or `/loop`) picks up new review comments via the marker filter.

Fixes that touch code reuse `implement-code`'s rules (ADR is law, all ACs tested, suites green before push). Because this phase holds the stack, it runs the **full** gate before pushing a fix — lint + unit + **integration** (and e2e / fresh-DB migration where relevant), including the tiers a concurrent build deferred. A critical decision surfacing during rework is escalated to the orchestrator, not guessed.

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=rework --> **rework — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=rework -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
