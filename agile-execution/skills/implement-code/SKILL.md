---
name: implement-code
description: "Sub-skill of agile-10-implement. Set up the feature branch, implement the plan per ADR + Specs UI with full AC test coverage, get lint+unit+integration green, then commit and push. Also runs the fix pass for review findings. Not user-invoked."
user-invocable: false
---

# implement_code

Build phase for `agile-10-implement` — the only phase that touches the shared Docker Compose stack, so it runs strictly one ticket at a time. Invoked via the Skill tool with a planned ticket (and, on a fix pass, the numbered review findings to address). Posts the `🤖 agile:phase=implement` marker.

## Set up workspace and branch

- `git checkout <base-branch> && git pull` to start from the current tip.
- Create or reuse the feature branch `<branch-prefix><TICKET>` — idempotent: `gh pr checkout` / `git checkout -B` only if no open PR branch already exists for this ticket.

## Implement (non-negotiable rules)

- **Follow the ADR exactly.** No new pattern, library, or architectural decision without flagging it (PR body + a `🤖` Jira comment) — never silently deviate.
- **Implement every Specs UI state** (default / loading / empty / error / success), not just the happy path. Match the spec; flag deviations, never silently "improve".
- **Cover every AC with a test**; each edge-case AC gets its own test.
- **Name from the domain** (PRD / ADR vocabulary), not generic names.
- Run the project's **lint + unit + integration** suites locally and get them green before finishing. Do not push and hope CI catches it. This holds the shared stack — never run it concurrently with another ticket's build.
- **Forced ADR-uncovered decision:** **reversible** → decide the lower-risk option, post a `🤖` comment with the choice + rationale, flag it in the PR, keep going. **Critical** (irreversible / high-blast-radius — destructive migration, auth/security, breaking shared contract, new paid/infra dependency, data-loss risk) → stop and return `critical` to the orchestrator (which parks the ticket and escalates one question). Never guess a critical decision.

## Fix pass (when re-invoked after `implement-review`)

Given the numbered findings, fix **every** one — Critical *and* Minor (Minor is a severity, not a deferral). The only acceptable unfixed finding is one that would expand the diff into unrelated files — file a follow-up ticket inline and note it in the PR. Re-read the changed files after fixing (fixes introduce bugs). Re-run lint + unit + integration green.

## Commit and push

Conventional commit; body includes `Refs: <TICKET>` and the `Co-Authored-By` trailer. Push the branch. (Commit/push is silent — no Jira marker; it is reconstructed from the pushed branch.) Then post `🤖 agile:phase=implement` summarising what was built/fixed and confirming the suites are green. Return to the orchestrator.

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=implement --> **implement — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```

A comment that omits `<!-- agile:phase=implement -->` is invisible to resume — the phase will look unfinished and re-run. Never delete prior markers.
