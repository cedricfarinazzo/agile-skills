---
name: agile-11-merge-train
description: "Process every open PR sequentially: rebase → deep review → fix → fresh CI → merge → Jira postmortem + Done. Block PRs too broken to fix in one pass. Triggers: merge train, process all open prs, /merge-train."
---

# agile_11_merge_train

End-to-end pipeline for clearing the open-PR queue **safely**. Composes existing skills (`merge-review-pr`, `merge-fix-until-satisfied`, `merge-update-pr`, `merge-jira-postmortem`) and adds the multi-PR coordination layer: dependency ordering, conflict detection, Jira state, and a final report.

## Goal & non-goals

**Goal:** every PR that lands on `main` has been deeply reviewed by you, rebased onto the latest tip, re-verified by a fresh CI run, and matched against its Jira ACs. The skill exists to slow down enough to catch problems — not to speed up the queue.

**Non-goals:** mass-merging green PRs without reading them; trusting "CI was green yesterday"; trusting a `MERGEABLE` status to mean "safe to merge."

Speed comes from doing the review carefully once, not from skipping steps. If you find yourself thinking "this PR looks fine, skip the file reads" — stop and read the files.

## Orchestrator = dispatch-and-verify (the main agent does no work itself)

**The main agent orchestrates; it never does a step's work in its own context.** Each per-PR step (3a–3g) runs in a **dedicated `Agent` subagent** that executes the sub-skill and returns **only a size-capped structured receipt** — proof fields, never its full transcript. The orchestrator's loop is: **dispatch the step-subagent → read its receipt → verify the receipt against ground truth (`gh` / Jira) → gate advancement.** A step whose receipt is missing, incomplete, or contradicted by ground truth is **not done** — re-dispatch it; never advance on the subagent's word alone.

This is what stops the shortcuts this skill is prone to — a shallow review, a skipped satisfaction gate, a skipped postmortem. A sub-skill run inline in a long orchestrator context can be skimmed or skipped; a sub-skill run in a fresh subagent whose receipt the orchestrator independently checks cannot. The orchestrator reads no changed files, writes no review, and posts no postmortem itself — it dispatches and verifies.

**Receipt-verification gate — advance only when the receipt proves the work:**

| Step | Receipt proof fields | Independent verification before advancing |
|------|---------------------|-------------------------------------------|
| `3a merge-update-pr` | outcome (Pushed / No-op / Conflict) + run id/sha on no-op | `gh pr view` mergeStateStatus matches the claimed outcome |
| `3b merge-review-pr` | **Files-read list** (= diff set); a **cite per lens**; **per-AC line binding**; verdict | compute `gh pr diff <N> --name-only`; **reject if Files-read ≠ diff set**, reject any AC with no line cite, reject a bare pass |
| `3c merge-fix-until-satisfied` | 5-gate breakdown + **named CI run id** | `gh pr view --json statusCheckRollup` shows that run id green |
| `3e CI monitor` | named completed all-green run id on the post-push tip | independent `gh` read of that run |
| `3f merge` | `mergedAt` set | `gh pr view --json state,mergedAt` == MERGED |
| `3g merge-jira-postmortem` | **posted comment id + resulting status category** | `getJiraIssue` confirms done-category; **a merged PR whose ticket ≠ Done re-dispatches 3g** |

**Concurrency:** the train stays **strictly sequential** regardless of how the PRs were built (each merge moves `main`; the next PR rebases). Build-side `concurrency` never makes the train parallel.

## Configuration

Reads from the consumer repo's `CLAUDE.md` / `AGENTS.md`:

- **`cloudId`** — Atlassian cloud id for `mcp__atlassian__*` calls. Required.
- **`ticket-prefix-regex`** — for inferring ticket key from PR title / branch name. Defaults to `[A-Z]+-\d+`.
- **Lint commands** per touched path family — see `merge-update-pr` for the lint-after-rebase gate.

## Input

Optional repo name (default: current repo). Optional max PRs (default: all).

## Phase 0 — Gather

