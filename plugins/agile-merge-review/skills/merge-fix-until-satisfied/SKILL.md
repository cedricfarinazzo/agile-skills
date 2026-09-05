---
name: merge-fix-until-satisfied
description: "Fix every PR review issue, commit, push, re-check until satisfied. Triggers: fix all, fix everything, /fix-until-satisfied. After merge-review-pr."
---

# merge-fix-until-satisfied

Fix every issue from a PR review, commit, re-examine, repeat until satisfied. The `"Satisfied. No remaining issues."` verdict is the contract callers (`agile-11-merge-train` 3c) gate on.

**Input:** the issues from the current session (`merge-review-pr` output or an inline review). No review yet → run `merge-review-pr` first.

**Verification mode (0 issues) is valid usage, not a smell.** When the caller passes "0 issues", still run and still emit the verdict — never refuse with "nothing to do". Phase 1 becomes *opportunistic cleanup*: while re-reading the changed files, fix anything genuinely ugly you find.

**Cleanup threshold — obvious and low-risk only.** In scope: an unused import, a dead branch, a misleading name, copy-paste worth extracting (≥3 lines), a comment the code contradicts, a magic number that wants a named constant, an f-string SQL that wants bound params. Out of scope (file a follow-up ticket instead): a restructured class hierarchy, a new abstraction layer, splitting a module, renaming a public API, or touching any file the PR did not already modify. Unsure whether it is an improvement → leave it. The cleanup belongs in the PR being merged, not sprawled into adjacent code.

## Phase 1 — Fix

No review issues and nothing ugly spotted → skip to Phase 3. Otherwise, per issue (critical first, then minor):

1. **Read the full file before editing** — never edit from diff context alone.
2. Apply the fix.
3. **Grep for analogous sites.** Fixing a field name means grepping every test file for the old name; a wrong port in one docstring means checking its siblings. One fix, then the sweep.
4. Run the project's linter on the file (`ruff check`, `eslint`, `golangci-lint`, …). Markdown / YAML / TOML / JSON have no linter — just verify the file still parses.

**"Fix all" means fix all, including every Minor.** Minor is a severity, not permission to punt. The only acceptable skip is a fix that would expand the diff into files the PR did not already touch — file a follow-up inline and note it in the postmortem. Never declare Satisfied with unaddressed Minor findings on the report.

If a fix reveals a deeper problem, escalate and explain before proceeding.

## Phase 2 — Commit & push

No-op Phase 1 → skip to Phase 3. Otherwise group related fixes into one commit and separate unrelated ones. **Keep opportunistic cleanup separate from review-issue fixes**: `refactor(scope):` / `style(scope):` for cleanup, `fix(scope):` for review corrections.

```
fix(<scope>): <ticket> <imperative summary>

<body only if the why is non-obvious>
```

Then `git push origin <branch>` where `<branch>` is whatever HEAD is on (`git rev-parse --abbrev-ref HEAD`) — a PR feature branch, or `main` itself when the caller is fixing a post-merge follow-up.

**Confirm you are on the right branch BEFORE committing.** Your caller resolves one working location per PR and names it in your prompt — often a worktree that already holds the branch, because `agile-10-implement` leaves one per unmerged ticket. Work there by absolute path (`cd <path>`, `git -C <path>`; `EnterWorktree` commonly fails for a dispatched agent — expected, not a blocker) and check `git -C <path> rev-parse --abbrev-ref HEAD` matches the PR's branch. If it does not — most dangerously if it says `main` while you were asked to fix a PR — **stop and emit the receipt with `blocked`**; do not commit. "Whatever HEAD is on" is the push rule, not a licence to commit a PR's fixes wherever the shell happens to be pointing.

## Phase 3 — Re-examine

Re-read **every** file changed, in the original PR and in the fixes. Did a fix introduce something new (did every reference update)? Are there analogous issues in untouched files? Does the test-suite `CLAUDE.md` need updating?

## Phase 4 — Verdict

**Satisfaction is a multi-gate check, not a vibe.** Emit `"Satisfied. No remaining issues."` only when every gate below is provably green; any failure loops back to Phase 1.

**Do not poll or wait for CI.** Capture the latest run id **before** pushing (`gh run list --branch <branch> -L1 --json databaseId`), push, then emit the receipt immediately naming that pre-push run id and the pushed sha. Waiting for the post-push run is the **caller's** gate (`agile-11-merge-train` 3e); a poll loop here burns the whole step's budget and returns nothing.

1. **CI accounted for** — read the checks on branch HEAD **once** (`gh pr view <N> --json statusCheckRollup,mergeStateStatus`). A non-SUCCESS conclusion on a **pre-existing** run must be diagnosed and fixed here. An in-progress or not-yet-started run on the tip *you just pushed* is not a gate failure — record the pre-push id + pushed sha and hand off. One read, no loop.
2. **Lint clean** — the project linter exits 0 across all touched paths.
3. **All ACs satisfied** — walk the Jira ticket's AC list one by one; if you cannot point at a specific line, it is not satisfied.
4. **PR up to date with main** — `gh pr view <N> --json mergeable,mergeStateStatus` returns `mergeable: MERGEABLE` + `mergeStateStatus: CLEAN`. `BEHIND` / `DIRTY` / `CONFLICTING` → invoke `merge-update-pr` before declaring satisfaction.
5. **Implementation quality** — re-read the changed files (diff context is not enough): clean, DRY, no dead branches, no duplication worth extracting, no misleading names, no contradicted comments, no unused imports, no unnamed magic numbers. Anything surfacing here goes back through Phase 1.

**A DoD-vs-convention conflict is a labelled conscious accept, never a silent choice in either direction.** When a standing repo convention contradicts the ticket's DoD wording, follow the convention and record a `Conscious accept:` entry stating all five: what the DoD asks · what was done instead · why the convention wins · **where the equivalent-strength coverage actually lives** · that this was deliberate. It carries into the postmortem so the merge/QA reader signs off knowingly; unlabelled it reads later as a missed DoD item. `none` is a real value of that field, not an omission.

```
Satisfied. No remaining issues.
- CI: pre-push run <run-id>, pushed sha <sha> — caller gates the fresh run
- Lint: clean
- ACs: <N>/<N> verified against specific lines
- Conscious accept: <DoD asks X> → <did Y per convention Z>; equivalent coverage at <file:line>; deliberate   |   none
- Rebase: branch up to date with main, no conflicts
- Implementation: <one-line quality assessment>
```

Not satisfied → name which gate(s) failed and what blocks them, then loop back to Phase 1.

**Never end the turn without the verdict receipt, and never ask the caller a question** — blocked means emitting the receipt with a `blocked` field naming the blocker. The receipt is structured fields, written in normal English full sentences: the merge train reads it as the green light for merge, and it must stay unambiguous when read later.
