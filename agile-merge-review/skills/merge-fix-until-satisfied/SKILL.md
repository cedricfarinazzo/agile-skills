---
name: merge-fix-until-satisfied
description: "Fix every PR review issue, commit, push, re-check until satisfied. Triggers: fix all, fix everything, /fix-until-satisfied. After merge-review-pr."
---

# merge-fix-until-satisfied

Fix every issue from a PR review. Commit. Re-examine. Repeat until satisfied.

## Input

Issues from current session (from `merge-review-pr` output or inline review). If no review has been done, run `merge-review-pr` first.

**Verification mode (0 issues):** Also call this skill when the prior review reported 0 issues. Phase 1 (Fix) shifts to *opportunistic cleanup*: if while re-reading the changed files you spot something genuinely ugly — dead code, copy-paste duplication, awkward conditional that begs for a helper, misleading name, unused import, comment that contradicts the code — fix it. Phase 2 commits the cleanup under a clear `refactor(scope): ticket cleanup …` or `style(scope): ticket …` message. Phase 3/4 still run as the explicit satisfaction gate that authorises downstream actions (e.g. merge). Returning "Satisfied. No remaining issues." is the contract callers (like `agile-11-merge-train`) rely on.

**Threshold for opportunistic cleanup:** the change must be obvious and low-risk. If you're unsure whether it's an improvement (subjective style, broader refactor, touching code outside the PR's scope), leave it. The cleanup belongs in the PR being merged, not a sprawl into adjacent code.

In-scope examples (fix here): unused import, dead branch, misleading variable name, copy-paste 3+ lines worth extracting, contradicted comment, magic number → named constant, f-string SQL → parameterized query with bound params.

Out-of-scope examples (file follow-up ticket): restructured class hierarchy, new abstraction layer, splitting a module, renaming a public API, touching files the PR did not already modify.

## Steps

### Phase 1 — Fix (and opportunistic cleanup)

If no issues from review AND no ugly code spotted during re-read, skip to Phase 3.

For each issue (critical first, then minor):
1. Read the full file before editing — never edit from diff context alone
2. Apply the fix
3. Verify the fix doesn't break adjacent code (e.g. fixing a field name → grep all test files for the old name)
4. Run the project's linter on the file (e.g. `ruff check`, `eslint`, `golangci-lint`) — markdown / YAML / TOML / JSON: no linter, just verify the file still parses where applicable (e.g. `python -c "import yaml; yaml.safe_load(open('x.yml'))"`).

**Opportunistic cleanup (verification mode):** when re-reading the changed files (Phase 3) surfaces a low-risk, in-scope improvement, fix it here in Phase 1 alongside (or instead of) the review issues. The scope threshold and the in/out-of-scope example lists are in the Input section — apply them, don't restate them.

### Phase 2 — Commit & push

If Phase 1 was a no-op, skip to Phase 3.

Group related fixes into one commit if they're part of the same issue. Separate unrelated fixes. **Separate opportunistic cleanup from review-issue fixes** — use `refactor(scope): <ticket> <what>` or `style(scope): <ticket> <what>` for cleanup; reserve `fix(scope): <ticket> <what>` for review-issue corrections.

Commit message format:
```
fix(<scope>): <ticket> <imperative summary>

<body only if why is non-obvious>
```

Then `git push origin <branch>` — `<branch>` is the currently checked-out branch (verify with `git rev-parse --abbrev-ref HEAD`), which may be a PR feature branch or `main` itself when the caller is fixing a post-merge follow-up. Push wherever HEAD is.

### Phase 3 — Re-examine

After all fixes:
1. Re-read every file that was changed (both in the original PR and in the fixes)
2. Check: did the fix introduce anything new? (e.g. fixing a field name → did all references update?)
3. Check: are there analogous issues in untouched files? (e.g. if one test file had wrong port, check sibling test files)
4. Check: does the test-suite `CLAUDE.md` need updating for the fix?

### Phase 4 — Verdict

**Satisfaction is a multi-gate check, not a vibe.** Only emit `"Satisfied. No remaining issues."` when **every** gate below is provably green. If any gate fails, fix it (loop back to Phase 1) before declaring satisfaction.

**DO NOT poll or wait for CI.** Capture the latest run id **before** pushing (`gh run list --branch <branch> -L1 --json databaseId`), push, then emit the receipt immediately — naming the pre-push run id and the pushed sha. Waiting for the post-push run to complete is the **caller's** gate (`agile-11-merge-train` 3e), not this step's. Sitting in a poll loop here burns the whole step's budget and returns nothing; a run that was observed in this skill burned ~19 minutes polling and ended with no receipt at all.

Mandatory gates (all must pass):

1. **CI accounted for.** Read the checks on the branch HEAD **once** (`gh pr view <N> --json statusCheckRollup,mergeStateStatus`). A known-failing check must be diagnosed and fixed here — `UNSTABLE` or any non-SUCCESS conclusion on a **pre-existing** run = not satisfied. But an in-progress or not-yet-started run on the tip **you just pushed** is not a gate failure here: record the pre-push run id + pushed sha in the receipt and hand off. One read, no loop.
2. **Lint clean.** Project linter (`ruff check`, `eslint`, `golangci-lint run`, etc.) exits 0 across all touched paths.
3. **All ACs satisfied.** Every AC from the Jira ticket has a corresponding code site + test reference. Walk the AC list one by one; if you cannot point to a specific line that satisfies an AC, it is not satisfied.

   **DoD-vs-convention conflict → a labelled CONSCIOUS ACCEPT, never a silent choice.** When a standing repo convention conflicts with the ticket's DoD wording, do not silently follow either one. Follow the convention, and record a `Conscious accept:` entry in the receipt stating all five: what the DoD asks · what was done instead · why the convention wins · **where the equivalent-strength coverage actually lives** · that this is a deliberate decision, not an oversight. It carries into the postmortem so the merge/QA reader signs off on it knowingly. Real case: a story's DoD called for an end-to-end test against live data where the repo's own testing convention prescribes a deterministic seeded fixture for that class of test — and the PR's earlier review cycle had already rejected the live-data version as nondeterministic. Following the convention was right; leaving the deviation unlabelled would have read as a missed DoD item.
4. **PR up to date with main + no conflicts.** `gh pr view <N> --json mergeable,mergeStateStatus` returns `mergeable: MERGEABLE` + `mergeStateStatus: CLEAN`. If `BEHIND` / `DIRTY` / `CONFLICTING`, invoke `merge-update-pr` to rebase before declaring satisfaction.
5. **Implementation quality acceptable.** Re-read the changed files (mandatory — diff context is not enough). Code is clean, DRY, no dead branches, no copy-paste duplication ≥3 lines worth extracting, no misleading names, no contradicted comments, no unused imports, no magic numbers that should be named constants. If any of those surface, apply opportunistic cleanup (Phase 1) before declaring satisfaction.

Report format when satisfied:

```
Satisfied. No remaining issues.
- CI: pre-push run <run-id>, pushed sha <sha> — caller gates the fresh run
- Lint: clean
- ACs: <N>/<N> verified against specific lines
- Conscious accept: <DoD asks X> → <did Y per convention Z>; equivalent coverage at <file:line>; deliberate   |   none
- Rebase: branch up to date with main, no conflicts
- Implementation: <one-line quality assessment>
```

If not satisfied: list which gate(s) failed and what blocks them. Loop back to Phase 1.

## Rules

- Never mark satisfied if any Phase 4 gate is not green (CI / lint / ACs / rebase / quality). All five are mandatory.
- **Never poll or wait for CI.** Capture the pre-push run id, push, emit the receipt. The fresh-run gate belongs to the caller.
- **Never end the turn without the verdict receipt, and never ask the caller a question.** Blocked → emit the receipt with a `blocked` field naming the blocker. The receipt is structured fields only — no narrative.
- Always grep for analogous issues after fixing one (e.g. wrong port in one file → check all test docstrings)
- Linter must be clean before committing any source file
- **"Fix all" means fix all — including every Minor.** Minor severity does not mean "optional" or "punt to follow-up". If `merge-review-pr` reported it, fix it before declaring satisfaction. The only acceptable reason to skip a Minor is if applying the fix is genuinely out-of-scope (would expand the PR diff into files it did not already touch) — in which case file a follow-up ticket inline and note it in the postmortem. Never declare Satisfied with un-addressed Minor findings on the report.
- **A standing convention that conflicts with the DoD wording becomes a labelled conscious accept — never a silent deviation in either direction.** Follow the convention, record what the DoD asked, what was done instead, why the convention wins, where the equivalent-strength coverage lives, and that it is deliberate. `none` is a real value of that field, not an omission.
- If a fix reveals a deeper problem, escalate and explain before proceeding
- **Verification mode is valid usage, not a smell.** When the caller (e.g. `agile-11-merge-train` 3c) passes "0 issues" the skill must still emit the Satisfied verdict; do not refuse with "nothing to do".
- **Opportunistic cleanup allowed in verification mode** — see Input section. Low-risk, in-scope, files the PR already touches. Out-of-scope: file a follow-up ticket, do not expand the diff.
- **Skill output prose stays in normal English.** The Satisfied verdict + gate breakdown is consumed by the merge-train as the green light for merge — write in full sentences so the trace is unambiguous when read later.
