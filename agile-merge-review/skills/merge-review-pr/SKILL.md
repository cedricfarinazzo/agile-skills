---
name: merge-review-pr
description: "Deep PR review: read every changed file in full, check correctness/security/naming/tests/docs/ACs. Report by severity. Triggers: review pr, /review-pr. Use instead of /review for file-level depth."
---

# merge-review-pr

**Independent review of an open PR by someone other than the author.** The implementer already self-reviewed and fixed the obvious in `implement-review`; this is the *second pair of eyes* — the authoritative pre-merge gate before the PR lands on `main` (invoked by `agile-11-merge-train` 3b). Review as a reviewer who did not write the code: don't trust the author's self-assessment, verify against the spec and the ADR yourself. (The third layer, `agile-13-sprint-closeout`, is a later *global* review of the whole sprint against its goal — not this per-PR gate.)

Thorough PR review. Reads every changed file in full — not just the diff. Reports findings grouped by severity, with a verifiable receipt (Files-read = diff set, a cite per lens, a `file:line` per AC). When invoked by `agile-11-merge-train`, this runs in a **dedicated subagent with a fresh context** — it did not write the code and cannot rubber-stamp it, and its receipt is checked by the orchestrator before the PR advances.

## Input

PR number from args. If not given, run `gh pr list --state open` and ask.

**Delta mode.** The caller may pass a previously-reviewed sha (`reviewed=<sha>`) — the post-fix re-review at `agile-11-merge-train` 3f. Then scope the read to `git diff <sha>..HEAD`: read **in full** every file that delta touches (not only its hunks), re-verify every AC the delta claims to affect, and report the new `headRefOid` as the reviewed sha. The already-reviewed remainder of the diff is not re-read. Everything else in this skill is unchanged — same lenses, same receipt, same severity rules.

## Steps

1. `gh pr view <N> --json title,body,headRefName,baseRefName,headRefOid,additions,deletions,changedFiles` — **record `headRefOid` as the reviewed sha.** A review is a statement about one tree; the caller gates the merge on this sha (`agile-11-merge-train` 3f) and re-dispatches you on the delta if the branch moved after you read it.
2. Extract Jira key from `title` (e.g. `[ABC-123]`) or `headRefName` (e.g. `feature/ABC-123`). Project ticket-prefix regex is configurable per consumer repo — defaults to `[A-Z]+-\d+`. Record for step 4. If no key found, do not abort yet — continue, and apply the "no spec" rule in step 4.
3. `gh pr diff <N>` — read full diff
4. For every file in the diff: read the **full file** (not just the changed hunks). Diffs hide context.
5. Cross-reference against:
   - Project `CLAUDE.md` / `AGENTS.md` and relevant sub-directory equivalents
   - **Jira ticket ACs (authoritative source)** — fetch via `mcp__atlassian__getJiraIssue` using the key from step 2 + the consumer repo's configured `cloudId`. The ticket is the spec; the PR body's restatement may be stale.
   - PR body ACs as a secondary check — if PR body ACs diverge from Jira, flag the divergence as a minor finding; trust Jira.
   - If step 2 yielded no Jira key AND PR body has no ACs: flag as critical — PR lacks a spec, cannot be reviewed against intent. Block.
   - Existing test files that may reference changed code (field names, API contracts, ports)

## Review lenses (check all)

**Correctness**
- Wrong API usage (e.g. ORM `func.literal()` instead of `text()` for scalar server defaults)
- Logic errors, wrong types, missing null handling
- Model ↔ migration ↔ test consistency
- **`sys.modules` cleanup helpers using substring `in` match.** `if "X" in mod` against `sys.modules` keys matches any module dotted-path containing `"X"` — including unrelated neighbours. This is a **critical** bug: silently tears down modules other tests depend on, producing order-dependent failures invisible in single-file local runs. Fix: replace substring `in` with `startswith()` against a tuple of full dotted prefixes, or with exact equality.
- **Hardcoded forward datetime fixtures in tests.** Tests pinning specific calendar dates are brittle — calendar libraries may add bridge days, the date may fall outside the library's calendar window in a future runner image, etc. Minor finding. Prefer helpers computed relative to a stable anchor.

