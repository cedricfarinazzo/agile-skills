---
name: merge-jira-postmortem
description: "Post structured post-merge comment to Jira ticket + transition to Done (skip transition in blocked mode). Mandatory even on 0-issue PRs. Triggers: jira postmortem, comment jira, /jira-postmortem."
---

# merge-jira-postmortem

Post a structured post-merge review findings comment to a Jira ticket. Synthesises from the current session's review and fix work. If the PR merged successfully, also transition the ticket to **Done**. If the PR was blocked (too broken to merge), post the postmortem in block mode and leave the ticket state untouched.

**Mandatory even on clean PRs.** A 0-issue PR still gets a postmortem comment + Done transition. The "What was correct" section becomes the whole body. Skipping the skill because "nothing went wrong" leaves the ticket in its in-review column and breaks the merge-train contract.

## Input

Jira ticket key from args (e.g. `ABC-123`). Optional mode: `merged` (default) or `blocked`. If key not given, infer from current branch name (e.g. `feature/ABC-123`).

**`conflict_map` entry** — when invoked by `agile-11-merge-train` 3g, the caller passes this PR's entry from the Phase 1 conflict map verbatim:

```
conflict_map entry:
  pr: <N>  ticket: <KEY>
  collisions:
    - file: <path>   with_pr: <other PR>   with_ticket: <other KEY>   kind: append | same-lines
```

`collisions: []` is a real value — it means "checked, none", not "not supplied". Every collision in the entry becomes a bullet in the comment's Cross-PR section and an entry in the `collisions recorded` receipt field. Never invent a collision the caller did not pass, and never silently drop one it did.

## Configuration

This skill reads two values from the consumer repo's `CLAUDE.md` / `AGENTS.md` or environment:

- **`cloudId`** — Atlassian cloud id for all `mcp__atlassian__*` calls (e.g. `yourorg.atlassian.net`). No default; required.
- **`ticket-prefix-regex`** — used to infer the key from branch name. Defaults to `[A-Z]+-\d+`.

## Steps

1. From session context, identify:
   - Every issue found during review (bugs, wrong patterns, missing docs, stale ACs, etc.)
   - Every fix applied and why
   - What was already correct in the PR
   - AC-by-AC verification: which ACs are satisfied, which are not, why
   - **Conscious accepts** — every deliberate deviation from the ticket's DoD wording, most commonly a standing repo convention that conflicts with what the DoD literally asks. Record what the DoD asks, what was done instead, why the convention wins, where the equivalent-strength coverage actually lives, and that it was a deliberate decision rather than an oversight. Unlabelled, it reads later as a missed DoD item; labelled, the merge/QA reader signs off on it knowingly.
   - **Cross-PR conflicts — from the caller's `conflict_map` entry, not from recollection.** Each collision means the two tickets should have been **linked in Jira** (`relates to` / `blocks` / `is blocked by`) so the dependency was visible at sprint planning. Write one bullet per collision naming the file, the other PR, and the other ticket key, and recommend the missing link. When invoked standalone with no entry supplied, derive the collisions yourself and say so.

2. Post comment to Jira via `mcp__atlassian__addCommentToJiraIssue` with the configured `cloudId`, `contentFormat: markdown`. **Capture the returned comment id** — it is the proof the comment was posted.

3. If mode is `merged` (default): transition ticket to Done.
   - Call `mcp__atlassian__getTransitionsForJiraIssue`, find the transition whose target status category is `done` / colorName `green`, and call `mcp__atlassian__transitionJiraIssue` with that id.
   - **Optional fast path** — if the consumer repo's `CLAUDE.md` declares a known stable transition id for this project (e.g. `done-transition-id: 31`), call it directly and skip the lookup round-trip. Fall back to the lookup path on failure.
   - **Then read back the resulting status** (`getJiraIssue`) and capture its **status category** — confirm it is `done`. A transition call that returned without the ticket actually landing in a done-category status is not complete.

4. If mode is `blocked`: do NOT transition. The PR stays open with a block comment on GitHub and the ticket stays in its current column.