1. `gh pr list --state open --json number,title,headRefName,baseRefName,mergeable,mergeStateStatus,isDraft,statusCheckRollup,labels --limit 50`
2. For every open PR:
   - Pull Jira key from PR title (e.g. `[ABC-123]`) or branch (`feature/ABC-123`).
   - `mcp__atlassian__getJiraIssue` with the configured `cloudId` — load **summary, description, ACs, status**. Read the full ticket *before* reviewing the diff. The ticket is the spec; the diff is the candidate implementation.
   - **Note the `integration-deferred` label.** A PR built concurrently (by `agile-10-implement` `concurrency>1`) carries this label: integration + e2e were **not run locally at build**, so **CI is their sole gate**. For such a PR, `merge-fix-until-satisfied` (3c) runs only the stack-free tiers locally and the fresh-CI-green hard gate (3e) is what validates integration + e2e. An unlabelled PR was built with the full local gate — treat it as today.
3. `gh pr diff <N>` for every PR. Build a `{file → [PRs that touch it]}` map.

## Phase 1 — Detect cross-PR conflicts

For each file touched by more than one PR:
- If both PRs only **append** to the same file (e.g. both add a row to a shared docs table), the merge order must guarantee the second one rebases cleanly. Flag for `merge-update-pr` reuse.
- If both PRs **modify the same lines** (e.g. both rewrite the same function signature), this is a real conflict. Sequence the smaller / less risky PR first so the second one can rebase.
- Record the conflict map in the final report.

## Phase 2 — Determine merge order

Rank PRs by:
1. **CI status first.** Already-green PRs go ahead of failing ones. Failing PRs may be fixable but green PRs are zero-risk wins.
2. **Foundational PRs first.** Docs-only / PR-template / `CLAUDE.md` changes ship before feature PRs so feature PRs rebase onto the new conventions.
3. **Independent before conflict-prone.** PRs that touch only their own new files merge first; PRs that overlap with many others go last.
4. **Smaller diffs before larger.** Cheap merges open up review bandwidth.

State the order and the rationale before processing.

## Phase 3 — Process each PR sequentially

**Per-PR mandatory sequence — do not skip, do not stop mid-sequence, do not wait for user confirmation between steps.** A user typing `/agile-11-merge-train` (or "merge train", "process all open PRs") has authorised the full sequence below for every PR in the queue. Stop only on the explicit stop conditions at the bottom of this file.

```
3a  merge-update-pr           (subagent)  rebase (push only if merge commit created)
3b  merge-review-pr           (subagent)  deep review — verify Files-read = diff set, cite per lens + AC
3c  merge-fix-until-satisfied (subagent)  ALWAYS — even on 0-issue review (satisfaction gate); verify named run id green
3d  bad-PR escape hatch     (CONDITIONAL — only if 3b/3c surface an unfixable defect; replaces 3e–3g)
3e  CI monitor              HARD GATE, separate turn from the 3a/3c push. Wait for a NEW run to START, then COMPLETED + SUCCESS on the post-push tip. Never push and merge in the same turn.
3f  gh pr merge             --squash --delete-branch (only after 3e names a completed all-green run)
3g  merge-jira-postmortem     (subagent)  comment + transition; verify comment id + done-category
```
Each `(subagent)` step is dispatched to a dedicated `Agent` (which runs the sub-skill via the Skill tool) and its receipt is verified before advancing — the orchestrator never runs the sub-skill's work in its own context.

3d is an exit path, not a step in the linear flow: if 3b or 3c determines the PR cannot be salvaged, jump to 3d and skip 3e/3f/3g (3d still posts a postmortem in `blocked` mode, but does NOT transition the ticket).

After 3g, immediately loop to the next PR's 3a. Never stop after 3b just because review passed — passing review means proceed to 3e. Never skip 3g — even on a flawless PR, the postmortem comment + Done transition are required.

For each PR in merge order:

