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
| A PR's fixes stop after 3 rounds (`agile-11-merge-train` Stop conditions, `agile-10-implement` Stop conditions) | Counted at the push, from any phase and across train runs. A push to a branch with an open PR (`gh pr list --head <branch>`) takes a round, unless it adds only merges and commits the base already has (`git rev-list --no-merges <PR head>..<ref> ^origin/<base>` is empty: a 3a update). A round is one dispatched agent's run; in the main loop or a session agent, the pushes between two of its Skill or Agent calls. A 4th round's push is refused, and so is a fix dispatch whose text names only a PR with 3 rounds. Inside a loop, a push the cap cannot read is refused: see [How a push is read](#how-a-push-is-read) |
| The loop writes to GitHub where the guards read it (`agile-11-merge-train` and `agile-10-implement` Rules) | Inside a loop, writes through the API are an allowlist: `gh api` with a write method or fields may reach only comments, replies, reviews, review requests and labels on issues and PRs (the endpoint read from its place in the command, not from field values); `gh api graphql` only with the query written out on the line (not `$VAR`, `@file` or `--input`; a single-quoted `-f query='…'` is judged by itself, whatever else the line holds) and, for a mutation, only the comment, reply, review, thread-resolve and label mutations, every one of them read; a write the endpoint reader cannot place is refused. On an MCP server named for GitHub, every tool but the read ones (`get_*`, `list_*`, `search_*`, `*_read`) and the comment, review and PR writes the loop uses is refused (default-deny); on any other server, so is a snake_case write tool (`create_*`, `update_*`, `delete_*`, `push_*`, `merge_*`, `fork_*`, `assign_*`, `run_*`, `dispatch_*`, `cancel_*`, `*_write`, …), which catches a GitHub server registered under another name. That last rule also refuses another connector's writes inside a loop (a `linear` server's `create_issue`); Atlassian's camelCase tools are not affected (`create_pull_request` and `merge_pull_request` then meet the budget and the 3f gates). Anything else, an endpoint or tool nobody listed included, is refused, as are `push_files`-style tools on any server, `gh repo sync`, and a merge through `gh api …/pulls/<n>/merge`, which would skip the 3f gates; so is any `git <word>`, read as in [How a push is read](#how-a-push-is-read), that is not one of git's own commands or is computed (an alias, however it was set, could hide a push), a `GIT_CONFIG_*` override in the command, any `gh <word>` that is not one of gh's own commands (after gh's options, `-R`/`--repo <repo>` included), `gh alias set` and `gh extension` (an alias or extension could hide a push). A git hook that pushes is a script file, in the limit above. Reads (`gh api` with no write method, or `-X GET`) and comment replies through the API go on |
| No build work past the budget (`agile-10-implement` and `agile-sprint-drain`, BUDGET) | With the `budgetUsd` option set, once the run's spend (the engine's cost ledger, counted from the run's start; see [Cost and spend](console.md)) reaches it, `agile-10-implement` and every `implement-*` skill are refused, and so are `gh pr create`, `create_pull_request` and a `gh api` POST to `pulls`, and every agent dispatch but the merge side's (`agile-merge-review` agents, `merge-session`) and the read-only types (`Explore`, `Plan`, `claude-code-guide`, `statusline-setup`). Open PRs still merge. It holds for the rest of the session once a loop ran in it, until `/agile-board reset`. Not covered: the main loop editing and pushing to an existing branch by hand, which the merge side needs for inline fixes. A run begins at a session's first loop call while no drain is running; a running drain keeps its run across sessions, and only `/agile-board reset` starts a new one then |
| Work reaches the base branch only through a PR; force push only with a lease (`agile-11-merge-train` Rules) | A `git push` to `main`/`master` (by refspec, or with none from a checkout of it, read with `git rev-parse` where the push runs), a push whose target is computed (`$BRANCH`, `$(…)`), and `--force` / `-f` / `--mirror` or a `+<ref>` without `--force-with-lease` are refused. The refs are read both from the raw text and from the words as the shell resolves them, so a quoted or escaped `main` is caught |

**When a guard is on.** The push guard, the fix-round cap and the side-door checks turn on with the orchestrator's `Skill` call (`agile-10-implement`, `agile-11-merge-train`, `agile-sprint-drain`), the merge guard with `agile-11-merge-train` or `agile-sprint-drain`, and stay on until `/agile-board reset` or a new session. Inside an `agile-execution` / `agile-merge-review` / `agile-sprint-drain` agent they are on whatever the main loop did, by the agent type the engine reports. No text ends them: a model that wrote a final report early would otherwise switch them off.