**Security**
- Secrets hardcoded or logged
- Missing auth checks on endpoints
- Input not validated at system boundaries
- SQL injection via f-string interpolation (require parameterized queries)

**Naming & conventions**
- Casing conventions (snake_case vs camelCase) per project standard — GraphQL field name conventions especially
- Explicit constraint names on PK/FK/Unique
- File/function/variable naming per project `CLAUDE.md`

**Test coverage**
- Every AC has a corresponding test
- Connection details in test docstrings match the testing stack (DB port, broker port, etc.)
- Test data teardown — no leaks between test runs
- Stale field name references after a rename
- **Env-gated tests must still be import-clean.** Tests behind feature flags skip at runtime but their imports + name references still execute at collection time. Missing imports, undefined names, etc. are critical bugs masked by the gate.
- **Router/auth-guard introduction cascade.** If the PR adds routing guards or any redirect-on-mount logic, grep existing E2E tests for navigation patterns that may now redirect unexpectedly. Each is a critical finding — DOM assertions become stale.

**PR description claims — the PR body is part of the artifact under review**
- The PR body is a **claim about the diff**, not evidence. Verify each claim against the changed files; a claim contradicted by the diff is a finding, and a **fabricated** one is Critical.
- **AC-coverage table:** for every row, open the test file it cites and confirm the test that covers that AC actually exists and exercises it. A row citing a test file that does not exist, a test name not in that file, or a test that contains none of the calls the row claims → **Critical**.
- **Test-tiers / checklist claims:** "integration test added", "e2e updated", "migration tested" must each be traceable to a changed file. A ticked box with nothing in the diff behind it → **Critical**.
- **Files/scope claims:** a body describing changes the diff does not contain (or omitting a file the diff does change) → Minor, or Critical if it hides a risky change.
- This lens caught the strongest finding in a real review pass: an AC-coverage table crediting a test file that contained none of the calls it claimed.

**Documentation**
- Test-suite `CLAUDE.md` updated: project structure tree, coverage table, run command section
- Backend / frontend `CLAUDE.md` updated if a new convention was established
- AC text not stale (e.g. referencing deleted files)

**Migration-specific (if applicable to project)**
- `server_default` uses `text()` not `func.literal()` for scalar values
- Drop order is reverse of create order
- FK targets schema-qualified where multiple schemas exist
- Time-series / hypertable creation order vs base table

**Lint-rule introduction cascade**
- **A PR that introduces a new lint rule (regex change, new lint script, tightened threshold) must sweep every file the rule covers — including files added by sibling PRs since the sweep was authored.** Rebase brings sibling-PR files into the tree but the original sweep was written against an older snapshot. Verify with: `grep -rn '<old-pattern>' <target-paths>` on the rebased tree, where `<old-pattern>` is the syntax the new rule rejects (e.g. for a marker rename: grep the old marker name). Any hit is a Critical finding — left unfixed, the first commit to `main` after merge will fail CI on that file. Real example: a "PYTEST-SKIP → pytest-skip" marker rename PR shipped without re-running the lint after rebase pulled in a sibling PR's new test file using the old marker, breaking main-CI.
- **Look for new lint scripts the PR itself adds**: `git diff main HEAD -- scripts/lint_*.py .github/workflows/*.yml` reveals new lint scripts wired into CI. Run them locally against the rebased tree.

## Output format

**No preamble, no Overview/Summary section, no "Good"/praise section.** They prove nothing, the caller verifies nothing with them, and the orchestrator pays for them in context. Open on the fields. Prose belongs *inside* a finding and inside a per-AC binding — that is where it is the value: a finding compressed to a label cannot be acted on, so give each one the sentence or two it needs (what is wrong, why it matters, the fix).