### 3a. Always rebase on latest main
- **Invoke `merge-update-pr` via the Skill tool.** Do not run the rebase commands inline — the sub-skill handles main pull + checkout + merge + conflict resolution + lint-after-rebase + push as one unit. Train relies on this — do not duplicate the gate inline.
- The `merge-update-pr` skill will: `git checkout main && git pull`, `gh pr checkout <N>`, `git merge --no-ff main`, resolve conflicts, lint-after-rebase, push (only if new merge commit created). The merge commit triggers a fresh CI run on the exact tree that will land.
- The sub-skill returns one of three outcomes (act accordingly in 3e):
  - **Pushed merge commit** → 3e waits for the fresh CI run
  - **No-op (already up to date)** → check the existing CI run conclusion on branch HEAD *before* proceeding to 3b. If `SUCCESS` + `mergeStateStatus: CLEAN` → 3e references it, no new run needed. If `FAILURE` / `UNSTABLE` / any non-SUCCESS conclusion → **do not assume green**; jump straight to 3c (`merge-fix-until-satisfied`) so the fix loop investigates the failing checks, fixes them, pushes, and re-enters 3e on the fresh run. A no-op rebase with red CI means the existing tree is broken — proceeding to merge would land broken code.
  - **Conflict still open** → halt this PR; do not proceed to 3b
- **`git merge --continue` does not accept `--no-edit`** — use `GIT_EDITOR=true git merge --continue` to skip the editor.

### 3b. Deep review — this is the main work
- **Dispatch `merge-review-pr` to a dedicated subagent** (which invokes the sub-skill via the Skill tool) — not its semantics inline. The sub-skill exists; use it. Running the review in a fresh subagent whose receipt the orchestrator checks is exactly what prevents the soft/shallow review this step is prone to. The merge-train layer is for ordering, Jira state, and **verifying the review receipt** — the file-by-file review work belongs to `merge-review-pr`. If `merge-review-pr` is missing something this train needs, edit *that* skill rather than re-implementing review logic here.
- **Verify the review receipt before advancing:** the returned verdict must carry a **Files-read list equal to the PR diff file set** (`gh pr diff <N> --name-only`), a **`file:line` cite per lens**, and a **`file:line` per AC**. A bare pass, a Files-read list short of the diff, or an AC with no line cite = a partial review → re-dispatch. The orchestrator does not read the files itself; it checks that the subagent did.
- **Read every changed file in full** (not just the diff hunks). The diff hides context; the file shows whether the change makes sense in its surroundings.
- For each changed file ask: does this file still make sense as a whole after the change? Are imports unused? Does naming match neighbours? Are there dead branches or copy-paste leftovers?
- Cross-check against Jira ACs loaded in Phase 0, one by one. For each AC: locate the code that satisfies it. If you can't point to a line, the AC is not satisfied.
- Check against `CLAUDE.md` (root + relevant subfolder) conventions and architecture invariants — naming, async patterns, federation rules, scoping, no cross-service imports, etc.
- Check tests: do the new tests actually exercise the new code paths, or are they smoke tests? Are negative paths covered? Are mocks reasonable?
- Check security boundaries: input validation, auth checks, no secret leakage, no SQL injection via string interpolation.
- Compare delivered ACs against ticket ACs. **Any missing or wrong AC goes in the postmortem and must be reconciled before merge** — either fix the code or explicitly accept the deviation with rationale.
- Be explicit about satisfaction. If you can't write "I read every changed file in full and verified each AC against specific lines" — go back and do it. Do not merge on partial review.

