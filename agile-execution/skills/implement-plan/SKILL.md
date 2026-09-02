---
name: implement-plan
description: "Sub-skill of agile-10-implement — the planning phase. Not user-invoked."
user-invocable: false
---

# implement_plan

Planning phase for `agile-10-implement`, invoked with a validated ticket. Produces the plan and posts the `🤖 agile:phase=plan` marker — the orchestrator recovers the plan body from that comment on resume.

**Autonomous — never prompt the user.** Decide and document everything reversible, flagging it for the reviewer. The only stop is a *critical* decision (irreversible or high-blast-radius **and** not derivable from the ADR / PRD / Specs): return `critical` to the orchestrator, which parks that one ticket and asks. This holds in `concurrency=0` inline mode too, where no agent wraps this skill.

## Read everything before planning

- **The ticket, re-fetched in full** (`mcp__atlassian__getJiraIssue`: description, *every* AC, DoD, technical notes). This is the spec of record — plan from it, never from memory or from prior-context assumptions about what it "probably" says. If a planned change contradicts an AC (column list, table shape, API surface), stop and re-read: the AC wins.
- **ADR** — stack, API style, auth, data model, infra constraints.
- **Specs UI** — every screen and every state (default / loading / empty / error / success) for UI Stories.
- **PRD** — the edge-case context behind the ACs.
- **Linked QA Bugs**, on a re-implementation — what previously failed.

## Produce the plan

- **Files / modules to touch**, in implementation order: data → service → API → frontend → tests.
- **AC→test map** — every AC to at least one test; every edge-case AC to its own.
- **Flagged decisions** — anywhere the ADR is silent and a reversible choice gets made; note the choice. A *critical* decision surfacing here is not planned around — surface it so the orchestrator can escalate.

Post it as `🤖 agile:phase=plan` and return it.

## When the ticket text itself is wrong

Specs drift from code: an AC written weeks ago names a file that moved, a test pinning a *different* component's state, a renamed symbol, a path that never existed. Planning is where this surfaces, because planning is the first phase that reads the code the AC points at.

This is **not** a rejection (the intent is clear, only a reference is stale), **not** a literal edit of the file the AC names (that ships a change nobody wanted while reporting "AC satisfied"), and **not** a silent fix (the correction then lives only in your context and the reviewer reads it as an unexplained deviation).

Correct it in the open, then satisfy the AC by intent:

1. **Establish ground truth** — confirm the reference is actually wrong (missing, or present but not doing what the AC says) and find what the AC *meant*.
2. **Post the correction to the ticket** as its own comment, before planning around it. Evidence is mandatory: a correction with no `path:line` or command result is just a second opinion about the spec. Never edit the AC text — append, so the trail shows both what was written and what was built.
   ```
   🤖 <!-- agile:spec-correction --> **spec correction — agile-10-implement — <YYYY-MM-DD>**
   AC<N> says: "<quoted ticket text>"
   Ground truth: <what the reference actually is / that it does not exist> — evidence: <path:line, command + output, or grep result>
   Reading instead: <the real file/test/symbol> — because <why this is what the AC means>
   Intent satisfied by: <what the plan will do>
   ```
3. **Plan against the intent**, referencing the correction. The AC is satisfied when its purpose is met, not when its literal wording is pattern-matched.
4. **Carry it forward** — into the plan's flagged decisions and into the PR body, so the reviewer meets the correction before the diff.

**Escalate instead when the intent is unclear.** A broken reference whose two candidate readings imply different *features* (not different paths) is a genuine blocking unknown: surface it as a validation-gate `rejected` on re-entry, or a critical escalation when a wrong guess is expensive. "The reference is broken" is a correction; "the requirement is unknowable" is a rejection.

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. Never delete prior markers.

```
🤖 <!-- agile:phase=plan --> **plan — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```
