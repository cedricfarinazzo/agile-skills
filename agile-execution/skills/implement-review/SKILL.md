---
name: implement-review
description: "Sub-skill of agile-10-implement: the self-review gate. Autonomously review a PR against its Jira Story + ADR across six lenses (architecture, security, performance, infra/ops, code quality, AC/DoD); post the verdict to PR + Jira and return numbered blockers. Infers and flags, never waits, never prompts the user. Not user-invoked."
user-invocable: false
---

# implement_review

**This is the implementing developer's own self-review** — you wrote the code in `implement-code`, now you review it across six lenses before opening it up to anyone else, and the findings are **fixed directly in the same branch** (the orchestrator loops back into `implement-code`). It is *not* the independent gate: the independent PR review by another person happens later in `merge-review-pr` inside `agile-11-merge-train`. Think of this as "did I miss anything obvious before I hand it over?"

Invoked by `agile-10-implement` (Skill tool) before a ticket transitions to In Review. The review is **autonomous**: you do not pause to ask questions and wait — you infer non-obvious choices from the ADR/Specs/PRD, flag every inference explicitly, and produce a verdict in one pass. Return a clear verdict (approved / changes requested + numbered blockers); the orchestrator does the fixing (`implement-code`) and re-invokes until approved.

## The three review layers (different roles — don't conflate)

The same code is reviewed three times by three different roles; each adds what the others can't:
1. **`implement-review` (this skill)** — the *author* self-reviews and fixes directly, before the PR is opened for others. Catches the obvious before handoff.
2. **`merge-review-pr`** (in `agile-11-merge-train`) — a *different person* independently reviews the open PR before it merges to `main`. The authoritative pre-merge gate.
3. **`agile-13-sprint-closeout`** — a *global, impartial* deep review at sprint end, checking the wired-together sprint against the sprint/epic goal (not one PR).

Stay in lane: this is the author's pass. Be thorough, but it does not replace the independent gate (`merge-review-pr`).

## Goal & non-goals

**Goal:** the author hands over a PR they have already read file-by-file against the Story spec + ADR across all six lenses, with obvious problems fixed in-branch first — so the independent reviewer (`merge-review-pr`) spends their time on judgement, not on catching the author's own oversights.

**Non-goals:** being the authoritative pre-merge gate (that is `merge-review-pr` in `agile-11-merge-train` — a different person); merging (that is `agile-11-merge-train`); transitioning the Story to `Done` (that is QA, skill 14); style-bikeshedding that blocks a correct PR; asking a question and stopping the run to wait for a human reply.

## Autonomy contract

This skill **never blocks on a human answer.** Where the previous interactive version "asked clarifying questions and waited", you instead:
- **Infer** the intended choice from the ADR, Specs UI, PRD, and surrounding code, and **flag the inference** in the verdict ("Assumed X because ADR §N specifies the polling pattern — confirm if wrong").
- If a non-obvious choice is genuinely unjustifiable from the available context and would change whether the code is correct, that is a **blocker** ("rationale for X not derivable from ADR/PRD — document it or change the approach"), not a question. The blocker goes in the verdict and the caller resolves it.

This skill **never prompts the user** — not even on a critical finding. It returns a verdict with numbered blockers; the orchestrating loop (`agile-10-implement`) owns all user interaction and is the one that escalates a critical decision to a human. A reviewer that spots a critical, irreversible risk records it as a blocker in the verdict; the loop decides whether that warrants asking the user.

A run always ends in a verdict. It never ends in "waiting for the dev agent to reply".

## Configuration

From the consumer repo's `CLAUDE.md` / `AGENTS.md`:
- **`cloudId`** — for `mcp__atlassian__*`. Required.
- **`ticket-prefix-regex`** — infer ticket key from PR title / branch. Default `[A-Z]+-\d+`.
- **`in-review-status-name`** — default `In Review`.

## Input

