---
name: implement-review
description: "Sub-skill of agile-10-implement: the author's self-review gate. Review a PR vs its Jira Story + ADR across six lenses, post the verdict to PR + Jira, return numbered blockers. Never prompts the user. Not user-invoked."
user-invocable: false
---

# implement_review

**The implementing developer's own self-review.** You wrote this code in `implement-code`; now read it across six lenses before handing it over, and the findings get fixed in the same branch (the orchestrator loops back into `implement-code`). Ask "did I miss anything obvious?" — not "is this good enough to merge".

The same code is reviewed three times by three roles, and this is the first: `merge-review-pr` (in `agile-11-merge-train`) is the independent pre-merge gate by someone who did not write it, and `agile-13-sprint-closeout` is the global end-of-sprint review of the wired-together whole. Stay in lane: be thorough, but this does not replace the independent gate.

**Autonomous — never blocks on a human answer.** Infer non-obvious choices from the ADR / Specs UI / PRD / surrounding code and **flag each inference** in the verdict ("Assumed X because ADR §N specifies the polling pattern"). A non-obvious choice that is genuinely underivable *and* changes whether the code is correct is a **blocker**, not a question. Even a critical, irreversible risk is recorded as a blocker — `agile-10-implement` owns all user interaction and decides whether to escalate. A run always ends in a verdict, never in "waiting for a reply".

**Non-goals:** being the authoritative pre-merge gate; merging; transitioning the Story (approval only labels it — QA closes it); style-bikeshedding that blocks a correct PR.

**Config** (consumer repo `CLAUDE.md` / `AGENTS.md`): `cloudId` (required), `ticket-prefix-regex` (default `[A-Z]+-\d+`), `in-review-status-name` (default `In Review`).

**Input:** a PR (number/URL) and/or a Story key — derive the other from the PR title/branch or the Story's `🤖 agile:phase=pr` comment.

---

## Step 1 — Scan the Story and the PR

Read the **Story** in full (`mcp__atlassian__getJiraIssue`): summary, AC, DoD, technical notes, refinement comments, and the `🤖 agile:phase=plan` / `status_change` comments. Read the **ADR** in Confluence, and the **Specs UI** for a UI Story. Read the **PR** (`gh pr view <N> --json title,body,headRefName,baseRefName,files,reviews,statusCheckRollup,mergeStateStatus` + `gh pr diff <N>`), including the dev agent's flags — new decisions, Specs deviations, tech debt. Check for prior `🤖 agile:phase=review` markers and review threads.

Report the reading in one block, then go straight into the lenses — no confirmation:

```
Reviewing: [PROJ-XXX] — [summary]   PR #N   Layer: [backend/frontend/fullstack]   Points: [N]
ACs to verify: [N]   Dev flags: new decisions [..], Specs deviations [..], tech debt [..]
Prior review cycles: [N]
```

Unresolvable PR link → return verdict `cannot-review` ("No PR resolvable for [PROJ-XXX] — run agile-10-implement first or pass the PR explicitly").

## Step 2 — Review across six lenses

**Read every changed file in full** — bugs hide in the surroundings a diff omits. Each lens produces ✅ passes, ⚠️ warnings (non-blocking follow-up), ❌ blockers (must fix).

**Default: one read, all six lenses, in this context — no subagent dispatch.** Splitting the lenses across N `review-lens` subagents makes each one re-read the whole changed-file set: N× the diff-read tokens for work a single pass already covers.

**Opt-in fan-out, large PR only:** when the file count makes one-pass depth slow or context-heavy (or wall-clock matters inside a `concurrency>1` run), the **orchestrator** dispatches `agile-execution:review-lens` subagents split by lens group (security + architecture / performance + infra / code-quality + AC-DoD), each returning `file:line`-cited findings, and merges them into the single verdict. Read-only and parallel-safe — but none of them may build or run the shared Docker stack. Never wrap this step in its own agent first; the fan-out happens one level up.

**Lens 1 — Architecture (vs ADR).** Layering and separation of concerns; new patterns consistent with the ADR and codebase; dependencies within the approved stack; API naming/verbs/status codes/response shape. Blockers: a silent pattern contradicting the ADR; a DB call in a controller bypassing the service layer; an unapproved external dependency; a significant new architectural decision the dev agent left unflagged.

**Lens 2 — Security (every finding is a blocker).** Input validated at the entry point; auth enforced; **authorisation** checked (can *this* user do *this* to *this* resource — not merely "logged in"); no hardcoded secrets; no PII logged; no injection via interpolation; uploads validated for type/size/content; CORS correct on new endpoints; errors that don't leak internals.

**Lens 3 — Performance.** N+1 queries; expensive work async with timeouts; pagination on list endpoints; indexes for new query patterns; caching where the ADR specifies; no leaks (unclosed connections, unbounded collections). Blockers: N+1 on a list endpoint; a sync external call in a hot path with no timeout; an unbounded result with no pagination.

**Lens 4 — Infra and ops.** New env vars documented (`.env.example` / CI); cloud resources via IaC; migrations backward-compatible for a rolling deploy; CI/CD updated; probes still valid; resource limits; monitoring for a new dependency. Blockers: an undocumented env var; a non-backward-compatible migration; a manually-created cloud resource.