```
## PR #<N> Review — [title]

Reviewed sha: <headRefOid>   (delta-review only: reviewed `<old-sha>..<new-sha>`)

### Files read in full
- `path/a.py` (123 lines)
- `path/b.md` (45 lines)
- ...

### Lens verdicts (one line per lens — cite or N/A)
- Correctness ...... ✅ `file:line` <what confirmed>  |  ❌ see Critical
- Security ......... ✅ `file:line`  |  N/A because <no new endpoint/input>
- Naming/conventions ✅ `file:line`  |  ...
- Test coverage .... ✅ `file:line`  |  ...
- PR-body claims ... ✅ <each AC-table row / tier claim traced to a changed file>  |  ❌ see Critical
- Documentation .... ✅ `file:line`  |  N/A
- Migration ........ N/A  |  ✅ `file:line`

### AC verification (every AC → the line that satisfies it)
- AC1 → `file:line` <how satisfied>
- AC2 → `file:line`
- ...   (an AC with no line = not satisfied = a Critical finding)

### Critical
- **<short title>** (`file:line`): <problem> → <fix>

### Minor
- **<short title>**: <problem> → <fix>
```

**The receipt is verified by the caller (`agile-11-merge-train` 3b) — it is not just a self-attestation.** Four mandatory fields make a shallow review impossible to hide:
- **Reviewed sha** — the branch tip you actually read. The caller gates the merge on it: a tip that moved after your review is unreviewed code and comes back to you.
- **Files read in full** — every file in the PR diff with its line count. The caller computes `gh pr diff <N> --name-only` and **rejects the review if this list ≠ the diff set**. A partial read (`Read offset=155 limit=12`) does NOT count — only a full-file read. If a file is not listed, the review is incomplete; read it before reporting.
- **Lens verdicts** — a line per lens, each with a `file:line` cite or an explicit "N/A because …". A bare ✅ with no citation is rejected: you can't pass a lens without pointing at what you checked.
- **AC verification** — every AC → the specific `file:line` that satisfies it, in **both** the clean and the has-findings path. "If you can't point to a line, the AC is not satisfied." An AC with no line cite is rejected.

Two-tier severity is deliberate. No "Moderate" / "Suggestion" / "Nit" tiers — promote borderline items to Minor or omit them. Avoiding a third bucket forces a yes/no call.

If no issues: explicitly state "Satisfied — ready to merge." and why — but the Files-read, Lens-verdicts, and AC-verification sections are still mandatory (a clean verdict with no evidence is a rubber-stamp, and is re-dispatched).

**This skill is review-only — it does NOT merge, monitor CI, or close the loop.** When invoked standalone, return after the report. When invoked from `agile-11-merge-train` 3b, the caller continues to 3c (`merge-fix-until-satisfied`) → 3e (CI) → 3f (merge) → 3g (postmortem). Do not append "should I merge now?" prompts; the caller decides.

## Rules

- Read every changed file in full before reporting
- **Review the PR description too — it is part of the artifact.** Every AC-table row, test-tier claim, and ticked checklist box is verified against the diff. A cited test that does not exist (or does not exercise what the row claims) is Critical, not a doc nit.
- Never report an issue without a specific fix
- Stale ACs count as minor, not critical
- Missing run command in test-suite `CLAUDE.md` counts as minor
- Wrong `server_default` pattern counts as critical (causes ORM autogenerate drift)
- Field name mismatch between schema and tests counts as critical (causes test failures)
- **Project Structure tree drift counts as minor.** New file in a `CLAUDE.md`-documented folder but tree not updated → minor finding. The self-improvement loop rule ("new file → update tree") applies to non-test helpers too, not just test files.
- **Cross-PR file overlap is a review signal.** If review notices the diff touches a file that other open PRs also touch, report it as a `Cross-PR overlap:` field (the file + the other PR/ticket) so the postmortem can record the Jira-link recommendation.
- **Review report prose stays in normal English.** The report is a permanent record consumed by the merge-train, postmortem skill, and reviewers reading it later in Jira. Write the report as you would for a code-review comment on GitHub.
- **A PR introducing a new lint rule must re-sweep the rebased tree, not just the pre-rebase one.** See the "Lint-rule introduction cascade" lens above. Any old-syntax hit on a file that the rebase pulled in is a Critical finding.