A PR (number/URL) and/or a Story key. If only one is given, derive the other (ticket key from PR title/branch; PR link from the Story's `🤖 agile:phase=pr` comment or remote links).

---

## Step 1 — Scan the Story and the PR

- Read the Story in full (`mcp__atlassian__getJiraIssue`): summary, AC, DoD, technical notes, refinement comments, the `🤖 agile:phase=plan` and `status_change` comments from `agile-10-implement`.
- Read the PR: `gh pr view <N> --json title,body,headRefName,baseRefName,files,reviews,statusCheckRollup,mergeStateStatus` and `gh pr diff <N>`. Read the dev agent's flags (new decisions, Specs UI deviations, tech debt).
- Read the **ADR** in Confluence (reference for all architecture decisions) and the **Specs UI** (for UI Stories).
- Check for prior review cycles: existing `🤖 agile:phase=review` markers and prior PR review threads.

Report the reading (brief), then go straight into the lenses — no confirmation:

```
Reviewing: [PROJ-XXX] — [summary]   PR #N   Layer: [backend/frontend/fullstack]   Points: [N]
ACs to verify: [N]   Dev flags: new decisions [..], Specs deviations [..], tech debt [..]
Prior review cycles: [N]
```

**If the PR link can't be resolved** → return verdict `cannot-review`: "No PR resolvable for [PROJ-XXX] — run agile-10-implement first or pass the PR explicitly." (As a sub-skill this is an error the caller handles; standalone, advise the user.)

---

## Step 2 — Review across six lenses

**Read every changed file in full** (not just diff hunks) — bugs hide in the surroundings the diff omits. For each lens produce: ✅ passes, ⚠️ warnings (non-blocking, address in follow-up), ❌ blockers (must fix before approval).

**Delegate the reads to subagents.** Review is read-only, so fan it out: spawn Agent-tool subagents to read the changed files and run the lenses (e.g. one for security + architecture, one for performance + infra, one for code-quality + AC/DoD), each returning its ✅/⚠️/❌ findings. Read-only subagents are parallel-safe — but do **not** have any subagent build or run the shared Docker Compose stack as part of the review (the implement loop owns the stack and serialises it). Merge the subagents' findings into the single verdict.

### Lens 1 — Architecture compliance (vs ADR)
Layering / separation of concerns; new patterns consistent with ADR & codebase; **unflagged** new architectural decisions (the dev agent should have flagged them — a significant silent one is a blocker); dependencies within the ADR-approved stack; API design (naming, verbs, status codes, response shape) consistent with ADR. Blockers: silent pattern contradicting the ADR; DB call in a controller bypassing the service layer; unapproved external dependency.

### Lens 2 — Security (every finding is a blocker)
Input validated/sanitised at the entry point; auth enforced on protected endpoints; **authorisation** checked (can *this* user do *this* action on *this* resource, not just "logged in"); no hardcoded secrets/keys; no sensitive data / PII logged; no SQL/NoSQL injection via interpolation; file uploads validated (type/size/content); CORS correct for new endpoints; error messages don't leak internals.

### Lens 3 — Performance and scalability
N+1 queries (DB in loops); expensive ops (large queries, file processing, external calls) async where appropriate + timeouts; pagination on list endpoints; indexes for new query patterns; caching where the ADR specifies; no leaks (unclosed connections, unbounded collections); large payloads compressed. Blockers: N+1 on a list endpoint; sync external call in a hot path without timeout; missing pagination on an unbounded result.

### Lens 4 — Infra and ops impact
New env vars documented (`.env.example` / CI); new cloud resources via IaC, not manual; DB migrations backward-compatible for rolling deploy; CI/CD updated if new steps needed; health/readiness probes still valid; resource limits appropriate; new service/dependency added to monitoring. Blockers: undocumented new env var; non-backward-compatible migration; manually-created cloud resource.

### Lens 5 — Code quality and maintainability
Readable without comments explaining basic logic; domain-vocabulary naming (PRD/ADR); single-responsibility, appropriately-sized functions; consistent error handling; named constants over magic values; no dead/commented-out code; tests exercise behaviour not implementation; coverage matches AC + edge-case count; no duplicated logic to extract. Mostly ⚠️ warnings (don't block a correct PR on style), except missing/sham test coverage for an AC → that is Lens 6.

### Lens 6 — AC and DoD verification
Each AC maps to a test/verification in the PR; every AC reachable from the code (point to the line — if you can't, it's not satisfied); edge cases covered, not just happy path; every DoD item checked; Specs UI compliance claim matches the implementation. Blockers: an AC with no test; unchecked DoD item; claimed Specs UI compliance contradicted by a listed deviation without justification.

Be explicit about satisfaction: if you can't write "I read every changed file in full and verified each AC against specific lines," go back and do it. No verdict on a partial review.

---

## Step 3 — Produce and post the verdict

Compose the verdict, then **post it to both the PR and the Jira Story** (autonomous — no "shall I post?").

### If approving (all blockers resolved, no critical warnings)

```
## Code Review — APPROVED — [date]   (AI-assisted back/infra/ops review)
PR: [link]   Story: [PROJ-XXX]
Lenses: ✅ Architecture ✅ Security ✅ Performance ✅ Infra/ops ✅ Code quality ✅ AC/DoD
Inferences flagged: [list each "assumed X because ADR §N" / none]
Warnings (follow-up, non-blocking): ⚠️ [..]
Approved. Ready for agile-11-merge-train / QA (skill 14).
```
- `gh pr review <N> --approve --body "<verdict>"`.
- Add the verdict as a `🤖 agile:phase=review` comment on the Story.
- Label the Story `dev-review-approved`. **Do not transition the Story.**

### If requesting changes (≥1 blocker)

```
## Code Review — CHANGES REQUESTED — [date]   (AI-assisted back/infra/ops review)
PR: [link]   Story: [PROJ-XXX]
Blockers (must fix before re-review):
❌ 1. [Lens] — [file:line] — [specific problem] — [suggested fix]
❌ 2. [Lens] — [specific problem] — [suggested fix]
Warnings (address after blockers): ⚠️ 3. [..]
Inferences flagged: [..]
```
- `gh pr review <N> --request-changes --body "<verdict>"`; where useful, attach inline comments on specific lines.
- Add the verdict as a `🤖 agile:phase=review` comment on the Story.
- Label the Story `dev-review-changes-requested`. **Do not transition the Story.**

Each blocker is **numbered** (so the caller can reference it), **specific** (file:line, not "security issue"), and **actionable** (what to change). Security findings are always blockers. Manual cloud-resource creation is always a blocker.

---

## Step 4 — Resume / re-review (scoped)

When re-invoked after fixes (the common case inside the `agile-10-implement` loop):
- Read only the new commits since the last `🤖 agile:phase=review` marker / prior review.
- Re-check **only the lenses that had blockers**, plus any file the fixes touched (fixes introduce new issues).
- Confirm each numbered blocker, referencing its original number:
```
Re-review — [date]   Checking [N] prior blockers:
❌ 1 → ✅ Resolved — [confirmation]
❌ 2 → ⚠️ Partially — [what remains]
```
- All resolved → approve (Step 3). Otherwise → changes requested with the remaining/new numbered blockers.

---

## Step 5 — Return / advise

**As a sub-skill:** the verdict block IS the return value — `agile-10-implement` reads approved vs changes-requested + the numbered blockers and acts. No extra prose needed.

**Standalone:**
```
✅ APPROVED → 👉 agile-11-merge-train (review+merge) then skill 14 (QA Validation).
   — or —
❌ [N] blockers → 👉 dev agent / agile-10-implement addresses them and re-invokes implement-review.
```

---

## Principles (apply every run)

- **Autonomous verdict, never a waiting question.** Infer from ADR/Specs/PRD and flag the inference; an unjustifiable non-obvious choice is a blocker, not a question. A run always ends in a verdict.
- **Six lenses, every PR** — never skip a lens.
- **Read every changed file in full** — the diff hides the surroundings where bugs live.
- **Read the Story before the diff** — otherwise the review measures the diff against itself, not the spec.
- **Blockers are numbered, located, and actionable.** A vague "security issue" is not a blocker.
- **Security is always a blocker; infra changes require IaC.** No security finding is downgraded to a warning.
- **Warnings never block a correct PR.** Style/quality nits are follow-up, not gates.
- **Post to both PR and Jira.** The verdict is a permanent artifact in both systems; the Story gets a `🤖 agile:phase=review` marker for the implement loop's resume logic.
- **Never transition the Story** — approval labels it, QA (skill 14) closes it.
- **Re-review is scoped** to the delta and the previously-failing lenses, not the whole PR from scratch.
- **Idempotent** — re-running on an already-approved PR reports the approval and advises next steps; it does not re-approve or duplicate comments.
- **Verdict prose stays in normal English** — it is read by humans at merge and retro time.
