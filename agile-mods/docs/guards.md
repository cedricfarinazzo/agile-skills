# Guards

[← agile-mods](../README.md)

Shown on the console's Guards tab (`/agile-board guards`) · always active, each gate set to enforce, warn or off ([Settings and bypass](#settings-and-bypass)) · code: `hooks/guards.ts`, checks in `hooks/state/guards.ts` and `hooks/state/review.ts`, settings in `hooks/state/config.ts`, bypasses in `hooks/state/bypass.ts`

Rules the skills state in prose, enforced on the call that would break them. A refused call returns an error to the model that names the rule and what to do instead, so the loop corrects itself rather than stalling.

**A guard never takes the model's word.** What it checks comes from GitHub, git or the engine at the moment of the call: the PR's live head, the CI runs on that sha, the files of the PR, the commands a reviewer actually ran, the type of the agent making the call. No receipt, answer, banner or report line the model writes turns a guard on, off, or green.

| Rule (where the prose lives) | Enforcement |
|---|---|
| `review-lens` and `pr-reviewer` never edit or post; `review-lens` never invokes `implement-review` (CLAUDE.md, tool grants) | A call from inside that agent's loop to `Write`/`Edit`/`NotebookEdit`, a posting GitHub or Atlassian MCP tool (matched by tool name on any server), `gh pr comment/review/merge/edit`, `gh issue comment/…`, `gh api -X POST/PATCH/PUT/DELETE` or `git push` is refused |
| `jira-postmortem` never creates issue links | `createIssueLink` from that agent is refused |
| 3f merge gates (`agile-11-merge-train` 3b, 3e and 3f) | `gh pr merge <n>` / `merge_pull_request` is refused unless, read at that moment: the head is pinned (`--match-head-commit <sha>` / `expectedHeadSha`); the pin is the PR's live head (`gh pr view <n>`); every workflow run on that sha finished `success`, `skipped` or `neutral`, with at least one `success` (`gh run list --commit <sha>`); and every file of the PR (`gh api …/pulls/<n>/files`) was read by a reviewer as it lands (below) |
| A PR's fixes stop after 3 rounds after review (`agile-11-merge-train` Stop conditions, `agile-10-implement` Stop conditions) | Counted at the push, from any phase and across train runs. A push to a branch with an open PR (`gh pr list --head <branch>`) whose head a review read starts a round, unless a round already started from that head, it adds only merges and commits the base already has (`git rev-list --no-merges <PR head>..<ref> ^origin/<base>` is empty: a 3a update), or it restores a tree a review read or a round pushed onto (`git rev-parse <ref>^{tree}`; only when the push is a command of its own, since a commit in the same command lands after the check). A push onto a head no review read continues the round it is in, so a fresh agent resuming after a CI wait adds none. With `fixRounds` (default 3) rounds spent, the push that would start another is refused, and so is a fix dispatch whose text names only that PR while its live head is reviewed. Inside a loop, a push the cap cannot read is refused: see [How a push is read](#how-a-push-is-read) |
| The loop writes to GitHub where the guards read it (`agile-11-merge-train` and `agile-10-implement` Rules) | Inside a loop, writes through the API are an allowlist: `gh api` with a write method or fields may reach only comments, replies, reviews, review requests and labels on issues and PRs (the endpoint read from its place in the command, not from field values); `gh api graphql` only with the query written out on the line (not `$VAR`, `@file` or `--input`; a single-quoted `-f query='…'` is judged by itself, whatever else the line holds) and, for a mutation, only the comment, reply, review, thread-resolve and label mutations, every one of them read; a write the endpoint reader cannot place is refused. On an MCP server named for GitHub, every tool but the read ones (`get_*`, `list_*`, `search_*`, `*_read`) and the comment, review and PR writes the loop uses is refused (default-deny); on any other server, so is a snake_case write tool (`create_*`, `update_*`, `delete_*`, `push_*`, `merge_*`, `fork_*`, `assign_*`, `run_*`, `dispatch_*`, `cancel_*`, `*_write`, …), which catches a GitHub server registered under another name. That last rule also refuses another connector's writes inside a loop (a `linear` server's `create_issue`); Atlassian's camelCase tools are not affected (`create_pull_request` and `merge_pull_request` then meet the budget and the 3f gates). Anything else, an endpoint or tool nobody listed included, is refused, as are `push_files`-style tools on any server, `gh repo sync`, and a merge through `gh api …/pulls/<n>/merge`, which would skip the 3f gates; so is any `git <word>`, read as in [How a push is read](#how-a-push-is-read), that is not one of git's own commands or is computed (an alias, however it was set, could hide a push), a `GIT_CONFIG_*` override in the command, any `gh <word>` that is not one of gh's own commands (after gh's options, `-R`/`--repo <repo>` included), `gh alias set` and `gh extension` (an alias or extension could hide a push). A git hook that pushes is a script file, in the limit above. Reads (`gh api` with no write method, or `-X GET`) and comment replies through the API go on |
| No build work past the budget (`agile-10-implement` and `agile-sprint-drain`, BUDGET) | With the `budgetUsd` option set, once the run's spend (the engine's cost ledger, counted from the run's start; see [Cost and spend](console.md)) reaches it, `agile-10-implement` and every `implement-*` skill are refused, and so are `gh pr create`, `create_pull_request` and a `gh api` POST to `pulls`, and every agent dispatch but the merge side's (`agile-merge-review` agents, `merge-session`) and the read-only types (`Explore`, `Plan`, `claude-code-guide`, `statusline-setup`). Open PRs still merge. A build call naming a ticket a person allowed past the budget goes on until that ticket is done, parked or merged ([Settings and bypass](#settings-and-bypass)). It holds for the rest of the session once a loop ran in it, until `/agile-board reset`. Not covered: the main loop editing and pushing to an existing branch by hand, which the merge side needs for inline fixes. A run begins at a session's first loop call while no drain is running; a running drain keeps its run across sessions, and only `/agile-board reset` starts a new one then |
| Work reaches the base branch only through a PR; force push only with a lease (`agile-11-merge-train` Rules) | A `git push` to `main`/`master` (by refspec, or with none from a checkout of it, read with `git rev-parse` where the push runs), a push whose target is computed (`$BRANCH`, `$(…)`), and `--force` / `-f` / `--mirror` or a `+<ref>` without `--force-with-lease` are refused. The refs are read both from the raw text and from the words as the shell resolves them, so a quoted or escaped `main` is caught |

**When a guard is on.** The push guard, the fix-round cap and the side-door checks turn on with the orchestrator's `Skill` call (`agile-10-implement`, `agile-11-merge-train`, `agile-sprint-drain`), the merge guard with `agile-11-merge-train` or `agile-sprint-drain`, and stay on until `/agile-board reset` or a new session. Inside an `agile-execution` / `agile-merge-review` / `agile-sprint-drain` agent they are on whatever the main loop did, by the agent type the engine reports. No text ends them: a model that wrote a final report early would otherwise switch them off.

**What counts as a review.** The reviewer reads every file in full at the reviewed sha (`merge-review-pr` step 4), and after a fix reads the diff from the reviewed sha to the new head. The guard records those reads from the commands themselves, when they succeed, for:

- a `pr-reviewer` agent;
- a drain's `merge-session`, which runs the train (and its 3b review) inline;
- the main loop while the orchestrator it last invoked is `agile-11-merge-train`;
- any other loop running `merge-review-pr` inline, from that `Skill` call until its next skill.

Reads by the build side (`agile-execution` agents, `build-session`, the main loop after `agile-10-implement`) never count: the author does not review its own work. Nor does the `Reviewed sha:` line of a receipt.

A file of the PR counts as read at the head when one of these holds:

- it was read in full at the head, or in line ranges that cover every line with no gap (the guard takes the line count from git);
- it counts as read at an earlier sha and is identical in both trees (`git diff --name-status` between the two shas lists it nowhere, whatever the history: a rebase that left the file alone keeps its read). When local git cannot answer, GitHub's compare does, for a head that descends from the sha;
- a reviewer read the diff from such a sha to the head, covering that file (the whole diff, or `-- <path>`): a modified file, a file added since (the diff shows it whole), or a renamed one (whose old path counts, or which a diff limited to its new path showed whole). Diffs chain: after a second fix, the diff from the first fix's head is enough once that head counts.

Reads are kept in `$.store`, so a fresh `merge-session` resuming at 3e merges against an earlier one's reads.

A read counts when:

- it is `git [-C <dir>] [--no-pager] show <sha>:<path>` or `git cat-file -p <sha>:<path>`, the sha written out (7 to 40 hex, resolved to the full sha with `git rev-parse --verify` in the repository the read ran in) or set in a shell variable earlier on the same line (`S=<sha>; git show $S:<path>`);
- or it is `git [-C <dir>] diff [-U<n>] <sha>..<sha> [-- <path>…]` (or two shas apart), with no option that hides changed lines (`--stat`, `--name-only`, `--name-status`, `--shortstat`, `-w`, `--ignore-*`, `--diff-filter`, `-S`, `-G`); three dots, a branch name or a path pattern counts nothing;
- each read is piped only into `cat`, `cat -n`, `nl` or `tee <file>`, or, for a file too large for one read, into one line range: `sed -n A,Bp` (quoted or not), `head -n N` or `tail -n +A`;
- it runs on its own: after `;`, a newline, a `cd <dir>`, a variable set, an `echo`, or another read joined by `&&`. Each read on a line counts by itself; the line's other commands (`git diff origin/main`, `gh run view`, `wc -l`) are left out. A read after `||`, or after `&&` behind a command the guard cannot see succeed, does not count, nor does anything on a line with a heredoc or a backgrounded command;
- the output is under the Bash tool's limit (30,000 characters, no `<persisted-output>` preview), the command exited 0, and no `fatal:` or `error:` line names the read (an error that names no read voids every read in the command).

**The reviewer is told at once.** When a reviewer's command names a sha and a read in it does not count, the tool result carries one line, `agile-mods: not counted for review: …`, saying why and what to run instead: for output that was cut, the chunk plan (`git show <sha>:<path> | sed -n 1,212p · 213,398p · …`, each chunk at most 25,000 characters, measured by git); for an abbreviated sha that is not a commit here, a filter that drops lines, `||`, or a diff option that hides lines, the reason. A merge refusal for unread files repeats the chunk plan of each one too large for one read, and the last reasons reads did not count.

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

## Settings and bypass

Each gate has an option in `/plugin configure agile-mods@agile-skills` (see the [README](../README.md) for the table), read at session start:

- **`enforce`** (the default) refuses the call.
- **`warn`** lets it through; a toast and a `warned` entry on the Guards tab say what the gate found. The model is not told.
- **`off`** skips the check, and the gate reads nothing (a merge with every 3f gate off runs no `gh` call).

`guardPush` takes only `enforce` or `warn`: a push to main cannot be undone. `fixRounds` sets the cap (`0` is none), `budgetUsd` the budget. A value out of range keeps its default, with a note on the Guards tab. A repo's `AGENTS.md` or `CLAUDE.md` can name the same keys (`guardMergeReview: enforce`, `fixRounds = 2`, `allowBypass: false`); a value stricter than the option applies, a looser one is ignored and noted, since the loop can edit those files.

**One-time bypass.** With `allowBypass` on (the default), a refusal of a 3f merge gate, of the fix-round cap or of the budget ends with `A person can allow this once from /agile-board guards (…): return blocked (guard, bypass available) and wait`, so the loop reports it rather than asking the person to run the command. On the Guards tab each such refusal has an **Allow once [n]** button; `/agile-board allow` lists them and `/agile-board allow <n>` allows one. Only a person grants one: a pane button or a slash command, never a tool call. Each covers exactly what was refused:

| Refused | Allowed |
|---|---|
| A 3f gate on PR #N | One merge of PR #N at the head it was refused at (pinned or live), within 30 minutes |
| The fix-round cap on PR #N | One more round on PR #N, within 30 minutes |
| The budget | Build work for the ticket the refused call named (any build call naming no ticket, or that ticket), until it is done, parked or its PR merged; one that named no ticket ends at the next merge |

The grant, push and side-door gates have no bypass: they change only through their option. An open bypass shows on the Guards tab and as `⚑ 1 bypass` in the status line; the call it lets through is logged as `bypassed` and counted in the retro data. `/agile-board reset` drops every open bypass. Nothing about a bypass leaves the machine.

## Seeing refusals

Each refusal, warning and bypass is kept for the session and shown on the Guards tab of the [agile console](console.md): when it happened, which rule (`grant`, `3f`, `push`, `fix`, `budget`, `side` for the API, MCP and alias side doors), refused (`✖`), warned (`⚠`) or bypassed (`➜`), the text, and the agent that made the call, with the counts and the allowed calls beside them. Under them, each open PR's review coverage at its head: how many files count as read, which do not, and how the rest count (`full`, `ranges`, `carried`, `delta`). A toast shows each as it happens, so it is visible while the pane is closed. The log is in memory: a reload or `/agile-board reset` clears it; `reset` clears the receipts beside it too.

## What a refusal looks like

```
agile-mods: pin the reviewed head: gh pr merge 42 --squash --match-head-commit <reviewed sha> (or expectedHeadSha), so GitHub refuses a head that moved after the review.
agile-mods: PR #42: CI on 3f1c0a9e2b7d has not finished (e2e in_progress). Wait for it (3e), then merge.
agile-mods: PR #42: no review read 2 file(s) as they land at 3f1c0a9e2b7d: src/auth.ts, docs/guide.md. A review reads each file in full with its own command, git show <sha>:<path> (a file over 25,000 characters in consecutive sed -n A,Bp chunks), or, after a fix, the diff from the reviewed sha: git diff <reviewed sha>..<head> (merge-review-pr step 4). Too large for one read: git show 3f1c0a9e…:docs/guide.md | sed -n 1,212p · 213,398p · 399,520p. Then re-dispatch pr-reviewer on what is missing. A person can allow this once from /agile-board guards (merge PR #42 at 3f1c0a9): return blocked (guard, bypass available) and wait; do not ask them to run the command themselves.
agile-mods: not counted for review: `git show 3f1c0a9e:src/a.ts | cut -c1-400` pipes the read through a filter that drops lines: pipe only into one sed -n A,Bp, head -n N or tail -n +A.
agile-mods: the loop never pushes to main: work lands through a PR and gh pr merge.
agile-mods: PR #42: 3 fix rounds already pushed after a review (onto 1a2b3c4, 5d6e7f8, 9a0b1c2). The fixes are not converging: take 3d (blocked postmortem, PR left open) and let a human decide. A person can allow this once from /agile-board guards (one more fix round on PR #42): return blocked (guard, bypass available) and wait; do not ask them to run the command themselves.
agile-mods: budget: the loop spent $20.40 of its $20.00 budget (agile-mods budgetUsd). Start no build work: merge what is open, then stop and report BUDGET.
agile-mods: pr-reviewer reviews and never edits files: report the finding instead.
```

## Keeping it in sync

Each guard mirrors a rule written in a skill or in `CLAUDE.md`. Change the rule (a grant, how `merge-review-pr` reads files or a delta, the 3e/3f `gh pr merge --match-head-commit` command, the fix-round cap and what counts as a round, the push form in the `agile-10-implement` and `agile-11-merge-train` Rules, what BUDGET stops) and update `hooks/state/guards.ts` or `hooks/state/review.ts` in the same change. The default cap is `FIX_ROUNDS` there (the `fixRounds` option overrides it), the push form `pushPlanOf` and `PUSH_FORM`, the budget `isBuildWork`, the options and their defaults `hooks/state/config.ts` and the manifest's `userConfig`.
