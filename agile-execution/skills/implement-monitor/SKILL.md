---
name: implement-monitor
description: "Sub-skill of agile-10-implement. Monitor a pre-merge PR and rework it: process new review comments, diagnose + fix failing status checks, rebase on conflicts. Idempotent via the 🤖 rework marker. Not user-invoked."
user-invocable: false
---

# implement_monitor

## Host execution

**Claude Code:** retain the agent-dispatch and concurrency behavior defined below. **Codex:** use only the inline behavior stated here.

On Codex this sub-skill runs inline under `agile-10-implement` with `concurrency=0`; never spawn or assume a named agent. Perform its full gate and return its normal receipt to the caller.

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

**Checks still running → return, do not wait.** Under dispatch (`build-monitor`), handle what is actionable now, then return the handoff receipt (`waiting: <run id>`, `resume_at`); the orchestrator watches that run and dispatches a fresh monitor with its result. Read state by run id, not PR head (`gh run view <id> --json status,conclusion,headSha,jobs`).

**Best-effort within the run:** handle whatever comments, check results, and conflicts exist now. Do not block indefinitely on a human reviewer — once the current state is handled, record status and return; a later re-run picks up new comments via the marker filter.

Fixes that touch code follow `implement-code`'s rules (the ADR is law, every AC tested, suites green before push). Because this phase holds the stack it runs the **full** gate before pushing — lint + unit + integration, and e2e / fresh-DB migration where relevant, including the tiers a concurrent build deferred. A critical decision surfacing during rework is escalated to the orchestrator, never guessed.

## Waiting on CI

Background completions wake only the top-level session. A dispatched agent (or a skill inline inside one) ends when its turn ends, so nothing can wake it.

- **Top level:** one Bash `run_in_background: true` wait per run id, with `timeout` above the run's usual duration (not the 600 s foreground cap); keep working until notified. One wake per run: no `sleep` loop, no short wait re-issued on expiry, and read the result in the same call as the next action.

  ```bash
  gh run watch <run-id> --exit-status --interval 30 >/dev/null 2>&1; gh run view <run-id> --json status,conclusion,headSha
  ```
- **Dispatched:** never background a wait, `sleep N; cat <output>`, or loop on another wait's output. Do what does not need the result, then end with a handoff: `waiting: <run id>`, `resume_at: <step>`, and the state later steps need (PR, branch, worktree path, reviewed sha, round, unposted findings). The top level watches the run, then dispatches a **fresh** agent with the handoff and `ci: <run id> <conclusion> <head sha>`; it starts at `resume_at`, trusts earlier steps' markers and receipts, and reads only what remaining steps use. Never resume the paused agent: subagent caches last 5 minutes, so resuming re-writes its whole context.
- **Fallback, no background notifications or no dispatch (e.g. Codex):** one bounded foreground wait, re-issued on timeout. Stay under the 600 s Bash cap (a capped call moves to the background and keeps polling) and the 5-minute cache:

  ```bash
  timeout 270 gh run watch <run-id> --exit-status --interval 30 >/dev/null 2>&1; echo "exit=$?"   # exit=124 → re-issue
  ```

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. Never delete prior markers.

```
🤖 <!-- agile:phase=rework --> **rework — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```
