---
name: implement-pr
description: "Sub-skill of agile-10-implement. Open (off base/main) or update the PR for the ticket's pushed branch, linked to the Jira Story, with AC coverage + ADR-compliance sections. This skill — not implement-code — owns opening the PR. Posts the 🤖 pr marker. Not user-invoked."
user-invocable: false
---

# implement_pr

PR phase for `agile-10-implement`, invoked after `implement-code` pushed the branch. **This skill owns opening the PR**, off `<base-branch>`. Idempotent — it updates an existing open PR rather than opening a duplicate.

**Autonomous — never prompt the user.** Decide and document everything reversible, flagging it for the reviewer. The only stop is a *critical* decision (irreversible or high-blast-radius **and** not derivable from the ADR / PRD / Specs): return `critical` to the orchestrator, which parks that one ticket and asks. This holds in `concurrency=0` inline mode too, where no agent wraps this skill.

## Source the body from the real diff

The build is already done; this phase only describes it. Build the body from **the actual pushed diff** (`gh pr diff` / `git diff <base>...HEAD`) plus the ticket's `🤖 agile:phase=plan` and `🤖 agile:phase=implement` comments: the plan's AC→test map → **AC coverage** and **Testing**; the diff's files → **Changes**; the plan's flagged decisions and the `implement` comment's noted deviations → **ADR compliance**. Where the diff diverges from the plan, say so in the body — do not paper over it.

## Open or update

`gh pr list --state open --head <branch> --json number,url` → found: `gh pr edit` (refresh title/body); none: `gh pr create --base <base-branch>`.

**Title:** `[TICKET] <Story summary>`

**Body sections:**
- **Story** — link to the Jira ticket.
- **What this PR does** — 2–3 sentences from the plan's intent.
- **AC coverage** — each AC → the test that covers it, confirmed against the committed tests.
- **Changes** — files/modules touched and why, reconciled with the real diff; flag any addition or omission versus the plan.
- **Testing** — unit / integration / manual, and the edge cases covered.
- **Test tiers** — read the `agile:phase=implement` marker's `Mode` + gate receipt. Sequential: `Verified locally: lint + unit + integration + fresh-DB migration.` Concurrent: `Verified locally: lint + unit + typecheck (stack-free, worktree). Deferred to CI: integration + e2e + fresh-DB migration (concurrent build — CI is the gate).` This tells the merge train exactly which tiers CI must confirm.
- **Specs UI match** — states implemented, plus any deviation and its reason (UI Stories).
- **ADR compliance** — new decisions or libraries introduced, each flagged for the reviewer.
- **Checklist** — ACs tested · lint/type clean · no regressions · linked to Jira · Specs UI match · ADR compliance · test tiers stated.

**Label a concurrent build** — when the `implement` marker's mode is `concurrent`, `gh pr edit <N> --add-label integration-deferred` (create the label once if the repo lacks it). That label is the machine-readable signal `agile-11-merge-train` reads to know integration + e2e were not run locally. Sequential PRs carry no label.

Post `🤖 agile:phase=pr` with the PR URL (noting the label on a concurrent build) and return the PR number.

This phase does **not** transition the Story — the orchestrator transitions to `In Review` only after `implement-review` approves, and never to `Done`.

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. Never delete prior markers.

```
🤖 <!-- agile:phase=pr --> **pr — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```
