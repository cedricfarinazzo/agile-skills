---
name: merge-jira-postmortem
description: "Post structured post-merge comment to Jira ticket + transition to Done (skip transition in blocked mode). Mandatory even on 0-issue PRs. Triggers: jira postmortem, comment jira, /jira-postmortem."
---

# merge-jira-postmortem

Post a structured post-merge findings comment to a Jira ticket, synthesised from this session's review and fix work, and — when the PR merged — transition the ticket to **Done**. In `blocked` mode, post the block-notice comment and leave the ticket state untouched.

**Mandatory even on a clean PR.** A 0-issue PR still gets the comment and the transition; "What was correct" becomes the whole body. Skipping because "nothing went wrong" strands the ticket in its in-review column and breaks the merge-train contract.

## Input

Jira key from args (`ABC-123`), else inferred from the branch name. Optional mode: `merged` (default) or `blocked`.

**`conflict_map` entry** — `agile-11-merge-train` 3g passes this PR's Phase-1 entry verbatim:

```
conflict_map entry:
  pr: <N>  ticket: <KEY>
  collisions:
    - file: <path>   with_pr: <other PR>   with_ticket: <other KEY>   kind: append | same-lines
```

`collisions: []` is a real value meaning "checked, none" — not "not supplied". Every collision becomes a Cross-PR bullet **and** an entry in the `collisions recorded` receipt field. Never invent one the caller did not pass; never silently drop one it did. Invoked standalone with no entry, derive the collisions yourself and say so.

**Config** (consumer repo `CLAUDE.md` / `AGENTS.md`): `cloudId` — required, no default. `ticket-prefix-regex` — default `[A-Z]+-\d+`.

## Steps

1. **Gather from session context:** every issue found during review; every fix applied and why; what was already correct; AC-by-AC verification (satisfied / not, and why); **conscious accepts** (each deliberate DoD deviation — what the DoD asks, what was done instead, why the convention wins, where the equivalent-strength coverage lives, and that it was deliberate); **cross-PR conflicts from the caller's entry, not from recollection**.
2. **Post the comment** via `mcp__atlassian__addCommentToJiraIssue` (configured `cloudId`, `contentFormat: markdown`) and **capture the returned comment id** — it is the proof it was posted.
3. **`merged` mode → transition to Done.** `getTransitionsForJiraIssue`, find the transition whose target status category is `done` / colorName `green`, call `transitionJiraIssue`. (Fast path: if the repo declares a stable `done-transition-id`, call it directly and fall back to the lookup on failure.) **Then read the status back** with `getJiraIssue` and confirm the category is `done` — a transition call that returned without the ticket landing in a done-category status is not complete.
4. **`blocked` mode → do not transition.** The PR stays open with a block comment and the ticket stays in its column.
5. **Return the receipt.** `agile-11-merge-train` 3g verifies it before counting the PR done, and its Phase 5 re-dispatches this skill for any merged PR whose ticket is not done-category. `collisions recorded` echoes exactly what you wrote into the comment — that echo is how the caller proves the Phase-1 conflict map reached the ticket instead of evaporating in the hand-off.

```
Postmortem receipt:
  mode: merged | blocked
  comment id: <id from step 2>
  status: <current status name> (category: <done | in-progress | ...>)
  collisions recorded: <KEY>@<file>, <KEY>@<file>   |   none
```

## Comment structure

Every issue gets its own numbered section with root cause, fix, and a **generalizable** lesson ("always use X pattern when Y", never "fix this specific file"). Be specific — file names, line numbers, function names. The comment is a permanent ticket artifact read by humans during retro and future incident investigations, so write full sentences in normal English, and **never omit "What was correct"**, however many issues there were.

```markdown
## Post-merge review findings — what was wrong

<TOTAL> issue(s) found during PR review, <FIXED> fixed before merge.

### <IDX>. <Severity>: <short title>
**Root cause:** <precisely what was wrong>   <if critical: what would have broken, and when>
**Fix:** <what changed>
**Lesson:** <the generalizable rule>

### What was correct
- <bullet>

### Conscious accepts (if any)
- **DoD asks:** <wording> — **done instead:** <what shipped> — **why:** <the standing convention that wins, and where it is documented> — **equivalent coverage:** `<file:line>`. Deliberate decision, not an oversight.

### Cross-PR conflicts (if any)
- Conflicted with **#<other PR>** (<TICKET-KEY>) on `<file>`. The two tickets should be linked in Jira (`<link type>`) — the missing link is why the overlap was only discovered at merge time.
```

On a 0-issue PR, open with "0 issues found during PR review." and go straight to "What was correct" plus any cross-PR conflicts.

**Block mode:**

```markdown
## PR blocked — not merged

**Reason:** <one line on why this cannot be merged as-is>

### Missing / wrong
- AC<N>: <what the ticket requires> — <what the PR delivered or didn't>

### What was correct
- <bullet>

### Path forward
- <what must change to unblock — file-level where possible>
```

**Severity:** **Critical** — would cause a runtime error, data corruption, test failure, security issue, or autogenerate drift. **Minor** — misleading docs, a wrong port in a docstring, a missing run command, a stale AC description.

## Boundaries

- **Cross-PR conflict ≠ Jira link creation.** This skill records the recommendation; `agile-11-merge-train` Phase 4 creates the link via `createIssueLink`. Never call `createIssueLink` from here.
- **Phase 4 confirms the link inline.** After creating one, the train appends `Jira link created: relates to <KEY> (Phase 4, merge-train run <date>).` to the most recent postmortem on each side — or the failure reason if it could not. That closes the loop so a later reader sees the link was applied, not merely recommended.