**What counts as a review.** The reviewer reads every file in full at the reviewed sha (`merge-review-pr` step 4). The guard records those reads from the commands themselves, when they succeed, for a `pr-reviewer` agent and for a loop running `merge-review-pr` inline (main loop or a drain's `merge-session`, from that `Skill` call until its next skill). A file counts as read when it was shown at the head, or at an earlier sha the head descends from (`gh api …/compare/<sha>...<head>` says `ahead`) with the file unchanged since. So a delta review after a fix needs only the files the fix touched, and a rebase voids the older reads. Reads are kept in `$.store`, so a fresh `merge-session` resuming at 3e merges against an earlier one's reads.

A command counts when:

- each read is `git [-C <dir>] [--no-pager] show <sha>:<path>` or `git cat-file -p <sha>:<path>`, with the full 40-character sha (an abbreviated one could match an object made to collide);
- reads are joined by `&&` or `;`, after an optional leading `cd <dir>`, with plain `echo` separators between them;
- each read is piped only into `cat`, `cat -n`, `nl` or `tee <file>`, or, for a file too large for one read, into one line range: `sed -n A,Bp` (quoted or not), `head -n N` or `tail -n +A`;
- the output is under the Bash tool's limit (30,000 characters, no `<persisted-output>` preview), and, for reads joined by `;`, shows no `fatal:` or `error:` line.

A file read in ranges counts once its ranges at the head cover every line with no gap; the guard takes the line count from git. Anything else on the line voids it: `$`, quotes outside an `echo`, redirection, `||`, a subshell, a newline, an option, or another filter. Also not counted: a read from any other agent, and the `Reviewed sha:` line of a receipt.

### How a push is read

Inside a loop the fix-round cap must know which branch each push sends. It reads:

- **A plain command:** an optional `cd <dir> &&`, then `git add`, `git commit` (a message in a quoted heredoc too) or git reads joined by `&&`, then one `git [-C <dir>] push` with known flags (`-u`, `--force-with-lease[=<ref>]`, `--no-verify`, `-q`, `-v`, `--porcelain`, `--delete`) and named refs. A bare push sends git's own `@{push}`.
- **Any longer line** (`;`, newlines, pipes, `$`): push by push. Each `git push` must name its remote and branch plainly. One push that names no branch is read only when the line follows its `cd`s plainly (no loop, subshell or `git -C`) and nothing in it moves the branch or its push target (`checkout`, `switch`, `branch -u`, `config`, `gh pr checkout`, …).
- **Output plumbing:** `2>&1` and `| tail` with a line count change nothing a push sends. `| head` is refused, since it can end the push early.
- **A delete** (`--delete`, or `:<branch>`) sends no commit and takes no round.

A push read from a longer line, or after a commit in the same command, always takes a round: the commit lands after the cap's check, so it cannot be told apart from a 3a update.

What counts as a push: any `git` word whose subcommand is `push` or computed, wherever it stands (behind `timeout` or `sudo`, in a brace group, inside `$(…)`), with quotes and escapes resolved (`"git"`, `g\it`, `$'git'`). A line also counts as pushing when:

- it runs a computed command beside a `push` word (`$G push`);
- a quoted word names git and push outside a `git`/`gh` message (`awk 'BEGIN{system("git push")}'`, `ssh host 'git push'`);
- git and push appear within a few words of each other in text another program gets (heredoc bodies included), and the line runs a program other than `git`, `gh`, `cd` or a print/search one. Commit and PR messages, heredocs written by `cat`/`tee` or read by `git`/`gh`, and `gh`'s arguments (`--event push`) are data. So is a line that is one command of a print/search program with nothing the shell expands (`grep -rn git src/`; `rg` without `--pre`).

Not seen: a push from a script file, or from a command built at run time out of encoded text. GitHub branch protection on `main` is the backstop there. When gh or git cannot say which branch or PR, the push is refused. A merge commit that carries a change of its own counts as an update.

**Fails closed.** When gh does not answer (auth, network, rate limit), the merge is refused with the reason; the loop retries. When the guard hook itself throws, times out or is skipped, a merge, push, edit or posting call is refused (`.catch` on the `tool.call` hook) and other calls go on.

**Why the head is pinned.** The pin moves the "is this still the reviewed head?" check to GitHub, at the moment of the merge, where nothing can move in between.

The per-phase tool-grant checks do not apply inside a session agent: it runs every phase, and CLAUDE.md gives it their combined grant.

## Seeing refusals

Each refusal is also kept for the session and shown on the Guards tab of the [agile console](console.md): when it happened, which rule (`grant`, `3f`, `push`, `fix`, `budget`, `side` for the API, MCP and alias side doors), the text, and the agent that made the call, with a count of allowed calls beside it. A toast shows it as it happens, so a refusal is visible while the pane is closed. The log is in memory: a reload or `/agile-board reset` clears it; `reset` clears the receipts beside it too.

## What a refusal looks like

```
agile-mods: pin the reviewed head: gh pr merge 42 --squash --match-head-commit <reviewed sha> (or expectedHeadSha), so GitHub refuses a head that moved after the review.
agile-mods: PR #42: CI on 3f1c0a9e2b7d has not finished (e2e in_progress). Wait for it (3e), then merge.
agile-mods: PR #42: no review read 2 file(s) as they land at 3f1c0a9e2b7d: src/auth.ts, src/auth.test.ts. A review reads each file in full with its own command, [cd <dir> &&] git show <40-hex sha>:<path>, or a file too large for one read in line ranges piped into sed -n A,Bp (merge-review-pr step 4); re-dispatch pr-reviewer on what is missing.
agile-mods: the loop never pushes to main: work lands through a PR and gh pr merge.
agile-mods: PR #42: 3 fix rounds already pushed (onto 1a2b3c4, 5d6e7f8, 9a0b1c2). The fixes are not converging: take 3d (blocked postmortem, PR left open) and let a human decide.
agile-mods: budget: the loop spent $20.40 of its $20.00 budget (agile-mods budgetUsd). Start no build work: merge what is open, then stop and report BUDGET.
agile-mods: pr-reviewer reviews and never edits files: report the finding instead.
```

## Keeping it in sync

Each guard mirrors a rule written in a skill or in `CLAUDE.md`. Change the rule (a grant, how `merge-review-pr` reads files, the 3e/3f `gh pr merge --match-head-commit` command, the fix-round cap, the push form in the `agile-10-implement` and `agile-11-merge-train` Rules, what BUDGET stops) and update `hooks/state/guards.ts` or `hooks/state/review.ts` in the same change. The cap is `FIX_ROUNDS` there, the push form `pushPlanOf` and `PUSH_FORM`, the budget `isBuildWork`.