**Lens 5 — Code quality.** Readable without comments explaining basic logic; domain-vocabulary naming; single responsibility; consistent error handling; named constants; tests exercising behaviour not implementation. Mostly ⚠️ — don't block a correct PR on style — with one ❌ exception: **dead code is a defect, not a nit** (an unused import/variable/param, a commented-out block, a new file or export nothing wires up). Remove it, don't note it.

**Lens 6 — AC and DoD.** Every AC maps to a test and to a reachable line — if you cannot point at the line, it is not satisfied. Edge cases, not just the happy path. Every DoD item checked. A Specs-UI compliance claim that matches the implementation. Blockers: an AC with no test; an unchecked DoD item; a claimed Specs compliance contradicted by an unjustified deviation.

> **A negative / guard test must REACH the guard it names.** Mutation-grade (would it fail if the behaviour regressed?) is necessary but not sufficient — the input must not be rejected by an *earlier* layer: field length/precision, type coercion, nullability, referential integrity, a framework validator, an upstream schema check. A test asserting a storage constraint rejects a value whose input is already too wide for the column never evaluates that constraint. For each negative assertion, state which named guard it provably trips and why nothing earlier can reject the input. **Blocker** — a test that passes for the wrong reason is the same defect as one that fails for the wrong reason, except it ships.

**The verdict carries a machine-checkable receipt.** A bare "six ✅" is not a review; the orchestrator rejects a verdict missing any of:
1. **Files-read list** — every file in the diff with its line count. The orchestrator compares against `gh pr diff <N> --name-only` and rejects a mismatch. A partial read (`offset`/`limit`) does not count.
2. **A finding per lens** — each of the six gets a line with ≥1 `file:line` cite **or** an explicit "N/A because …". A ✅ with no citation is rejected.
3. **Per-AC line binding** — each AC → the `file:line` satisfying it, in the **approved** path too.

Can't produce all three → the review is partial. Finish it; no verdict on a partial review.

## Step 3 — Produce and post the verdict

Post to **both** the PR and the Jira Story — autonomously, no "shall I post?".

```
## Code Review — APPROVED — [date]   (AI-assisted back/infra/ops review)
PR: [link]   Story: [PROJ-XXX]
Files read in full: `a.py` (123) · `b.ts` (45) · …    (must equal the PR diff file set)
Lenses (each with evidence):
  ✅ Architecture — <file:line> <what confirmed>
  ✅ Security ..... — <file:line> or "N/A because no new endpoint/input"
  ✅ Performance .. — <file:line> or "N/A"
  ✅ Infra/ops .... — <file:line> or "N/A"
  ✅ Code quality . — <file:line>
  ✅ AC/DoD ....... — see AC binding below
AC binding: AC1 → <file:line> · AC2 → <file:line> · …
Inferences flagged: [each "assumed X because ADR §N" / none]
Warnings (follow-up, non-blocking): ⚠️ [..]
Approved. Ready for agile-11-merge-train / QA (skill 14).
```

On blockers, swap the body for numbered findings — each **numbered** (so the caller can reference it), **located** (`file:line`, never "security issue"), and **actionable** (what to change):

```
## Code Review — CHANGES REQUESTED — [date]   (AI-assisted back/infra/ops review)
Blockers (must fix before re-review):
❌ 1. [Lens] — [file:line] — [problem] — [suggested fix]
Warnings (address after blockers): ⚠️ 2. [..]
Inferences flagged: [..]
```

Then: `gh pr review <N> --approve|--request-changes --body "<verdict>"`, add the verdict as a `🤖 agile:phase=review` Story comment, and label the Story `dev-review-approved` / `dev-review-changes-requested`. **Never transition the Story.**

**Self-approval is blocked by the forge** — `--approve` fails with `Can not approve your own pull request` when the review identity opened the PR. Expected for an author self-review: fall back to `gh pr comment <N> --body "<verdict>"` and note that formal approval is left to the independent gate. The verdict still lands; this is not a review failure.

## Step 4 — Re-review after fixes (scoped)

Read only the new commits since the last `🤖 agile:phase=review` marker. Re-check **only the lenses that had blockers**, plus any file the fixes touched — fixes introduce new issues. Confirm each blocker by its original number (`❌ 1 → ✅ Resolved — [confirmation]`, `❌ 2 → ⚠️ Partially — [what remains]`). All resolved → approve; otherwise → changes requested with the remaining and new blockers.

## Step 5 — Return

The verdict block **is** the return value; `agile-10-implement` reads approved-vs-changes-requested plus the numbered blockers and acts. Standalone, close with `✅ APPROVED → 👉 agile-11-merge-train, then skill 14` or `❌ [N] blockers → 👉 fix and re-invoke`.

## Rules

- **Read the Story before the diff** — otherwise the review measures the diff against itself, not the spec.
- **Six lenses on every PR**, each with a cite or an explicit N/A. Security is never downgraded to a warning; warnings never block a correct PR.
- **Idempotent** — re-running on an approved PR reports the approval and advises; it does not re-approve or duplicate comments.
- **Verdict prose stays in normal English** — humans read it at merge and retro time.

## Marker — mandatory, exact format

Post via `mcp__atlassian__addCommentToJiraIssue` (`contentFormat="markdown"`). The comment **must begin with the literal HTML comment** or resume detection (which greps `🤖 <!-- agile:phase=... -->`) misses it and the phase re-runs. Never delete prior markers.

```
🤖 <!-- agile:phase=review --> **review — agile-10-implement — <YYYY-MM-DD>**
<phase content>
```
