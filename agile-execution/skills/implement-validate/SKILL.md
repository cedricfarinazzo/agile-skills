---
name: implement-validate
description: "Sub-skill of agile-10-implement. The per-ticket gate: confirm the ticket targets the current repo, then score readiness (AC/DoD/Specs/ADR). Returns pass / out-of-scope / rejected(Needs Info) / critical-park. Not user-invoked."
user-invocable: false
---

# implement_validate

Per-ticket validation gate for `agile-10-implement`. Decides whether one Story may enter the build pipeline. Invoked via the Skill tool with a ticket key + the resolved config; returns one verdict. Posts the `🤖 agile:phase=validate` marker.

## Repo-scope check first (hard gate)

Establish which repo the agent is running in — `git remote get-url origin` + repo name, cross-referenced with the consumer `CLAUDE.md` (`repo` / `repo-component-map` / `service-name`). Determine the ticket's target repo/component from its labels (e.g. `repo:foo`, or `backend`/`frontend` when those map to separate repos), component field, technical notes, or the ADR's service→repo mapping.

- **Ticket does not target the current repo →** return **`out-of-scope`**. Post `🤖 agile:phase=validate` (out-of-scope mode) naming the actual target repo. Leave the ticket in `To Do` — do not transition, do not label `needs-info` (it is correctly specified, just not for this repo).
- **Target repo genuinely ambiguous** (no label/component/mapping resolves it) → treat as a missing-spec rejection (below); never assume it belongs here.

## Readiness score

Score the Story 0–10 (reuse skill 8's readiness gate): clear persona summary; ≥2 falsifiable Given/When/Then ACs; DoD present; Specs UI link for UI Stories; technical notes referencing the ADR; dependencies resolvable; no open question that would force a mid-implementation architecture decision.

- **In current repo AND score ≥ 6 AND AC + DoD present → `pass`.** Resolve remaining minor ambiguities by inference from the ADR / Specs UI / PRD standard patterns, and record *every* inference explicitly in the validation comment (never infer silently). Post `🤖 agile:phase=validate` with the score + inference list. Transition `To Do → In Progress`. Return `pass`.
- **Score < 6, or no AC / no DoD, or a genuine blocking unknown remains → `rejected`.** Post `🤖 agile:phase=validate` (rejected mode) listing exactly what is missing and what skill 8 (Refinement) must add. Transition to `needs-info-status-name` (or leave in `To Do` + label `needs-info`). Return `rejected`.

## Critical-decision pre-check

If validating already surfaces a **critical** decision (irreversible / high-blast-radius AND not derivable from ADR/PRD/Specs — destructive migration, auth/security change, breaking a shared contract, new paid/infra dependency, data-loss risk), return **`critical-park`** with the decision stated. The orchestrator escalates one consolidated question to the user and parks the ticket. Do not guess a critical decision into the spec.

## Return

Return exactly one of: `pass` · `out-of-scope` (+ target repo) · `rejected` (+ what's missing) · `critical-park` (+ the decision/options/recommendation). The orchestrator branches on it. This sub-skill never asks the user directly — `critical-park` hands the question up to the orchestrator.

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=validate --> **validate — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=validate -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
