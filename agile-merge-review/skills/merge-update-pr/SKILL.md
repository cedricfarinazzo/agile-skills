---
name: merge-update-pr
description: "Rebase PR branch on main: merge --no-ff, resolve conflicts intelligently, lint-after-rebase gate, push only if merge commit created. Triggers: update pr, merge main into, /update-pr."
---

# merge-update-pr

Bring a PR branch up to date with main and push. Resolve conflicts by understanding both sides — never blindly take one.

**Input:** PR number or branch name from args; ask if neither is given.

## Steps

1. `git checkout main && git pull --ff-only`
2. Get on the branch: with a PR number prefer `gh pr checkout <N>` (handles fetch + tracking); with a branch name, `git fetch origin && git checkout <branch> && git pull origin <branch>`.
3. `git merge --no-ff main -m "chore: merge main into <branch>"` — the `-m` is consumed only if a merge commit is actually created. **Detect the outcome from stdout, not the exit code** (an auto-resolved merge also exits 0): `Already up to date.` vs `Merge made by the 'ort' strategy.` vs conflict markers.
4. **On conflicts:** `git diff --name-only --diff-filter=U`, then for each file read it, understand both sides, and write the semantically correct merge. **Never `git checkout --ours` / `--theirs` without reading both sides** — taking one side wholesale to make the conflict go away silently drops the other side's change.
   - Documentation tables (coverage tables, run-command sections) and append-only structures (dict/list literals, include lists, beat schedules, route tables): **keep every entry from both sides**, chronological order — earlier ticket first, matching merge order on `main`.
   - Genuinely ambiguous conflict → explain both sides and ask before resolving.
   - Then `git add <file>` and **`GIT_EDITOR=true git merge --continue`** — `git merge --continue` does not accept `--no-edit` and will hang on the editor in a non-interactive environment without it.
5. **Lint-after-rebase gate — mandatory whenever a merge commit was created**, including when conflicts auto-resolved cleanly: a textual merge leaves artifacts linters reject (a formatter collapsing a multi-line ternary, a duplicated import block). Run the linters/formatters covering the touched paths; the commands live in the consumer repo's `CLAUDE.md` / `AGENTS.md`.
   - **Run any lint the PR itself introduces, against the rebased tree.** Find it with `git diff main HEAD -- scripts/lint_*.py .github/workflows/*.yml`. Without this, a PR introducing a new lint passes its own pre-push CI on the original tree and then fails the first commit to `main` after merge — the rebase pulls in sibling-PR files the original sweep never touched.
   - If a formatter modified files, `git add` them and `GIT_EDITOR=true git commit --amend --no-edit` (the merge commit is unpushed, so amending is safe), then re-run to confirm clean.
6. `git push origin <branch>` — **skipped entirely on a no-op merge.**

## No-op merge (branch already on top of main)

When step 3 prints `Already up to date.`:

- **Do not push** — there is nothing new, and a push may falsely trigger CI re-runs.
- **Do not force an empty merge commit to "trigger CI".** The branch tree already matches what will land, so the existing run on branch HEAD is the canonical result. If the caller needs fresh CI on the exact tree, check `git merge-base --is-ancestor main <existing-CI-run-sha>`: exit 0 → branch HEAD contains all of main, the existing run covers the landable tree, proceed; exit 1 → contradicts the no-op signal and indicates a state-tracking bug, so investigate before proceeding.
- **Report the existing run's conclusion** (`gh pr view <N> --json statusCheckRollup,mergeStateStatus`) so the caller acts without another `gh run view`. A no-op rebase does **not** imply CI is green — the existing run may be `FAILURE`/`UNSTABLE`, and routing that into the fix loop instead of merging is the caller's job (`agile-11-merge-train` 3a).

## Report exactly one outcome

These status lines are what `agile-11-merge-train` 3a routes on, so write them as full sentences in normal English:

- **Pushed merge commit** — conflicts resolved (if any), new HEAD sha, fresh CI run expected.
- **No-op (already up to date)** — no commit, no push; name the existing CI run id, its conclusion, and its sha.
- **Conflict still open** — the unresolved files; halt, the caller must intervene.
