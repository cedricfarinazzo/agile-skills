---
name: implement-validate
description: "Sub-skill of agile-10-implement. The per-ticket gate: confirm the ticket targets the current repo, then score readiness (AC/DoD/Specs/ADR). Returns pass / out-of-scope / rejected(Needs Info) / critical-park. Not user-invoked."
user-invocable: false
---

# implement_validate

Per-ticket gate for `agile-10-implement`: decides whether one Story may enter the build pipeline. Returns exactly one verdict and posts the `🤖 agile:phase=validate` marker. It never asks the user — `critical-park` hands the question up to the orchestrator.

## Repo-scope check first (hard gate)

Establish which repo you are in (`git remote get-url origin` + the consumer `CLAUDE.md`'s `repo` / `repo-component-map` / `service-name`), then determine the ticket's target repo from its labels (`repo:foo`, or `backend`/`frontend` when those map to separate repos), component field, technical notes, or the ADR's service→repo mapping.

- **Not this repo →** `out-of-scope`, naming the actual target. Leave the ticket in `To Do` — no transition, no `needs-info` label; it is correctly specified, just not for here.
- **Genuinely ambiguous** (nothing resolves it) → treat as a missing-spec rejection. Never assume it belongs here.

## Readiness score — a per-criterion breakdown, not a bare number

Score **0–7, one point per criterion** — these are **skill 8's readiness gate minus its points criterion**, which is refinement's job and not a precondition for building. Half points for partial evidence. An N/A criterion scores its full point: a non-UI Story is not penalised for having no Specs UI link. For each, state the points **and quote the ticket text that earns or fails them**, so the judgement is checkable rather than asserted. A bare "score: 5 → pass" is treated as **not-run** and re-dispatched.

The criteria are deliberately **unweighted**. ACs and DoD are already hard preconditions below, so scoring them above the rest would bank points a passing ticket has by definition and let one through on nothing else.

1. **Persona summary** — a clear "As a … I want … so that …".
2. **≥2 falsifiable Given/When/Then ACs** — quoted; falsifiable means a test could fail it.
3. **DoD present** — quoted or referenced.
4. **Specs UI link** — present for UI Stories, full marks N/A otherwise.
5. **Technical notes reference the ADR** — quoted.
6. **Dependencies resolvable** — every "is blocked by" link accounted for.
7. **No open question forcing a mid-implementation architecture decision.**

**In this repo AND score ≥ 4.5 AND AC + DoD present → `pass`.** Resolve remaining minor ambiguities by inference from the ADR / Specs UI / PRD standard patterns, recording *every* inference in the marker — never infer silently. Transition `To Do → In Progress` and record it with a literal `Transitioned: <from> → <to>` line: that line is the resume signal, and a `validate` marker without it means the transition never landed and must be re-applied before `plan` starts.

**Score < 4.5, or no AC, or no DoD, or a genuine blocking unknown → `rejected`.** List exactly what is missing and what skill 8 (Refinement) must add, naming the specific failing criteria rather than "score too low". Transition to `needs-info-status-name`, or leave in `To Do` and label `needs-info`.

### Transitioning by discovery — never hardcode a transition id

Transition ids are per-project and unstable; never assume `21`/`31`/etc.

1. `mcp__atlassian__getTransitionsForJiraIssue` for the ticket.
2. Match the target status (`in-progress-status-name`, default `In Progress`) **case-insensitively by substring against each transition's target `name`**, so localised names ("En cours", "Revue en cours") resolve. Use that transition's id.
3. **Read that list before concluding a status does not exist** — never assume from memory that a board has no In-Progress column. Only when no target name matches do you fall back to leaving it in place and noting it.

## A stale reference is not a rejection

An AC naming a file, test, or symbol that does not exist — or that pins something other than what it describes — is **not** a readiness failure. The ticket is specified; one of its references has drifted from the code. Score criterion 2 on whether the AC is *falsifiable*, not on whether every path in it still resolves.

Note it in the marker (`Spec drift: AC<N> references <X> — verify at plan time`) and let it `pass`. `implement-plan` owns the correction: it establishes ground truth, posts a `🤖 <!-- agile:spec-correction -->` comment with evidence, and satisfies the AC **by intent**. Reject only when the *intent* is unrecoverable (criterion 7's blocking unknown), never for a broken pointer.

**A false PREMISE is the same class as a broken pointer.** A ticket asserting a behaviour ("nothing covers X", "this path is unreachable") can simply be wrong — written from inspection, or true when filed and not since. Same handling, same owners: note it here, `implement-plan` establishes ground truth and posts the correction, `implement-pr` carries it into the PR body — a PR whose stated justification is one the author already knows is false gets reviewed against the wrong question.

## Critical-decision pre-check

If validating already surfaces a **critical** decision — irreversible or high-blast-radius **and** not derivable from the ADR/PRD/Specs (destructive migration, auth/security change, breaking a shared contract, a new paid or infra dependency, data-loss risk) — return **`critical-park`** with the decision, the options, and your recommendation. The orchestrator escalates one consolidated question and parks the ticket. Never guess a critical decision into the spec.

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. A `pass` omitting the per-criterion breakdown or the `Transitioned:` line fails the orchestrator's gate and is re-dispatched. Never delete prior markers.

```
🤖 <!-- agile:phase=validate --> **validate — agile-10-implement — <YYYY-MM-DD>**
Readiness: <total>/7
1. Persona ............... <0 | 0.5 | 1> — "<quoted evidence / what's missing>"
2. ACs (≥2 falsifiable) .. <0 | 0.5 | 1> — "<quoted AC>"
3. DoD .................. <0 | 0.5 | 1> — "<quoted / ref>"
4. Specs UI link ........ <0 | 0.5 | 1> — <link / N/A non-UI, full point>
5. ADR reference ........ <0 | 0.5 | 1> — "<quoted>"
6. Dependencies ......... <0 | 0.5 | 1> — <blockers accounted for>
7. No blocking unknown .. <0 | 0.5 | 1> — <none / the unknown>
Inferences: <each "assumed X because ADR §N" / none>
Spec drift: <AC<N> references <X> — verify at plan time / none>
Transitioned: <from> → <to>        # pass only; omit on rejected/out-of-scope
<verdict + any further notes>
```