### 3c. Fix until satisfied — ALWAYS invoke, even on clean review
- **Always dispatch `merge-fix-until-satisfied` (to a subagent, which invokes the sub-skill via the Skill tool), even when 3b reported 0 issues.** The sub-skill is the explicit satisfaction gate: it re-examines the changed files, verifies fixes did not introduce new issues, runs the tests, and returns the "Satisfied. No remaining issues." verdict (with a named CI run id) that authorises 3e. A 0-issue review without a Satisfied verdict is incomplete. **Verify the receipt:** the named run id must be green (`gh pr view --json statusCheckRollup`).
- **The `integration-deferred` label (Phase 0) confirms where integration lives.** `merge-fix-until-satisfied` runs lint locally and relies on the **fresh CI-green run** (its named run id, gated at 3e) for the test tiers — the same model for every PR. The label just makes explicit that for a concurrent build the integration + e2e tiers were never run at build time, so **3e's fresh-CI-green hard gate is their definitive gate** — it is required before merge regardless, and doubly load-bearing here. Do not treat a missing local integration run on an `integration-deferred` PR as a defect; that is by design.
- **Every issue from 3b's report must be fixed — Critical AND Minor.** "Minor" is a severity classification, not a permission to defer. The fix loop must address every numbered finding from the review report before declaring Satisfied. The only acceptable skip is an out-of-scope finding that would expand the PR diff into untouched files — in which case file a follow-up ticket inline and reference it in the postmortem.
- If 3b found issues: the sub-skill fixes them (Critical first, then Minor), commits, pushes, re-verifies.
- If 3b found no issues: the sub-skill confirms the verdict by re-running its local gate (lint + a final re-examination) and reading the fresh CI-green run. Phase 2 (Commit & push) is a no-op when nothing changed.
- **The satisfaction gate must be green before merge:** lint clean locally + the named CI run all-green (the test tiers' gate). Don't push and merge hoping CI flips.
- Re-review the changed files in full after the fix — fixes can introduce new issues.

### 3d. Bad-PR escape hatch
If the PR is too broken to fix in one pass — wrong approach, missing core ACs, would require reworking from scratch — **stop**. Do NOT merge.
- Post the Jira postmortem anyway, marking the PR as **blocked** and listing what's missing.
- Leave the PR open with a comment summarising the block reason.
- Do NOT transition the ticket. Move on to the next PR in the queue.

### 3e. Wait for **fresh** CI green
- **This step is a HARD GATE and must be its own turn, after the turn that pushed (3a or 3c). Never issue a push and the `gh pr merge` in the same turn — a merge in the same batch as the push runs before CI has even registered, so it cannot have read a green result.**
- After 3a's push, CI registers a new run. Verify checks are running against the post-rebase tip.
- **Two conditions, both required, before 3f: (1) a NEW run has STARTED on the post-push tip — "no new run yet" is not green, it's not-yet-started; (2) every check on that new run is COMPLETED + SUCCESS.** A green read milliseconds after a push is the PREVIOUS run. Capture the latest run id BEFORE pushing (`gh run list --branch <branch> -L1 --json databaseId`); after pushing, poll until a DIFFERENT id appears, then poll that id to all-green.
- Poll pattern (Bash `run_in_background: true` with `until` loop):
  ```bash
  until [ "$(gh pr view <N> --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.status!="COMPLETED")]|length')" = "0" ]; do sleep 20; done; gh pr view <N> --json statusCheckRollup,mergeStateStatus --jq '{merge:.mergeStateStatus,checks:[.statusCheckRollup[]|{name:.name,c:.conclusion}]}'
  ```
  Background completion fires a notification — read the output file and continue. Do NOT chain `sleep` calls in the foreground; do NOT poll in a foreground loop.
- Stale-run risk: a poll immediately after `git push` can read the *previous* run as `COMPLETED + SUCCESS`. Mitigations (use one):
  1. Capture run id with `gh run list --branch <branch> --limit 1 --json databaseId` *before* push, then in the poll loop wait until a *different* id appears.
  2. Capture push time, then check `started_at` on the latest run is after push time.
  3. Trust the `until status!="COMPLETED"` loop: when GitHub registers the new run it flips a check from COMPLETED back to IN_PROGRESS, naturally re-blocking the loop. Works in practice; (1) is the most reliable.
- For the **no-op** outcome from 3a: no new run will start. Skip the wait loop entirely and read the existing run on branch `HEAD` once. Verify the run still covers the landable tree with `git merge-base --is-ancestor main <existing-run-sha>`:
  - Exit 0 (branch HEAD ⊇ main) → existing CI is valid, proceed to 3f
  - Exit 1 (branch HEAD lacks main commits) → contradicts the no-op signal from 3a; investigate before proceeding, do not force an empty commit blindly
- Verify all conclusions are `SUCCESS` and `mergeStateStatus: CLEAN` before merging. `UNSTABLE` is not green — an in-progress check is still pending.
- **Flake-vs-regression diagnosis (before rerunning).** When CI fails on a test that is NOT in the PR diff, the instinct is "flake — rerun." This is wrong as often as it is right. Before `gh run rerun --failed`, do a 60-second diagnosis:
  1. **Was the same test green on a recent main run?** If yes, the test is healthy on main right now — failure is likely PR-introduced contamination, not a flake. If no, it's a pre-existing breakage and a rerun won't help.
  2. **Does the PR add new test files that the test runner collects before the failing file?** Order-dependent contamination (`sys.modules` pollution, env var leaks, module-level state) is invisible in single-file local runs but lethal in full-suite CI runs. Run locally: `<runner> <PR's new test file> <failing test file>` — repro = real bug, not flake.
  3. Only after both checks pass should you call it a flake and rerun. If the rerun fails identically, it was never a flake — investigate root cause as a Critical PR issue.
- **A setup/build-stage failure is a different class from a test failure — diagnose by WHERE it failed, not just what failed.** The diagnosis above assumes a *test* ran and failed. When the job dies *before any test executes* — image build, dependency install, or stack bring-up (registry/network `connection reset` / `timeout` / `TLS`, an OOM-killed build, a disk-full runner) — there is no test to check against main, and it is almost always transient infra, not the PR's code. Read the failing step's name: a failure in "build" / "install" / "start stack" with no test output is a rerun candidate; a failure in the test step is what the flake-vs-regression diagnosis above is for. Don't apply test-centric diagnosis to a build-stage failure, and don't treat a build-stage blip as a code defect.
- **A `CANCELLED` job is not automatically preemption.** A hung test that exhausts the job's wall-clock, or a canceling concurrency group, also reports `CANCELLED` — often with the downstream jobs `SKIPPED`. Before reflexively rerunning, read the job log for `timeout` / `exceeded` / `waiting for`: a hung test reproduces on every rerun, so diagnose and fix it rather than burning rerun cycles.

### 3f. Merge
- `gh pr merge <N> --squash --delete-branch`
- Confirm `mergedAt` is set.

### 3g. Postmortem + Jira state
- **Dispatch `merge-jira-postmortem` to a subagent** (which invokes the sub-skill via the Skill tool) — mandatory, even when 0 issues found. It posts the structured review-findings comment AND handles the Done transition. Do not duplicate that work inline; do not skip on the grounds that the PR was clean.
- **Verify the postmortem receipt before counting the PR done:** the sub-skill returns the **posted comment id** + the **resulting status category**. Confirm with `getJiraIssue` that the ticket is now in a `done`-category status. This is the fix for the most-skipped step: 3g is last in the loop, so nothing downstream used to notice it was skipped — now Phase 5 refuses to report a PR as Merged+Done without a verified postmortem receipt, and **re-dispatches 3g** for any merged PR whose ticket is not Done.
- Pass the cross-PR conflict info from Phase 1 to the postmortem: if this PR collided with another on shared files, the postmortem must note "ticket should have been linked in Jira to <other>" — a missing `relates to` / `blocks` link is what let the overlap reach merge time.
- If a follow-up Jira ticket is warranted (e.g. discovered bug class, refactor opportunity), note it in the report — but don't auto-create.

## Phase 4 — Auto-link colliding tickets in Jira

After all PRs processed, before producing the final report:

For every pair of tickets whose PRs collided on a shared file (recorded in the Phase 1 conflict map), create a `Relates` link via `mcp__atlassian__createIssueLink`:

```
mcp__atlassian__createIssueLink(
  cloudId="<configured>",
  inwardIssue="ABC-1", outwardIssue="ABC-2", type="Relates"
)
```

Skip pairs whose tickets had no file collision — postmortem recommendations alone are not enough; the train executes the link creation. Tickets recorded as colliding but already linked in Jira from prior work: the API returns success on duplicate — safe to call.

**After each successful link, append a one-line confirmation comment to the most recent postmortem on each side** so reviewers reading the postmortem later see the link was actually applied, not just recommended:

```
mcp__atlassian__addCommentToJiraIssue(
  cloudId="<configured>",
  issueIdOrKey="ABC-1",
  contentFormat="markdown",
  commentBody="Jira link created: relates to ABC-2 (Phase 4, merge-train run <YYYY-MM-DD>)."
)
# repeat for ABC-2
```

If `createIssueLink` failed (API error, ticket gone), append the failure reason in the same one-liner format — never leave the recommendation untracked.

## Phase 5 — Reconcile + final report

**Before reporting, reconcile every merged PR against ground truth — do not report from memory.** For each PR marked Merged this run, confirm via `gh pr view --json state,mergedAt` that it actually merged, and via `getJiraIssue` that its ticket reached a `done`-category status with a verified `merge-jira-postmortem` receipt (comment id recorded). **A merged PR whose ticket is not Done, or whose postmortem receipt is missing, is a skipped 3g — re-dispatch `merge-jira-postmortem` now**, before the report. This closes the shortcut where the postmortem (last in the per-PR loop) was silently dropped: it now has a consumer that fails without it.

Then produce a single Markdown report covering:

### Summary
- N PRs processed / M merged / K blocked
- Total runtime
- Total tests passing on `main` after all merges

### Per-PR outcome (table)

| PR | Ticket | Outcome | Notes |
|----|--------|---------|-------|
| #33 | ABC-33 | Merged | clean |
| #34 | ABC-35 | Merged | required cleanup fix |
| #36 | ABC-34 | Blocked | wrong approach — see postmortem |

### Conflict map (Phase 1)
- File X: touched by PR A + PR B → resolved in B by rebasing onto A
- ...

### Remaining work
- PRs still open and why
- Tickets *not* moved to Done and why
- **Follow-up tickets that should be filed (CRITICAL only).** This section is a triage list, not a wish list. Only include items that meet at least one of:
  - Discovered defect that could cause runtime error, data corruption, security issue, or autogenerate drift in production
  - Architecture invariant violation (from the consumer repo's `CLAUDE.md`) that landed because the train couldn't fix it without expanding the merged PR's scope
  - Latent bug class confirmed during the train (e.g. `sys.modules` substring match contaminating other tests) — file once so the convention can be codified
  - Test/CI infrastructure failure that blocked or nearly blocked the train (not "flaky test passed on retry" — those don't get a ticket)

  Do NOT file follow-ups for: style nits, "we could refactor X someday", "wouldn't it be nice if", subjective preferences, or anything you'd hesitate to bring up in a 1:1. If it's not Critical-grade work, leave it out — Jira backlog noise costs sprint planning time.
- Any flaky tests observed (and whether they passed on retry) — informational only, do not file a ticket unless the same flake recurs across multiple trains

### Lessons / new conventions discovered
- E.g. "cleanup fixtures must exclude `alembic_version` — codified in test-suite `CLAUDE.md`"

## Rules

- **Deep review is the whole point, and it is receipt-verified.** This skill exists to make sure `main` only receives code that was actually read, file by file, against the spec. The review runs in a subagent and its receipt (Files-read = diff set, cite per lens, `file:line` per AC) is checked by the orchestrator — a review whose Files-read list is short of the diff, or whose ACs lack line cites, is a partial review and is re-dispatched. A fast merge train that skips file reads is worse than no merge train.
- **Always rebase before review.** Every PR gets a `merge --no-ff main` before review and merge. The CI run that gates the merge must be on the exact tree that will land. A "green CI from yesterday" is not a green CI.
- **Wait for the fresh CI run.** After push, use one of the stale-run mitigations in 3e (preferred: capture run id before push, wait until a different id appears). Do NOT chain `sleep` calls in the foreground — use a single `until` loop in `run_in_background: true`.
- **The push and the merge are never in the same turn.** The push (3a/3c) and `gh pr merge` (3f) are separate turns with the 3e gate between them. Issuing both in one batch means the merge fires before CI registers — the squash then captures whatever the branch tip is, green or not.
- **`gh pr merge` requires a named completed all-green run id on the post-push tip.** If you cannot state the run id you verified, you may not merge. `mergeStateStatus: CLEAN` / `mergeable: MERGEABLE` is NOT a CI signal — read `statusCheckRollup` conclusions yourself. A repo without required-status-check branch protection will merge red without complaint; the gate is yours, not the host's.
- **Never merge without explicit satisfaction.** All ACs validated against specific lines, all tests green locally + on the fresh CI run, branch rebased on the current `main`. Any of those missing → fix or block.
- **Read the Jira ticket before reading the diff.** Otherwise the review measures the diff against itself, not the spec.
- **Read every changed file in full** during 3b. The diff hides surroundings; bugs hide in surroundings.
- **Process sequentially, not in parallel — regardless of how the PRs were built.** Each merge changes `main`; the next PR must rebase on the new tip and re-run CI. Build-side `concurrency>1` never makes the train parallel.
- **Postmortem is mandatory** on both merge and block. Include the "What was correct" section even when blocking — acknowledge what was right before listing what was wrong.
- **Transition Jira to Done only on merge.** Blocked PRs leave the ticket in its current state.
- **Reuse, don't duplicate — dispatch each sub-skill to a subagent and verify its receipt, never perform its semantics inline.** Run `merge-review-pr`, `merge-fix-until-satisfied`, `merge-update-pr`, `merge-jira-postmortem` as dedicated subagents (each invoking the sub-skill via the Skill tool) during 3a/3b/3c/3g; verify the returned receipt against ground truth before advancing. The orchestrator reads no changed files, writes no review, and posts no postmortem itself. If one of those needs improvement to handle a case you hit, edit *that* skill — don't fork its logic here.
- **Cross-PR conflict = missing Jira link.** Any time two PRs collide on a shared file during the train, that signals the two tickets should have been linked in Jira (`relates to` / `blocks` / `is blocked by`). The postmortem on the second PR must call this out so the link can be added retroactively and so sprint planning catches the next overlap earlier.
- **No destructive git ops without confirmation.** Force-push only with `--force-with-lease`. Never `git reset --hard` on a shared branch without saying so first.
- **Don't stop on "satisfied".** A clean review (0 issues) means proceed through 3c → 3e (CI monitor) → 3f (merge) → 3g (postmortem). Do NOT end the turn after 3b just because the review passed. The next user-visible message should be the final report (Phase 5), not "do you want me to merge?".
- **`merge-fix-until-satisfied` is mandatory even on clean reviews.** It is the satisfaction gate, not a fix-only loop. Skipping it because "nothing to fix" leaves the merge unauthorised.
- **No mid-train confirmation prompts.** The user authorised the full per-PR sequence by invoking the train. Do not ask "should I merge?", "should I post the postmortem?", "should I link the tickets?" — execute. The stop conditions below are the only authorised stops.
- **Cross-PR conflict → mandatory Jira link.** Postmortem recommendation alone is not sufficient: Phase 4 must actually create the `Relates` link via `mcp__atlassian__createIssueLink`, then append a confirmation one-liner to each side's postmortem.
- **Train output prose stays in normal English.** Report sections, postmortem bodies, and Jira comments are permanent artifacts read by humans during retro.

## Stop conditions

Stop the train and report immediately if:
- A merge silently fails (PR shows merged=false after `gh pr merge`)
- Two consecutive PRs hit unrelated CI flakes (suggests infra problem)
- A Jira ticket can't be loaded (auth, deleted, wrong project) — block and report
- The fix loop in 3c iterates more than 3 times on the same PR without converging
- The post-push CI run is FAILURE, or has not started — never merge on red or absent CI
- **Tooling output looks corrupted or garbled, or a file read returns content that contradicts a prior read or the spec.** Do not edit, merge, push, or post on an unverified read. Re-establish ground truth first — re-read via a fresh copy, `gh api`, or `git show` — before any write. A confident action on a bad read is how broken code reaches `main`.
