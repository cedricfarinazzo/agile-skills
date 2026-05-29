---
name: dev-update-pr
description: "Rebase PR branch on main: merge --no-ff, resolve conflicts intelligently, lint-after-rebase gate, push only if merge commit created. Triggers: update pr, merge main into, /update-pr."
---

# dev-update-pr

Update a PR branch with latest main and push. Resolve conflicts intelligently — never blindly accept one side.

## Input

PR number or branch name from args. If not given, ask.

## Steps

1. `git checkout main && git pull --ff-only`
2. Identify branch: if PR number given, prefer `gh pr checkout <N>` (handles fetch + tracking automatically). If branch name given directly: `git fetch origin && git checkout <branch> && git pull origin <branch>`.
3. `git merge --no-ff main -m "chore: merge main into <branch>"`
   - The `-m` arg is consumed only if a merge commit is actually created. When stdout is `Already up to date.`, no commit is made and `-m` is silently discarded.
   - Verify which case occurred by inspecting stdout (`Already up to date.` vs `Merge made by the 'ort' strategy.` vs conflict markers).

### No-op merge handling (branch already on top of main)

If step 3 prints `Already up to date.` (no new commits to integrate, no merge commit created):

- **Do not push.** There is nothing new to push; pushing would be a no-op and may falsely trigger CI re-runs depending on hook config.
- **Do not force an empty merge commit just to trigger CI.** The branch tree already matches what would land. If a caller (e.g. `dev-merge-train` 3e) needs fresh CI on the exact tree, check whether the existing CI run on the branch HEAD is still valid:
  - Verify with `git merge-base --is-ancestor main <existing-CI-run-sha>` (does the branch HEAD contain all of main?):
    - Exit 0 → branch HEAD is a descendant of (or equal to) main; existing CI on this sha covers the landable tree; proceed.
    - Exit 1 → branch is behind main (impossible if step 3 said "Already up to date" — would indicate a state-tracking bug; investigate before proceeding).
- **Report explicitly** in the final status, including the existing run's conclusion so callers can act without an extra `gh run view`:
  `Already on top of main — no merge commit, no push. Existing CI run <id> (<conclusion>, sha <sha>) covers the tree that will land.`
  Fetch the conclusion with `gh pr view <N> --json statusCheckRollup,mergeStateStatus`. A no-op rebase does NOT imply CI is green — the existing run may be `FAILURE` / `UNSTABLE`. Caller (e.g. `dev-merge-train` 3a) is responsible for routing red CI into the fix loop instead of merging.

4. If conflicts:
   - `git diff --name-only --diff-filter=U` to list conflicting files
   - For each conflict: read the file, understand both sides, resolve with correct merged content
   - Common pattern: two branches each added a row to a documentation table → keep both rows, chronological order (earlier ticket first)
   - Append-only config (dict literals, include lists, beat schedules, route tables): keep all entries, chronological order matching merge order on `main`
   - After resolving: `git add <file>` then **`GIT_EDITOR=true git merge --continue`** — `git merge --continue` does NOT accept `--no-edit`; without `GIT_EDITOR=true` it will hang on the commit-message editor in non-interactive environments
4.5. **Lint-after-rebase gate (mandatory whenever a merge commit was created).** Even when conflicts auto-resolved cleanly, the textual merge can leave artifacts the linters/formatters reject (e.g. a formatter collapsing a multi-line ternary, a linter catching a duplicated import block). Run the linters/formatters that cover the touched paths before pushing. Project-specific commands belong in the consumer repo's `CLAUDE.md` / `AGENTS.md`; typical patterns:
   - Frontend touched → run the project's formatter + linter (e.g. `bun run format && bun run lint`, `npm run lint`, `prettier --write && eslint`).
   - Backend / shared touched → run the project's linter (e.g. `ruff check`, `flake8`, `golangci-lint run`).
   - **Project-specific lints introduced by the PR itself must also run.** Inspect the rebased tree for any new lint script added by the same PR (e.g. `scripts/lint_<name>.py` referenced from `.github/workflows/ci.yml`). Run those too, against the same paths CI will run them against. Without this, a PR that introduces a new lint can pass its own pre-push CI on the original tree but fail the first commit to `main` after merge — the rebase pulls in files added by sibling PRs that the lint sweep never touched. Verify with `grep -l "lint_" .github/workflows/*.yml` + `git diff main HEAD -- scripts/lint_*.py` to find new lint scripts in scope.
   - If the formatter/linter modifies files, `git add` them and amend the merge commit with `GIT_EDITOR=true git commit --amend --no-edit` (the merge commit is unpushed; amending it here is safe). Re-run the linter to confirm clean.
5. `git push origin <branch>` — skip if step 3 was a no-op merge (see above)
6. Report one of three outcomes:
   - **Pushed merge commit** — list conflicts resolved (if any), new HEAD sha, expect fresh CI run
   - **No-op (already up to date)** — no commit, no push; reference the existing CI run id covering the current tree
   - **Conflict still open** — list unresolved files, halt; caller must intervene

## Conflict resolution principles

- Never blindly `git checkout --ours` or `--theirs` without reading both sides
- For documentation tables (coverage tables, run-command sections): always keep both sides' additions
- For append-only code structures (dict literals, list literals, include lists): keep all entries; order chronologically by merge time
- For code conflicts: understand what each side changed and produce the semantically correct merge
- If conflict is ambiguous: explain both sides and ask before resolving
- Always `GIT_EDITOR=true git merge --continue` — `--no-edit` is not a valid arg to `git merge --continue`
- **Never force an empty merge commit to "trigger CI".** If the branch is already on top of main, the existing CI run on branch HEAD is the canonical result; reference it instead of churning the history.
- **Detect no-op via `git merge` stdout containing `Already up to date.`** — do not rely on exit code alone (a successful merge with conflicts that auto-resolved also exits 0).
- **Lint-after-rebase is mandatory whenever a merge commit was created.** Even on auto-resolved conflicts — the textual merge can leave formatter-rejected artifacts. See step 4.5.
- **PR-introduced lints run after rebase too.** A PR introducing a new lint rule must re-run that lint against the rebased tree, not just the pre-rebase one. Sibling PRs that landed during the same sprint may have added files in the lint's target paths that the original sweep never saw — without re-running, those files become a silent CI fail-on-master after merge. See step 4.5 inner bullet.
- **Skill output prose stays in normal English.** Status lines (Pushed merge commit / No-op / Conflict still open) are consumed by `dev-merge-train` 3a to route to the correct next step — full sentences keep that trace unambiguous.
