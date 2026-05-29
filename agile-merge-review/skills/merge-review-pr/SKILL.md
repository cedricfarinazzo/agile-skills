---
name: merge-review-pr
description: "Deep PR review: read every changed file in full, check correctness/security/naming/tests/docs/ACs. Report by severity. Triggers: review pr, /review-pr. Use instead of /review for file-level depth."
---

# merge-review-pr

**Independent review of an open PR by someone other than the author.** The implementer already self-reviewed and fixed the obvious in `implement-review`; this is the *second pair of eyes* — the authoritative pre-merge gate before the PR lands on `main` (invoked by `agile-11-merge-train` 3b). Review as a reviewer who did not write the code: don't trust the author's self-assessment, verify against the spec and the ADR yourself. (The third layer, `agile-13-sprint-closeout`, is a later *global* review of the whole sprint against its goal — not this per-PR gate.)

Thorough PR review. Reads every changed file in full — not just the diff. Reports findings grouped by severity.

## Input

PR number from args. If not given, run `gh pr list --state open` and ask.

## Steps

1. `gh pr view <N> --json title,body,headRefName,baseRefName,additions,deletions,changedFiles`
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

```
## PR #<N> Review — [title]

### Overview
<2-3 sentences: what it does>

### Files read in full
- `path/a.py` (123 lines)
- `path/b.md` (45 lines)
- ...

### Critical
- **<short title>** (`file:line`): <problem> → <fix>

### Minor
- **<short title>**: <problem> → <fix>

### Good
- <what was done correctly>
```

The "Files read in full" section is mandatory — it is a self-receipt that the skill's core rule ("read every changed file in full") was honoured. List every file in the PR diff with its line count. If a file is not listed, the review is incomplete; go back and read it before reporting. Partial reads (e.g. `Read offset=155 limit=12`) do NOT count — only a full-file Read does. This is the easiest rule to silently violate; the receipt makes the violation impossible to hide.

Two-tier severity is deliberate. No "Moderate" / "Suggestion" / "Nit" tiers — promote borderline items to Minor or omit them. Avoiding a third bucket forces a yes/no call.

If no issues: explicitly state "Satisfied — ready to merge." and why.

**This skill is review-only — it does NOT merge, monitor CI, or close the loop.** When invoked standalone, return after the report. When invoked from `agile-11-merge-train` 3b, the caller continues to 3c (`merge-fix-until-satisfied`) → 3e (CI) → 3f (merge) → 3g (postmortem). Do not append "should I merge now?" prompts; the caller decides.

## Rules

- Read every changed file in full before reporting
- Never report an issue without a specific fix
- Stale ACs count as minor, not critical
- Missing run command in test-suite `CLAUDE.md` counts as minor
- Wrong `server_default` pattern counts as critical (causes ORM autogenerate drift)
- Field name mismatch between schema and tests counts as critical (causes test failures)
- **Project Structure tree drift counts as minor.** New file in a `CLAUDE.md`-documented folder but tree not updated → minor finding. The self-improvement loop rule ("new file → update tree") applies to non-test helpers too, not just test files.
- **Cross-PR file overlap is a review signal.** If review notices the diff touches a file that other open PRs also touch, flag in the "Good" / "Notes" section so the postmortem can record the Jira-link recommendation.
- **Review report prose stays in normal English.** The report is a permanent record consumed by the merge-train, postmortem skill, and reviewers reading it later in Jira. Write the report as you would for a code-review comment on GitHub.
- **A PR introducing a new lint rule must re-sweep the rebased tree, not just the pre-rebase one.** See the "Lint-rule introduction cascade" lens above. Any old-syntax hit on a file that the rebase pulled in is a Critical finding.
