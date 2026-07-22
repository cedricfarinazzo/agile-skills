---
name: implement-plan
description: "Sub-skill of agile-10-implement. Read every linked artifact (ADR, Specs UI, PRD, linked Bugs) and produce a concrete implementation plan + AC→test map, posted as the 🤖 plan marker. Not user-invoked."
user-invocable: false
---

# implement_plan

Planning phase for `agile-10-implement`. Invoked via the Skill tool with a validated ticket. Produces the plan and posts the `🤖 agile:phase=plan` marker (the orchestrator recovers the plan body from this comment on resume).

## Read everything before planning

Fan out read-only subagents where useful. Read:
- **The ticket itself, re-fetched in full** (`mcp__atlassian__getJiraIssue` — description, *every* AC, DoD, technical notes). This is the spec of record. Plan from it, never from memory or prior-context assumptions about what the ticket "probably" says. If any planned change contradicts an AC (column list, table shape, API surface), stop and re-read the ticket before continuing — the AC wins.
- **ADR** — tech stack, API style, auth, data model, infra constraints.
- **Specs UI** — every screen + every state (default / loading / empty / error / success) for UI Stories.
- **PRD** — edge-case context behind the ACs.
- **Linked QA Bugs** (if this is a re-implementation) — what previously failed.

## Produce the plan

A concrete, file-level plan:
- **Files / modules to touch**, in implementation order: data → service → API → frontend → tests.
- **AC→test map** — each AC maps to at least one test; each edge-case AC maps to its own test.
- **Flagged decisions** — any place the ADR is silent and a (reversible) choice will be made; note the choice. If a *critical* decision surfaces here, do not plan around a guess — surface it so the orchestrator can escalate.

Post the plan as `🤖 agile:phase=plan`. Return the plan to the orchestrator.

## When the ticket text itself is wrong

Specs drift from code. An AC written weeks ago names a file that has since moved, a test that pins a *different* component's state, a symbol that was renamed, a path that never existed. Planning is where this surfaces, because planning is the first phase that reads the code the AC points at.

**Three wrong answers, all common:**
- Reject the ticket. It is not under-specified — the intent is clear, only a reference is stale. `rejected` sends a well-understood ticket back to refinement for a typo.
- Follow the literal text. Editing the file the AC names *because* it names it produces a change nobody wanted, in the wrong component, that still reports "AC satisfied".
- Fix it silently. The correction then exists only in your context: the reviewer later verifies against the original wording, finds a mismatch, and either blocks a correct PR or waves through an unexamined deviation.

**The right answer — correct it in the open, then satisfy the AC by intent:**

1. **Establish ground truth.** Confirm the reference is actually wrong (the file/test/symbol does not exist, or exists but does not do what the AC says) and find what the AC *meant* — the real file, the real test, the real symbol.
2. **Post the correction to the ticket** before planning around it, as its own comment:
   ```
   🤖 <!-- agile:spec-correction --> **spec correction — agile-10-implement — <YYYY-MM-DD>**
   AC<N> says: "<quoted ticket text>"
   Ground truth: <what the reference actually is / that it does not exist> — evidence: <path:line, command + output, or a grep result>
   Reading instead: <the real file/test/symbol> — because <why this is what the AC means>
   Intent satisfied by: <what the plan will do>
   ```
   Evidence is mandatory: a correction asserted without a `path:line` or a command result is just a second opinion about the spec. Never edit the ticket's AC text — append the comment; the trail must show both what was written and what was built.
3. **Plan against the intent**, referencing the correction. The AC is satisfied when its *purpose* is met, not when its literal wording is pattern-matched.
4. **Carry it forward.** List the correction in the plan's flagged decisions and repeat it in the PR body, so the reviewer meets it before the diff.

**Escalate instead when the intent itself is unclear.** If the reference is wrong *and* it is not recoverable which behaviour the AC wanted — the two candidate readings imply different features, not different paths — that is a genuine blocking unknown: surface it (validation-gate `rejected` on re-entry, or a critical escalation when the wrong guess is expensive). "The reference is broken" is a correction; "the requirement is unknowable" is a rejection.

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=plan --> **plan — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=plan -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
