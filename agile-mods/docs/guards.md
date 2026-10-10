# Guards

[← agile-mods](../README.md)

Shown on the console's Guards tab (`/agile-board guards`) · always active · code: `hooks/guards.ts`, checks in `hooks/state/guards.ts` and `hooks/state/review.ts`

Rules the skills state in prose, enforced on the call that would break them. A refused call returns an error to the model that names the rule and what to do instead, so the loop corrects itself rather than stalling.

**A guard never takes the model's word.** What it checks comes from GitHub, git or the engine at the moment of the call: the PR's live head, the CI runs on that sha, the files of the PR, the commands a reviewer actually ran, the type of the agent making the call. No receipt, answer, banner or report line the model writes turns a guard on, off, or green.

| Rule (where the prose lives) | Enforcement |
|---|---|
| `review-lens` and `pr-reviewer` never edit or post; `review-lens` never invokes `implement-review` (CLAUDE.md, tool grants) | A call from inside that agent's loop to `Write`/`Edit`/`NotebookEdit`, a posting GitHub or Atlassian MCP tool (matched by tool name on any server), `gh pr comment/review/merge/edit`, `gh issue comment/…`, `gh api -X POST/PATCH/PUT/DELETE` or `git push` is refused |
| `jira-postmortem` never creates issue links | `createIssueLink` from that agent is refused |
| 3f merge gates (`agile-11-merge-train` 3b, 3e and 3f) | `gh pr merge <n>` / `merge_pull_request` is refused unless, read at that moment: the head is pinned (`--match-head-commit <sha>` / `expectedHeadSha`); the pin is the PR's live head (`gh pr view <n>`); every workflow run on that sha finished `success`, `skipped` or `neutral`, with at least one `success` (`gh run list --commit <sha>`); and every file of the PR (`gh api …/pulls/<n>/files`) was read by a reviewer as it lands (below) |
| A PR's 3c fix loop stops after 3 rounds (`agile-11-merge-train` Stop conditions) | A `fix-until-satisfied` dispatch (or `merge-fix-until-satisfied` inline) is refused when 3c already ran on 3 other heads of that PR, read with `gh pr view <n>` at each dispatch and kept across train runs. A re-dispatch on a head already counted passes. A dispatch that names no PR, or a PR gh cannot read, is refused |
| No new build work past the budget (`agile-10-implement` and `agile-sprint-drain`, BUDGET) | With the `budgetUsd` option set, once the loop's spend (the engine's cost ledger, counted while a loop runs) reaches it, `agile-10-implement`, `implement-validate` and a `ticket-validator` dispatch are refused. Tickets in flight finish and open PRs still merge |
| Work reaches the base branch only through a PR; force push only with a lease (`agile-11-merge-train` Rules) | A `git push` to `main`/`master` (by refspec, or with none from a checkout of it, read with `git rev-parse`), a push whose target is computed (`$BRANCH`, `$(…)`), and `--force` / `-f` / `--mirror` are refused; `--force-with-lease` passes |

**When a guard is on.** The merge, push and fix-round guards turn on with the orchestrator's `Skill` call (`agile-10-implement`, `agile-11-merge-train`, `agile-sprint-drain`) and stay on until `/agile-board reset` or a new session. Inside an `agile-execution` / `agile-merge-review` / `agile-sprint-drain` agent they are on whatever the main loop did, by the agent type the engine reports. No text ends them: a model that wrote a final report early would otherwise switch them off.

**What counts as a review.** The reviewer reads every file in full at the reviewed sha with `git show <sha>:<path>` (`merge-review-pr` step 4). The guard records those reads from the commands themselves, when they succeed, for two kinds of caller: a `pr-reviewer` agent, and a loop running `merge-review-pr` inline (main loop or a drain's `merge-session`), from that `Skill` call until the loop invokes its next skill. A file counts as read when it was shown at the head, or at an earlier sha the head descends from (`gh api …/compare/<sha>...<head>` says `ahead`) and the file did not change since. So a delta review after a fix needs only the files the fix touched, and a rebase that rewrote history voids the older reads. Only plain `git show` / `git cat-file -p` commands count, joined by `&&` and optionally piped into `cat`, `nl` or `tee`, with every word after the subcommand a `<sha>:<path>` spec naming the full 40-character sha (an abbreviated one could match an object another repository was made to collide with). A read whose output passed the Bash tool's limit (30,000 characters, or a `<persisted-output>` preview) counts nothing, since the model saw only a preview: read such a file on its own, and a file too large for that is left for a human to merge. A command with anything the shell could run differently from that reading counts nothing: quotes, `$`, redirection, `;`, `||`, a newline, a subshell, an option, or a pipe into `head`, `sed` or anything else that drops lines. Also not counted: a read from any other agent, and the `Reviewed sha:` line of a receipt. Reads are kept in `$.store`, so a fresh `merge-session` resuming at 3e after a CI handoff merges against the reads an earlier one made.

**Fails closed.** When gh does not answer (auth, network, rate limit), the merge is refused with the reason; the loop retries. When the guard hook itself throws, times out or is skipped, a merge, push, edit or posting call is refused (`.catch` on the `tool.call` hook) and other calls go on.

**Why the head is pinned.** The pin moves the "is this still the reviewed head?" check to GitHub, at the moment of the merge, where nothing can move in between.

The per-phase tool-grant checks do not apply inside a session agent: it runs every phase, and CLAUDE.md gives it their combined grant.

## Seeing refusals

Each refusal is also kept for the session and shown on the Guards tab of the [agile console](console.md): when it happened, which rule (`grant`, `3f`, `push`, `fix`, `budget`), the text, and the agent that made the call, with a count of allowed calls beside it. A toast shows it as it happens, so a refusal is visible while the pane is closed. The log is in memory: a reload or `/agile-board reset` clears it.

## What a refusal looks like

```
agile-mods: pin the reviewed head: gh pr merge 42 --squash --match-head-commit <reviewed sha> (or expectedHeadSha), so GitHub refuses a head that moved after the review.
agile-mods: PR #42: CI on 3f1c0a9e2b7d has not finished (e2e in_progress). Wait for it (3e), then merge.
agile-mods: PR #42: no review read 2 file(s) as they land at 3f1c0a9e2b7d: src/auth.ts, src/auth.test.ts. A review reads each file in full with git show <sha>:<path> (merge-review-pr step 4); re-dispatch pr-reviewer on what is missing.
agile-mods: the loop never pushes to main: work lands through a PR and gh pr merge.
agile-mods: PR #42: 3 fix rounds already (3c on 1a2b3c4, 5d6e7f8, 9a0b1c2). The review loop is not converging: take 3d (blocked postmortem, PR left open) and let a human decide.
agile-mods: budget: the loop spent $20.40 of its $20.00 budget (agile-mods budgetUsd). Start no new build work: merge what is open, then stop and report BUDGET.
agile-mods: pr-reviewer reviews and never edits files: report the finding instead.
```

## Keeping it in sync

Each guard mirrors a rule written in a skill or in `CLAUDE.md`. Change the rule (a grant, how `merge-review-pr` reads files, the 3e/3f `gh pr merge --match-head-commit` command) and update `hooks/state/guards.ts` or `hooks/state/review.ts` in the same change. The fix-round cap is `FIX_ROUNDS` there.