5. **Return the receipt.** The caller (`agile-11-merge-train` 3g) verifies this before counting the PR done, and Phase 5 re-dispatches this skill for any merged PR whose ticket is not in a done-category status. Return:
   ```
   Postmortem receipt:
     mode: merged | blocked
     comment id: <id from step 2>
     status: <current status name> (category: <done | in-progress | ...>)
     collisions recorded: <KEY>@<file>, <KEY>@<file>   |   none
   ```
   For `merged` mode the receipt must show a `done` category; for `blocked` mode the status is left unchanged by design (no transition), and the receipt says so. `collisions recorded` echoes exactly what you wrote into the comment — the caller checks it against the `conflict_map` entry it passed, and re-dispatches this skill if a collision went missing.

## Comment structure

```markdown
## Post-merge review findings — what was wrong

<TOTAL> issue(s) found during PR review, <FIXED> fixed before merge.

---

### <IDX>. <Severity>: <short title>

**Root cause:** <explain the bug/issue precisely>

<if critical: explain what would have broken and when>

**Fix:** <what was changed>

**Lesson:** <the generalizable rule — what to remember for future PRs>

---

### What was correct

- <bullet: thing that was done right>
- <bullet: another correct pattern>

### Conscious accepts (if any)

- **DoD asks:** <the DoD wording> — **done instead:** <what shipped> — **why:** <the standing convention that wins, and where it is documented> — **equivalent coverage:** `<file:line>`. Deliberate decision, not an oversight.

### Cross-PR conflicts (if any)

- Conflicted with **#<other PR>** (<TICKET-KEY>) on `<file>`. The two tickets should be linked in Jira (`<link type>`) — missing link meant the overlap was only discovered at merge time.
```

## Block-mode comment structure

When invoked with mode `blocked`, head the comment with a clear block notice and skip the "transition to Done" step.

```markdown
## PR blocked — not merged

**Reason:** <one-line summary of why this PR cannot be merged as-is>

### Missing / wrong
- AC<N>: <what the ticket requires> — <what the PR delivered or didn't>
- ...

### What was correct
- <bullet>

### Path forward
- <what needs to change for unblock — concrete, file-level if possible>
```

## Severity labels

- **Critical** — would cause a runtime error, data corruption, test failure, security issue, or autogenerate drift
- **Minor** — misleading docs, wrong port in docstring, missing run command, stale AC description

## Rules

- Every issue gets its own numbered section with root cause + fix + lesson
- "What was correct" section is always present — acknowledge good work
- Lesson must be generalizable (not "fix this specific file" but "always use X pattern when Y")
- Be specific: file names, line numbers, function names where relevant
- Never omit the "What was correct" section even if there were many issues
- **Always run, even on 0-issue PRs.** Open with "0 issues found during PR review." then go straight to "What was correct" + cross-PR conflicts (if any). The transition to Done is mandatory regardless of issue count.
- **Return the postmortem receipt** (comment id + read-back status category). This is the proof the orchestrator gates on — it is why a skipped postmortem no longer goes unnoticed: `agile-11-merge-train` Phase 5 refuses to report a merged PR as Done without it and re-dispatches this skill.
- **Echo the collisions you recorded.** `collisions recorded` is a receipt field, not narrative — it is how the caller proves the Phase 1 conflict map actually reached the ticket instead of evaporating in the hand-off. Empty entry → `none`.
- **A DoD deviation is recorded as a labelled conscious accept, never left implicit.** When a standing convention conflicts with the ticket's DoD wording, the comment says what the DoD asks, what was done instead, why the convention wins, where the equivalent-strength coverage lives, and that it was deliberate. A deviation with no such entry reads to the QA/retro reader as a missed DoD item.
- **Cross-PR conflict ≠ Jira link creation.** This skill records the recommendation in the comment; `agile-11-merge-train` Phase 4 actually creates the link via `createIssueLink`. Do not call `createIssueLink` from this skill — keeps responsibility clean.
- **Comment prose stays in normal English.** The Jira comment is a permanent ticket artifact read by humans during retro + future incident investigations; write full sentences.
- **Phase 4 confirms the Jira link inline.** When `agile-11-merge-train` Phase 4 successfully creates a `Relates` (or stronger) link between two tickets that collided on shared files, it appends a one-line confirmation comment to the most recent postmortem on each side: `Jira link created: relates to <KEY> (Phase 4, merge-train run <date>).` This closes the loop so reviewers reading the postmortem later can see the link was actually applied, not just recommended. If Phase 4 was unable to create the link (API error, ticket gone, etc.), append the failure reason instead — never leave the recommendation untracked.
