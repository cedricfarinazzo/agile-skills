---
name: merge-review-pr
description: "Deep PR review: read every changed file in full, check correctness/security/naming/tests/docs/ACs. Report by severity. Triggers: review pr, /review-pr. Use instead of /review for file-level depth."
---

# merge-review-pr

**Independent review of an open PR by someone other than its author** — the authoritative pre-merge gate before code lands on `main` (invoked by `agile-11-merge-train` 3b). The implementer already self-reviewed in `implement-review`; this is the second pair of eyes. Do not trust the author's self-assessment: verify against the spec and the ADR yourself. (The third layer, `agile-13-sprint-closeout`, reviews the whole sprint against its goal, not one PR.)

Reads every changed file in full — not just the diff — and reports findings by severity with a verifiable receipt. Under the merge train it runs in a dedicated subagent with a fresh context, and the orchestrator checks that receipt before the PR advances.

## Input

PR number from args; if absent, `gh pr list --state open` and ask.

**Delta mode** — the caller may pass `reviewed=<sha>` (the post-fix re-review at `agile-11-merge-train` 3f). Scope the read to `git diff <sha>..HEAD`: read **in full** every file that delta touches, re-verify every AC the delta affects, and report the new `headRefOid` as the reviewed sha. The already-reviewed remainder is not re-read; everything else here is unchanged.

## Steps

1. `gh pr view <N> --json title,body,headRefName,baseRefName,headRefOid,additions,deletions,changedFiles` — **record `headRefOid` as the reviewed sha.** A review is a statement about one tree; the caller gates the merge on this sha and re-dispatches you on the delta if the branch moved.
2. Extract the Jira key from `title` (`[ABC-123]`) or `headRefName` (`feature/ABC-123`); the prefix regex is per-repo config, default `[A-Z]+-\d+`. No key found → continue and apply the no-spec rule in step 4.
3. `gh pr diff <N>` for the full diff.
4. For every file in the diff, read the **full file at the reviewed sha** — `git show <headRefOid>:<path>`, **never from the working tree**. The checkout may be on another branch and concurrent work uses worktrees, so a working-tree read is a statement about the wrong tree. State the sha in the receipt.
5. Cross-reference against:
   - the project `CLAUDE.md` / `AGENTS.md` and the relevant sub-directory equivalents;
   - **the Jira ticket's ACs — the authoritative spec** (`mcp__atlassian__getJiraIssue` with the configured `cloudId`). The PR body's restatement may be stale; where they diverge, trust Jira and flag the divergence as Minor. **No Jira key and no PR-body ACs → Critical, block**: the PR has no spec to review against.
   - any `🤖 <!-- agile:spec-correction -->` comment on the ticket, read *with* the ACs and before the diff;
   - existing test files referencing changed code (field names, API contracts, ports).

## Review lenses (check all)

