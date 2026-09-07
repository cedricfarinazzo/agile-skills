---
name: implement-monitor
description: "Sub-skill of agile-10-implement — PR monitoring and rework. Not user-invoked."
user-invocable: false
---

# implement_monitor

PR monitoring + rework for `agile-10-implement`, applied to the **pre-merge** PR. Invoked per ticket whose PR is open — just-built, or from the rework queue.

**Always sequential, in both modes.** Rework touches the shared Docker stack, so under `concurrency>1` this phase is the serial tail: the Phase-1 build fans out across worktrees (stack-free only), then its PRs are monitored one at a time holding the stack. This is where the deferred stack-bound tiers actually run — a red integration/e2e check from CI is **reproduced and fixed here**, never re-pushed in the hope CI flips.

**Autonomous — never prompt the user.** Decide and document everything reversible, flagging it for the reviewer. The only stop is a *critical* decision (irreversible or high-blast-radius **and** not derivable from the ADR / PRD / Specs): return `critical` to the orchestrator, which parks that one ticket and asks. This holds in `concurrency=0` inline mode too, where no agent wraps this skill.

Check three things and act.

**1. New review comments.** `gh pr view <N> --json reviews,comments` plus `gh api` for review threads, **filtered to comments newer than the last `🤖 agile:phase=rework` marker** — that filter is the idempotency. For each new actionable comment: fix, commit, push, reply to the thread.

**2. Failing status checks.** Poll `statusCheckRollup`; on `FAILURE`/`UNSTABLE` run the flake-vs-regression diagnosis before any rerun — never blind-rerun.

- **Read the actual failing assertion, not the job's teardown.** A truncated log (`--log-failed` often shows only the cleanup step) hides the cause. Fetch the full job log — download the run-log archive via the forge API if needed — and grep for the real failure line: the test name, the assertion, the exception. Diagnose from *that*, not from "a check is red".
- **Triage by severity, not volume.** A gate prints warnings and infos around the one error that failed it, often with a "N diagnostics not shown" notice. Re-run restricted to error level and diagnose the failing item, never the noisiest one.
- **A SKIPPED job is a symptom.** A job whose gate failed reports SKIPPED, which reads as "did not run" rather than "broke", so a red PR looks merely incomplete. Walk the dependency chain back to the gate that actually failed.
- **"Pre-existing" / "unrelated" / "environment" / "tooling drift" needs base-branch proof, not a reading of the output.** Run the SAME command on the base branch and compare exit codes, and diff the tool's config/lockfiles between the two: clean on base + non-zero on the branch means the diff caused it. **Filenames in the output being untouched by your diff is not evidence** — a diff can cause a failure reported against files it never edited. No comparison → do not report it as pre-existing.
- **Compare the same check across sibling PRs and recent base runs.** Identical check green on other open PRs from the same base, intermittently red on unrelated base commits → infra flake. Sibling PRs green and only this one red → a **real regression this PR introduced**, even when the failing test is not one you wrote (a schema, contract, or shared-file change routinely breaks another module's test).
- **Reachability beats repeat count.** An identical repeat does not prove a real failure. If the source subtree the test exercises is byte-identical to a base branch where that test is green, the diff cannot be the cause however often it repeats — classify it environmental and look at load/timing (a sibling PR passing the same test on the same tree in the same window is the tell). **Retry a timing-sensitive failure uncontended**, serialised behind the other heavy in-flight jobs; retries during contention reproduce identical failures and read as a real defect.
- Other tells: was the test green on a recent base run? does the PR add a test file collected before the failing one (`<runner> <new-test> <failing-test>` to repro)?
- Real failure → fix and push. Confirmed flake → `gh run rerun --failed`.

**3. Merge conflicts / staleness.** `mergeStateStatus` `DIRTY`/`BEHIND` → refresh the base **without switching to it** (`git fetch origin <base>`), then `git merge --no-ff origin/<base>` on the ticket's branch, resolve, lint-after-rebase, push. (`git merge --continue` rejects `--no-edit` — use `GIT_EDITOR=true`.) Do not `git checkout <base>` first: inside the ticket's worktree that fails outright — the shared checkout already holds the base branch, and git refuses to check one branch out in two worktrees. `git fetch` + `origin/<base>` needs no checkout and is correct in both modes.

**Poll without foreground `sleep`** — one background `until` loop, read the output when it fires:

```bash
until [ "$(gh pr view <N> --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.status!="COMPLETED")]|length')" = "0" ]; do sleep 20; done; gh pr view <N> --json statusCheckRollup,mergeStateStatus,reviewDecision --jq '{merge:.mergeStateStatus,decision:.reviewDecision,checks:[.statusCheckRollup[]|{n:.name,c:.conclusion}]}'
```

Run it with `run_in_background: true`; the completion notification re-invokes you.

**Best-effort within the run:** handle whatever comments, check results, and conflicts exist now. Do not block indefinitely on a human reviewer — once the current state is handled, record status and return; a later re-run picks up new comments via the marker filter.

Fixes that touch code follow `implement-code`'s rules (the ADR is law, every AC tested, suites green before push). Because this phase holds the stack it runs the **full** gate before pushing — lint + unit + integration, and e2e / fresh-DB migration where relevant, including the tiers a concurrent build deferred. A critical decision surfacing during rework is escalated to the orchestrator, never guessed.

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. Never delete prior markers.

```
🤖 <!-- agile:phase=rework --> **rework — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```
