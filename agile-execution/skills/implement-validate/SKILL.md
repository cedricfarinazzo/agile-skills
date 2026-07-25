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

## Readiness score — a per-criterion breakdown, not a bare number

Score the Story 0–10 by scoring **each of the 7 criteria explicitly** (reuse skill 8's readiness gate). A bare "score: 7 → pass" is not a valid verdict — the orchestrator rejects a `pass` with no breakdown and re-dispatches. For each criterion, state the points **and quote the ticket text that earns (or fails) them** so the judgement is checkable, not asserted:

1. **Persona summary** — clear "As a … I want … so that …".
2. **≥2 falsifiable Given/When/Then ACs** — quote them; "falsifiable" = a test could fail it.
3. **DoD present** — quote or reference it.
4. **Specs UI link** (UI Stories) — present, or N/A for non-UI.
5. **Technical notes reference the ADR** — quote the reference.
6. **Dependencies resolvable** — every "is blocked by" link accounted for.
7. **No open question forcing a mid-implementation architecture decision.**

- **In current repo AND score ≥ 6 AND AC + DoD present → `pass`.** Resolve remaining minor ambiguities by inference from the ADR / Specs UI / PRD standard patterns, and record *every* inference explicitly in the validation comment (never infer silently). Post `🤖 agile:phase=validate` carrying the **Readiness receipt** (the 7-criterion breakdown + total + inference list — see the marker format). Transition `To Do → In Progress` (see the transition rule below), and **record it in the marker** with a literal `Transitioned: <from> → <to>` line. This line is the resume signal: on re-entry the orchestrator reads it to confirm the move actually happened — a `validate` marker with no `Transitioned:` line means the transition was skipped and must be re-applied before `plan` starts. Return `pass` **with the receipt**.

### Transitioning by discovery (never hardcode a transition id)

Transition ids are **per-project and unstable** — never assume `21`/`31`/etc. To move a Story:
1. Call `mcp__atlassian__getTransitionsForJiraIssue` for the ticket.
2. Match the target status (`in-progress-status-name`, default `In Progress`) **case-insensitively, by substring, against each transition's target `name`** — so localised names ("En cours", "Revue en cours") resolve. Use that transition's `id`.
3. **Before concluding a status does not exist, read this list** — do not assume a board "has no In-Progress / In-Review column" from memory. Only if no transition's target name matches after reading the list do you fall back (leave in place + note it).
- **Score < 6, or no AC / no DoD, or a genuine blocking unknown remains → `rejected`.** Post `🤖 agile:phase=validate` (rejected mode) listing exactly what is missing and what skill 8 (Refinement) must add. Transition to `needs-info-status-name` (or leave in `To Do` + label `needs-info`). Return `rejected`.

## A stale reference is not a rejection

An AC that names a file, test, or symbol which does not exist (or which exists but pins something else) is **not** a readiness failure — the ticket is specified, one of its references has drifted from the code. Score criterion 2 on whether the AC is **falsifiable**, not on whether every path in it still resolves. Do not deduct for the stale reference, do not `reject`, and do not treat the literal text as authoritative.

Instead: note it in the validation marker (`Spec drift: AC<N> references <X> — verify at plan time`) and let it `pass`. `implement-plan` owns the correction — it establishes ground truth, posts a `🤖 <!-- agile:spec-correction -->` comment with evidence, and satisfies the AC **by intent**. Reject only when the *intent* is unrecoverable, not when a pointer is broken (criterion 7's "blocking unknown").

## Critical-decision pre-check

If validating already surfaces a **critical** decision (irreversible / high-blast-radius AND not derivable from ADR/PRD/Specs — destructive migration, auth/security change, breaking a shared contract, new paid/infra dependency, data-loss risk), return **`critical-park`** with the decision stated. The orchestrator escalates one consolidated question to the user and parks the ticket. Do not guess a critical decision into the spec.

## Return — the receipt is the verdict

Return exactly one of: `pass` · `out-of-scope` (+ target repo) · `rejected` (+ what's missing) · `critical-park` (+ the decision/options/recommendation). The orchestrator branches on it. This sub-skill never asks the user directly — `critical-park` hands the question up to the orchestrator.

**A `pass` return must carry the Readiness receipt** — the 7-criterion breakdown (points + quoted evidence per criterion), the total, and the `Transitioned:` line. A `pass` with no breakdown is treated as **not-run** and re-dispatched: the whole point is that the orchestrator can verify the score was earned, not asserted. Likewise `rejected` names the specific failing criteria, not just "score too low".

## Marker — mandatory, exact format

Posting the phase marker is **not optional** — it is how `agile-10-implement` records progress and resumes. Post it to the ticket via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML-comment marker** so resume detection (which greps `🤖 <!-- agile:phase=... -->`) finds it:

```
🤖 <!-- agile:phase=validate --> **validate — agile-10-implement — <YYYY-MM-DD>**
Readiness: <total>/10
1. Persona ............... <pts> — "<quoted evidence / what's missing>"
2. ACs (≥2 falsifiable) .. <pts> — "<quoted AC>"
3. DoD .................. <pts> — "<quoted / ref>"
4. Specs UI link ........ <pts> — <link / N/A non-UI>
5. ADR reference ........ <pts> — "<quoted>"
6. Dependencies ......... <pts> — <blockers accounted for>
7. No blocking unknown .. <pts> — <none / the unknown>
Inferences: <each "assumed X because ADR §N" / none>
Spec drift: <AC<N> references <X> — verify at plan time / none>
Transitioned: <from> → <to>        # pass only; omit on rejected/out-of-scope
<verdict + any further notes>
```

A comment that omits `<!-- agile:phase=validate -->` is invisible to resume — the phase will look unfinished and re-run. A `pass` comment that omits the per-criterion `Readiness:` breakdown or the `Transitioned:` line fails the orchestrator's gate and is re-dispatched. Never delete prior markers.