**Correctness**
- Wrong API usage (e.g. ORM `func.literal()` instead of `text()` for scalar server defaults); logic errors, wrong types, missing null handling; model ↔ migration ↔ test consistency.
- **`sys.modules` cleanup helpers using substring `in` match.** `if "X" in mod` matches any dotted path containing `"X"`, including unrelated neighbours — **Critical**: it silently tears down modules other tests depend on, producing order-dependent failures invisible in single-file local runs. Fix with `startswith()` against a tuple of full dotted prefixes, or exact equality.
- **A change labelled cosmetic / stylistic / "idiom alignment" that touches CONTROL FLOW still needs per-branch equivalence proof.** "Cosmetic" is a claim to check, not a reason to skip checking — e.g. replacing an early-`continue` guard with a conditional assignment: `continue` leaves the field at its existing default, the assignment sets it. Verify every branch agrees, including falsy / zero / absent edge values and any implicit default the old form relied on.
- **Hardcoded forward datetime fixtures in tests** are brittle (calendar libraries add bridge days; the date may leave the library's window in a future runner image). Minor — prefer helpers computed from a stable anchor.

**Security** — secrets hardcoded or logged; missing auth checks on endpoints; input unvalidated at system boundaries; SQL injection via f-string interpolation (require parameterised queries).

**Naming & conventions** — casing per project standard (GraphQL field names especially); explicit constraint names on PK/FK/Unique; file/function/variable naming per `CLAUDE.md`.

**Test coverage**
- **A negative / guard test must be proven to REACH the guard it names.** Mutation-grade (would it fail if the behaviour regressed?) is necessary but not sufficient: the input must not be rejected by an **earlier** layer — field length/precision, type coercion, nullability, referential integrity, a framework validator, an upstream schema check. A test asserting a storage constraint rejects a bad value, whose input already violates the column width, is rejected before the constraint ever evaluates. Require each negative assertion to state **which named guard it provably trips** and **why no earlier layer can reject the input first**. A test that passes for the wrong reason is the same defect as one that fails for the wrong reason — it just ships.
- Every AC has a corresponding test; test-docstring connection details match the testing stack; teardown leaks nothing between runs; no stale field names after a rename.
- **Env-gated tests must still be import-clean.** Tests behind feature flags skip at runtime, but their imports and name references execute at collection time — a missing import or undefined name is a Critical bug masked by the gate.
- **Router/auth-guard introduction cascade.** If the PR adds routing guards or redirect-on-mount logic, grep existing E2E tests for navigation patterns that may now redirect unexpectedly — each stale DOM assertion is Critical.

**PR description claims — the body is part of the artifact under review.** It is a *claim about the diff*, not evidence; a claim contradicted by the diff is a finding and a fabricated one is Critical.
- **AC-coverage table:** open the test file each row cites and confirm the test exists and exercises what the row claims. A row citing a missing file, a test name not in it, or a test containing none of the claimed calls → **Critical**. (This lens produced the strongest finding in a real review pass.)
- **Test-tier / checklist claims** — "integration test added", "e2e updated", "migration tested" — must each trace to a changed file. A ticked box with nothing behind it → **Critical**.
- **Files/scope claims** describing changes the diff lacks, or omitting a file it changes → Minor, or Critical if it hides a risky change.

**Corrected ACs — review against the correction, not the stale wording.** An AC can be wrong: it names a file, test, or symbol that does not exist, or pins a different component's state than it describes. The implementer must post a `🤖 <!-- agile:spec-correction -->` comment (evidence + real reference + intent) and satisfy the AC **by intent**.
- **Fetch spec-correction comments with the ACs** and verify each affected AC against the *corrected* reading. A diff matching the intent but not the stale literal wording is **correct** — flagging it as a missing AC is a false Critical, and a reviewer holding stale text is exactly how a correct PR gets blocked.
- **A deviation with no posted correction is Critical** — the correction exists only in the author's head, so nobody can check it. The fix is to post it with evidence, not to rewrite the code.
- **Check the correction itself.** It carries evidence (`path:line`, a command result, a grep hit); verify that evidence and that the corrected target is really what the AC meant. A correction is a claim about the spec and gets the same scrutiny as a claim about the diff — wrong or unevidenced → Critical.
- **Report it either way:** each corrected AC's binding names the correction comment alongside its `file:line`, so the postmortem records that ticket text and delivered behaviour diverged. That is the signal refinement needs.

**Documented invariants & conventions — a review axis, not a doc nit.** Review the diff against the ACs, the out-of-scope section, **and the invariants/conventions it touches** (root + subfolder `CLAUDE.md` / `AGENTS.md`, architecture docs). **A change that makes a documented invariant FALSE is a defect even when the code is correct.** Three shapes, all seen in one run:
- a **silently-widened invariant** — the diff widened the effective key of a documented invariant without updating the doc, so the stated invariant is now false;
- a **limitation comment that outlived its limitation** — the ticket that removes a limitation must remove or rewrite the "KNOWN LIMITATION" comment naming it;
- a **new domain concept with no conventions entry** though every sibling story's concept has one.

Verify a documentation entry **accurate against the shipped code**, not merely present — a confidently-worded wrong entry is worse than none.

**Documentation** — test-suite `CLAUDE.md` updated (structure tree, coverage table, run command); backend/frontend `CLAUDE.md` updated if a new convention was established; AC text not stale.

**Migrations (where applicable)** — `server_default` uses `text()` not `func.literal()`; drop order is the reverse of create order; FK targets schema-qualified where multiple schemas exist; time-series/hypertable creation order vs the base table.

**Lint-rule introduction cascade** — **a PR that introduces a new lint rule (regex change, new lint script, tightened threshold) must sweep every file the rule covers, including files sibling PRs added since the sweep was authored.** Rebase pulls those into the tree, but the sweep was written against an older snapshot. Verify on the rebased tree with `grep -rn '<old-pattern>' <target-paths>`; any hit is **Critical** — left unfixed, the first commit to `main` after merge fails CI. (Real case: a `PYTEST-SKIP → pytest-skip` marker rename shipped without re-running the lint after rebase pulled in a sibling PR's test file using the old marker, breaking main-CI.) Also check what the PR itself adds — `git diff main HEAD -- scripts/lint_*.py .github/workflows/*.yml` — and run any new lint script locally against the rebased tree.

## Output format

**No preamble, no Overview/Summary section, no praise section** — they prove nothing, the caller verifies nothing with them, and the orchestrator pays for them in context. Open on the fields. Prose belongs *inside* a finding and inside a per-AC binding: that is where it is the value, since a finding compressed to a label cannot be acted on.

```
## PR #<N> Review — [title]

Reviewed sha: <headRefOid>   (delta-review only: reviewed `<old-sha>..<new-sha>`)

### Files read in full
- `path/a.py` (123 lines)
- `path/b.md` (45 lines)

### Lens verdicts (one line per lens — cite or N/A)
- Correctness ...... ✅ `file:line` <what confirmed>  |  ❌ see Critical
- Security ......... ✅ `file:line`  |  N/A because <no new endpoint/input>
- Naming/conventions ✅ `file:line`
- Corrected ACs ..... <AC<N> → correction comment verified>  |  N/A no corrections
- Invariants/conv. .. ✅ <invariant touched → still true at `doc:line`>  |  N/A none touched
- Test coverage .... ✅ `file:line`
- PR-body claims ... ✅ <each AC row / tier claim traced to a changed file>  |  ❌ see Critical
- Documentation .... ✅ `file:line`  |  N/A
- Migration ........ N/A  |  ✅ `file:line`

### AC verification (every AC → the line that satisfies it)
- AC1 → `file:line` <how satisfied>      (an AC with no line = not satisfied = Critical)

### Critical
- **<short title>** (`file:line`): <problem> → <fix>

### Minor
- **<short title>**: <problem> → <fix>
```

**The caller verifies this receipt — it is not a self-attestation.** Four fields make a shallow review impossible to hide: the **reviewed sha** (and the sha every file was read at); **Files read in full** (rejected if ≠ `gh pr diff <N> --name-only`; a partial `offset`/`limit` read does not count); **lens verdicts** (a bare ✅ with no citation is rejected — you cannot pass a lens without pointing at what you checked); **AC verification** (every AC → a `file:line`, in the clean path too).

Two-tier severity is deliberate — no "Moderate"/"Suggestion"/"Nit". Promote a borderline item to Minor or omit it; the absent third bucket forces a yes/no call.

No issues found → state "Satisfied — ready to merge." and why. The Files-read, Lens-verdicts, and AC-verification sections are still mandatory: **a clean verdict with no evidence is a rubber-stamp and is re-dispatched.**

**Review-only — this skill does not merge, monitor CI, or close the loop.** Return after the report; the caller continues to 3c (`merge-fix-until-satisfied`) → 3e (CI) → 3f (merge) → 3g (`merge-jira-postmortem`). Never append "should I merge now?".

## Severity calls

| Finding | Severity |
|---|---|
| Wrong `server_default` pattern (causes ORM autogenerate drift) | Critical |
| Schema ↔ test field-name mismatch | Critical |
| A documented invariant or convention the diff makes false | Critical |
| Stale AC text | Minor |
| Missing run command in the test-suite `CLAUDE.md` | Minor |
| Project-structure tree drift (new file, tree not updated — helpers too, not just tests) | Minor |

**Cross-PR file overlap is a review signal, not a finding.** If the diff touches a file other open PRs also touch, report it as a `Cross-PR overlap:` field (the file + the other PR/ticket) so the postmortem can record the Jira-link recommendation.

Never report an issue without a specific fix. **Report prose stays in normal English** — it is a permanent record read later by the merge train, the postmortem, and humans in Jira.
