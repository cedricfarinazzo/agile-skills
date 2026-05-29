---
name: implement-plan
description: "Sub-skill of agile-10-implement. Read every linked artifact (ADR, Specs UI, PRD, linked Bugs) and produce a concrete implementation plan + AC→test map, posted as the 🤖 plan marker. Not user-invoked."
user-invocable: false
---

# implement_plan

Planning phase for `agile-10-implement`. Invoked via the Skill tool with a validated ticket. Produces the plan and posts the `🤖 agile:phase=plan` marker (the orchestrator recovers the plan body from this comment on resume).

## Read everything before planning

Fan out read-only subagents where useful. Read:
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

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=plan --> **plan — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=plan -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
