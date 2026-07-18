---
name: implement-pr
description: "Sub-skill of agile-10-implement. Open (off base/main) or update the PR for the ticket's pushed branch, linked to the Jira Story, with AC coverage + ADR-compliance sections. This skill — not implement-code — owns opening the PR. Posts the 🤖 pr marker. Not user-invoked."
user-invocable: false
---

# implement_pr

PR phase for `agile-10-implement`. Invoked via the Skill tool after `implement-code` has pushed the branch. **This skill owns opening the PR** — `implement-code` never opens it. Opens the PR **off `<base-branch>` (the main branch)**. Idempotent — updates an existing open PR rather than opening a duplicate. Posts the `🤖 agile:phase=pr` marker with the PR URL.

## Source the PR body

The build is already done (`implement-code` implemented the plan + pushed). This phase only describes it. Build the body from **the actual pushed diff** (`gh pr diff` / `git diff <base>...HEAD`) plus the ticket's `🤖 agile:phase=plan` and `agile:phase=implement` comments: the plan's AC→test map → **AC coverage** + **Testing**; the diff's files → **Changes**; the plan's flagged decisions + the `implement` comment's noted deviations → **ADR compliance**. Where the diff diverges from the plan, surface it in the body — don't paper over it.

## Open or update

- `findExistingPR`: `gh pr list --state open --head <branch> --json number,url`.
  - found → `gh pr edit` (refresh title/body)
  - none → `gh pr create --base <base-branch>` (off the base/main branch)
- **Title:** `[TICKET] <Story summary>`
- **Body sections** (built from the plan + the actual diff):
  - **Story** — link to the Jira ticket
  - **What this PR does** — 2–3 sentences, from the plan's intent
  - **AC coverage** — each AC → the test / verification that covers it (the plan's AC→test map, confirmed against the committed tests)
  - **Changes** — files/modules touched and why (the plan's files-to-touch list, reconciled with the real diff; flag any addition/omission vs the plan)
  - **Testing** — unit / integration / manual; edge cases covered (per the plan's AC→test map)
  - **Test tiers** — read the `implement` marker's `Mode` + gate receipt. **Sequential:** `Verified locally: lint + unit + integration + fresh-DB migration.` **Concurrent:** `Verified locally: lint + unit + typecheck (stack-free, worktree). Deferred to CI: integration + e2e + fresh-DB migration (concurrent build — not run locally; CI is the gate).` This section tells the merge train and reviewers exactly which tiers CI must confirm.
  - **Specs UI match** — states implemented; any deviation + reason (UI Stories)
  - **ADR compliance** — new decisions / libraries introduced (the plan's flagged decisions), each flagged for the reviewer
  - **Checklist** — ACs tested · lint/type clean · no regressions · PR linked to Jira · Specs UI match · ADR compliance · test tiers stated (integ/e2e local or CI-deferred)

**Label a concurrent build.** When the `implement` marker's mode is `concurrent`, add the `integration-deferred` label (`gh pr edit <N> --add-label integration-deferred`; create the label once if the repo lacks it). This is the machine-readable signal `agile-11-merge-train` reads to know integration + e2e were not run locally and CI is their sole gate. Sequential PRs carry no such label.

Post `🤖 agile:phase=pr` with the PR URL (and, for a concurrent build, note the `integration-deferred` label in the marker). Return the PR number/URL to the orchestrator.

> This phase does **not** transition the Story — the orchestrator transitions to `In Review` only after `implement-review` approves. Never transition to `Done`.

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=pr --> **pr — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=pr -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
