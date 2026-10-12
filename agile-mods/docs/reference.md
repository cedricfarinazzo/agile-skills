# Reference

[← agile-mods](../README.md)

The exact rules behind the [console](console.md) and the [guards](guards.md), for when a refusal surprises you or you change a skill a guard mirrors.

- [Guards](#guards)
  - [When a guard is on](#when-a-guard-is-on)
  - [Merge gates](#merge-gates)
  - [What counts as a review](#what-counts-as-a-review)
  - [Fix rounds](#fix-rounds)
  - [How a push is read](#how-a-push-is-read)
  - [Side doors](#side-doors)
  - [Budget](#budget)
  - [Tool grants](#tool-grants)
  - [Failing closed](#failing-closed)
  - [Keeping guards and skills in sync](#keeping-guards-and-skills-in-sync)
- [The board](#the-board)
- [What the mod reads, runs and sends](#what-the-mod-reads-runs-and-sends)
- [Code layout](#code-layout)

## Guards

A guard never takes the model's word. It checks the PR's live head, the CI runs on it, the PR's files, the commands a reviewer actually ran, and the agent type the engine reports. Nothing the model writes (a receipt, a banner, a report line) turns a guard on, off or green.

### When a guard is on

| Guard | Turns on with |
|---|---|
| Push guard, fix-round cap, side doors | The `Skill` call of `agile-10-implement`, `agile-11-merge-train` or `agile-sprint-drain` |
| Merge gates | `agile-11-merge-train` or `agile-sprint-drain` |
| Inside a loop agent (`agile-execution`, `agile-merge-review`, `agile-sprint-drain`) | Always, by the agent type the engine reports |

They stay on until `/agile-board reset` or a new session. No text ends them, so a model that writes its final report early cannot switch them off.

### Merge gates

`gh pr merge <n>` and `merge_pull_request` are checked at the moment of the call:

| Gate | Option | Passes when |
|---|---|---|
| Pin | `guardMergePin` | The merge pins a head (`--match-head-commit <sha>` / `expectedHeadSha`) and it is the PR's live head (`gh pr view`) |
| CI | `guardMergeCi` | Every workflow run on that head finished `success`, `skipped` or `neutral`, with at least one `success` (`gh run list --commit`) |
| Review | `guardMergeReview` | Every file of the PR (`gh api …/pulls/<n>/files`) counts as read at that head ([below](#what-counts-as-a-review)) |

Pinning moves the "is this still the reviewed head?" check to GitHub, at the moment of the merge, so nothing can move in between.

### What counts as a review

**Whose reads count:**

- `pr-reviewer`;
- a drain's `merge-session`, which runs the train and its 3b review inline;
- the main loop while the orchestrator it last invoked is `agile-11-merge-train`;
- any other loop running `merge-review-pr` inline, from that `Skill` call until its next skill.

Reads by the build side (`agile-execution` agents, `build-session`, the main loop after `agile-10-implement`) never count, so the author never reviews its own work. A receipt's `Reviewed sha:` line counts for nothing.

**A file counts as read at the head when:**

| How | Rule |
|---|---|
| `full` | Read in full at the head |
| `ranges` | Read in line ranges at the head that cover every line with no gap (git gives the line count) |
| `carried` | Read at an earlier sha that the head descends from (`git merge-base --is-ancestor`), and identical in both trees (`git diff --name-status -C`). If local git cannot answer, GitHub's compare does; a compare listing 300 files (GitHub's limit) may leave one out, so it answers nothing. A sha off the head's history (another PR's, or a head a force push replaced) carries nothing on its own. The 8 latest reviewed shas the head descends from are searched |
| `delta` | A reviewer read the diff from a sha where the file counts to the head (a diff compares two trees, whatever the history): the file is unchanged, or the diff covers it (the whole diff, or `-- <path>`) and it was modified, added since (the diff showed it whole), or renamed or copied (its source counts, or a diff limited to its new path showed it whole). Diffs chain: after a second fix, the diff from the first fix's head is enough once that head counts |

Reads are kept in the mod's store, so a fresh `merge-session` resuming after a CI wait merges against an earlier one's reads.

**A command's read counts when:**

- it is `git [-C <dir>] [--no-pager] show <sha>:<path>` or `git cat-file -p <sha>:<path>`. The sha is 7 to 40 hex characters, resolved to the full sha with `git rev-parse --verify` in the repo the read ran in, or a variable set to it earlier on the same line (`S=<sha>; git show $S:<path>`). The path is written from the repo root (`./` and `../` are refused, since git reads them from the current directory). A path with special characters is quoted in single quotes (`'<sha>:app/(shop)/$id.tsx'`); `[ ]` need no quotes;
- or it is `git [-C <dir>] diff [-U<n>] <sha>..<sha> [-- <path>…]` (or two shas with a space), with no option that hides lines (`--stat`, `--name-only`, `--name-status`, `--shortstat`, `-w`, `--ignore-*`, `--diff-filter`, `-S`, `-G`). Three dots, a branch name or a path pattern count nothing;
- it pipes only into `cat`, `cat -n`, `nl` or `tee <file>`, or, for a file too large for one read, into a single `sed -n A,Bp`, `head -n N` or `tail -n +A`;
- it runs on its own: after `;`, a newline, a `cd <dir>`, a variable set, an `echo`, or another read joined by `&&`. Each read on a line counts by itself, and the line's other commands (`git diff origin/main`, `gh run view`, `wc -l`) are left out;
- the output is under the Bash tool's 30,000-character limit (no `<persisted-output>` preview), the command exited 0, and no `fatal:` or `error:` line names the read. An error that names no read voids every read in the command;
- **the output holds what git holds.** The guard runs its own `git show <sha>:<path>` and checks that every non-blank line of the file (or of the range read) is in the output, with or without a `cat -n` / `nl` number. For a diff it runs its own `git diff --no-ext-diff --no-textconv --text -M`, and a path counts only when all its `+` / `-` lines are in the output. Output sent elsewhere (`exec >/dev/null`), a shell function named `git`, an external diff driver, a textconv or a `-diff` attribute (`Binary files differ`) credits nothing.

A size check (`git show <sha>:<path> | wc -c`) is not a read and gets no note.

**A command's read does not count when:**

- it comes after `||`, or after `&&` behind a command the guard cannot see succeed. A variable or `cd` set there doesn't apply either;
- the line has a heredoc, a `$'…'` quote, a comment (`#` starting a word) or a backgrounded command;
- the output shows a failed `cd`.

**The reviewer is told at once.** When a reviewer's command names a sha and a read in it does not count, the tool result gets one line, `agile-mods: not counted for review: …`, with the reason and what to run instead. For output that was cut, that is a chunk plan measured by git, each chunk at most 25,000 characters (`git show <sha>:<path> | sed -n 1,212p · 213,398p · …`). A merge refusal for unread files repeats the chunk plan of each large one and the latest reasons.

### Fix rounds

Counted at the push, from any phase and across train runs, for a branch with an open PR (`gh pr list --head <branch>`):

| The push | Round? |
|---|---|
| Onto a head a review read, where no round started yet | **New round** |
| Onto a head no review read (still fixing, or resuming after a CI wait) | Continues the current round |
| Adds only merges and commits the base already has (`git rev-list --no-merges <head>..<ref> ^origin/<base>` is empty) | No: a 3a update |
| Restores a tree of this PR's own history: its live head, a head a round pushed onto, or a reviewed sha the head descends from (`git rev-parse <ref>^{tree}`) | No. Only for a push in a command of its own: a commit in the same command lands after the check |
| Deletes a branch (`--delete`, `:<branch>`) | No |

With `fixRounds` rounds spent (default 3), the push that would start another is refused, and so is a fix dispatch whose text names only that PR while its live head is reviewed.

### How a push is read

The cap must know which branch each push sends:

- **A plain command:** an optional `cd <dir> &&`, then `git add`, `git commit` (a message in a quoted heredoc too) or git reads joined by `&&`, then one `git [-C <dir>] push` with known flags (`-u`, `--force-with-lease[=<ref>]`, `--no-verify`, `-q`, `-v`, `--porcelain`, `--delete`) and named refs. A bare push sends git's own `@{push}`.
- **A longer line** (`;`, newlines, pipes, `$`): push by push. Each `git push` must name its remote and branch plainly. A push that names no branch is read only when the line follows its `cd`s plainly (no loop, subshell or `git -C`) and nothing moves the branch or its push target (`checkout`, `switch`, `branch -u`, `config`, `gh pr checkout`, …). Such a push always takes a round.
- **Output plumbing:** `2>&1` and `| tail` with a line count change nothing. `| head` is refused, since it can end the push early.

A line counts as pushing when any `git` word's subcommand is `push` or computed, wherever it stands (behind `timeout` or `sudo`, in a brace group, inside `$(…)`), with quotes and escapes resolved (`"git"`, `g\it`, `$'git'`). It also counts as pushing when:

- it runs a computed command beside a `push` word (`$G push`);
- a quoted word names git and push outside a `git`/`gh` message (`awk 'BEGIN{system("git push")}'`, `ssh host 'git push'`);
- git and push appear close together in text another program gets (heredocs included), and the line runs a program other than `git`, `gh`, `cd` or a print/search one.

Commit and PR messages, heredocs written by `cat`/`tee` or read by `git`/`gh`, `gh`'s arguments (`--event push`), and a single print/search command (`grep -rn git src/`, `rg` without `--pre`) are data.

**The push guard** (`guardPush`) refuses a push to `main`/`master` (by refspec, or bare from a checkout of it), a computed target (`$BRANCH`, `$(…)`), and `--force`, `-f`, `--mirror` or a `+<ref>` without `--force-with-lease`. Refs are read both from the raw text and from the words as the shell resolves them, so a quoted or escaped `main` is caught.

Not seen: a push from a script file, or from a command built at run time out of encoded text. GitHub branch protection on `main` is the backstop for those. When gh or git cannot say which branch or PR, the push is refused.

### Side doors

Inside a loop, `guardSideDoor` keeps every write where the other guards can read it:

- **`gh api` writes:** only comments, replies, reviews, review requests and labels on issues and PRs. The endpoint is read from its place in the command, not from field values. A write whose endpoint cannot be placed is refused.
- **`gh api graphql`:** only with the query written out on the line (not `$VAR`, `@file` or `--input`), and for a mutation only the comment, reply, review, thread-resolve and label mutations.
- **MCP:**
  - on a server named for GitHub, only read tools (`get_*`, `list_*`, `search_*`, `*_read`) and the comment, review and PR writes the loop uses;
  - on any other server, no snake_case write tool (`create_*`, `update_*`, `delete_*`, `push_*`, `merge_*`, …). This catches a GitHub server registered under another name; Atlassian's camelCase tools are not affected;
  - `push_files`-style tools are refused on any server.
- **Never:** `gh repo sync`, a merge through `gh api …/pulls/<n>/merge`, a `git` or `gh` word that is not one of their own commands (an alias could hide a push), `gh alias set`, `gh extension`, or a `GIT_CONFIG_*` override.

### Budget

With `budgetUsd` set, once the run's spend reaches it these are refused:

- `agile-10-implement` and every `implement-*` skill;
- `gh pr create`, `create_pull_request`, and a `gh api` POST to `pulls`;
- every agent dispatch except the merge side's and the read-only types (`Explore`, `Plan`, `claude-code-guide`, `statusline-setup`).

Open PRs still merge. A person can allow one ticket past the budget ([bypass](guards.md#bypass)): build calls naming that ticket and no other go on until it is done, parked or its PR merges. If the refused call named no single ticket, any build call goes on, until the next PR merges.

A run begins at a session's first loop call while no drain is running; a running drain keeps its run across sessions. Not covered: the main loop editing and pushing to an existing branch by hand, which the merge side needs for inline fixes.

### Bypass

- Only a person grants one: the pane's **Allow once** button, or `/agile-board allow <id>` with `command.run`'s origin `composer` (typed at the prompt) or `bridge` (sent from their phone). Run by the model, a plugin, a skill or a relay, the command grants nothing. `/agile-board reset` follows the same rule, since it drops reviews, rounds and bypasses.
- Each refusal has an id that is never reused, and the button and the command name that id, so a refusal that lands while you read the list cannot change what you allow.
- A merge bypass covers one PR at one head, for 30 minutes, and never waives the pin: the retried merge must pass `--match-head-commit <that head>`, so GitHub refuses it if anything was pushed since. A refusal that knew no head (gh down, no pin) offers none.
- A fix bypass is one more round on that PR, for 30 minutes. A budget bypass is described [above](#budget).
- With `allowBypass` off, no refusal offers one, and those granted before are not honoured.

### Tool grants

`guardGrants` holds back what [CLAUDE.md](../../CLAUDE.md) withholds on purpose:

- `review-lens` and `pr-reviewer` never edit (`Write`, `Edit`, `NotebookEdit`) or post (a posting GitHub or Atlassian tool on any server, `gh pr comment/review/merge/edit`, `gh issue …`, `gh api` writes, `git push`);
- `review-lens` never invokes `implement-review`;
- `jira-postmortem` never calls `createIssueLink`.

Inside a session agent the per-phase grants do not apply: it runs every phase.

### Failing closed

- When `gh` does not answer (auth, network, rate limit), a merge is refused with the reason, and the loop retries.
- When the guard hook itself throws, times out or is skipped, a merge, push, edit or posting call is refused, and other calls go on.

### Keeping guards and skills in sync

Each guard mirrors a rule written in a skill or in `CLAUDE.md`. If you change one of these rules, update `hooks/state/guards.ts` or `hooks/state/review.ts` in the same change:

- a tool grant;
- how `merge-review-pr` reads files, or reads a delta;
- the 3f `gh pr merge --match-head-commit` command;
- the fix-round cap, or what counts as a round;
- the push form in the `agile-10-implement` and `agile-11-merge-train` Rules;
- what BUDGET stops.

Where each lives in the code:

| What | Where |
|---|---|
| Default cap | `FIX_ROUNDS` |
| Push form | `pushPlanOf` and `PUSH_FORM` |
| What the budget stops | `isBuildWork` |
| Options and their defaults | `hooks/state/config.ts` and the manifest's `userConfig` |

## The board

| Source | Read with | Gives |
|---|---|---|
| PRs | `gh pr list --state all --limit 100 --json number,title,headRefName,headRefOid,state,createdAt,mergedAt,url` | Open PRs, and closed ones since the first loop or naming a board ticket: ticket key, head, merged, times. Every merged PR feeds aging and the forecast |
| PR files | `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files`, once per open PR head, 5 per refresh | The overlap map, review coverage |
| CI | `gh run list --limit 100 --json databaseId,headSha,status,conclusion,workflowName,createdAt` | The latest run per workflow on each sha |
| Jira sprint | `searchJiraIssuesUsingJql`: `(project in (…) AND sprint in openSprints()) OR key in (…)`, fields `summary, status, labels, statuscategorychangedate, <points field>`, 50 a page (halved down to 5 if an answer is too large), 4 pages at most | Status, points, parked (`needs-info` or a Needs Info status), time in status |
| Jira comments | The same search with `key = <key>` and `comment`, up to 4 tickets per refresh | The latest `agile:phase=<x>` marker, and `rework` markers |
| Tool calls | The `tool.call` hook (the call, not its result) | Which loop and stage started, train steps per PR, which ticket and `cloudId` a Jira call names |
| The engine | `$.session.usage()`, `turn.step`, `$.agent.list()` | Spend, tokens and cache hits per stage and agent, the agents lane |

The projects come from the ticket keys the loop names. The points field is `story-points-field` from the repo's `AGENTS.md` or `CLAUDE.md`, defaulting to `customfield_10016`.

**Refresh:**

| Trigger | When |
|---|---|
| A loop write (`gh pr|run|api`, `git push`, a Jira transition, comment or edit, an MCP PR create or merge) | 3 s after it |
| A `Skill` or `Agent` call while a loop runs | 3 s after it |
| The main loop going idle | At once (gh is read to judge STUCK) |
| `/agile-board` opening | At once |
| Fallback timer, while a loop runs or the pane is open | Every 5 minutes |

gh is read at most every 10 s and Jira at most every 30 s, about 720 GitHub list calls an hour at most.

**Drain outcome.**

- **`DRAINED`** once Jira has answered, no ticket is left open, unparked and unmerged, and no ticket PR is open.
- **`STUCK`** when the session goes idle with work left, no CI running on an open ticket PR, and a pass that created and merged nothing.

The drain's own banners are not read.

**Stall.** A PR dispatched to the same train step 3 times, or a ticket with 3 `rework` markers, shows as looping. A step is read from the dispatch text (`#42`, `PR 42`, `/pull/42`). A dispatch naming no PR moves no step.

**Cache drop.** A stage whose hit rate in the running pass falls 15 points under its average in earlier passes (above 200k prompt tokens each) goes to the alert row.

## What the mod reads, runs and sends

Nothing goes to any host but GitHub (through your `gh` login) and Atlassian (through the session's MCP server). There is no telemetry. No credential is read from the environment or from files. State stays in the plugin's local store, one entry per repo, and `/agile-board reset` clears it.

**Programs run.** Only `gh` and `git`, only to read. Each command is written out argument by argument in `hooks/register.tsx` and passed as an argument list, never through a shell. The only arguments taken from data are a PR number, a commit sha and a branch name, each checked against a strict pattern first, and a directory, used only as `git -C`.

| Command | Why | When |
|---|---|---|
| `gh pr list --state all --limit 100 --json …` | Board: PRs | On refresh |
| `gh run list --limit 100 --json …` | Board: CI | On refresh |
| `gh api --paginate repos/{owner}/{repo}/pulls/<n>/files` | Board overlap; merge gate files | Once per PR head; at a merge |
| `gh pr view <n> --json headRefOid,state` | Merge gate: live head | At a merge; at a fix dispatch past the cap |
| `gh run list --commit <sha> --json …` | Merge gate: CI on the head | At a merge |
| `gh api repos/{owner}/{repo}/compare/<sha>...<head>` | Merge gate: changed files and ancestry, when local git cannot say | At a merge, as a fallback |
| `gh pr list --head <branch> --state open --json number,headRefOid,baseRefName` | Fix-round cap: the PR a push sends to | Before a push in a loop |
| `git -C <dir> rev-parse --abbrev-ref HEAD` | Push guard and cap: the branch a bare push sends | Before such a push |
| `git -C <dir> rev-parse --abbrev-ref --symbolic-full-name @{push}` | Cap: where a bare push goes | Before such a push |
| `git -C <dir> rev-list --no-merges <head>..<ref> ^origin/<base>` | Cap: is the push only an update | Before a push to an open PR's branch |
| `git -C <dir> rev-parse --verify --quiet <sha>^{commit}` | Review: the full sha of a short one | After such a read |
| `git -C <dir> diff --name-status -C -z <sha> <head>` | Review coverage: what changed between two trees | At a merge; on the Guards tab |
| `git -C <dir> merge-base --is-ancestor <sha> <head>` | Review coverage and restore pushes: does the head descend from a sha | Same; before a push that would start a round |
| `git -C <dir> rev-parse --verify --quiet <ref>^{tree}` | Cap: does a push restore a known tree | Before a push that would start a round |
| `git -C <dir> show <sha>:<path>` | Review: the file's text, to check a reviewer's output held it; the line count of a file read in ranges; the chunk plan of a large one | After a reviewer's read; at a merge |
| `git -C <dir> diff --no-ext-diff --no-textconv --text --no-color -M <sha> <sha> [-- <path>…]` | Review: the diff's changed lines, to check a reviewer's diff output held them | After a reviewer's diff read |

**MCP call.** `searchJiraIssuesUsingJql` on the session's Atlassian server, read-only, only when that tool is already allowed (checked first with `$.tool.check`, which opens no dialog). It sends a JQL query naming the repo's projects and ticket keys, and the `cloudId`.

**Read.**

- **The loop's tool calls:**
  - which skill or agent ran, and the agent type that made each call;
  - the `git show`, `git diff` and push commands;
  - the `gh api` and MCP calls a loop makes;
  - the ticket keys and `cloudId` a Jira call names.

  Agent receipts are read only for the `/receipts` check.
- **Two files at session start:** the repo's `AGENTS.md` and `CLAUDE.md`, for `story-points-field`, `cloudId` and any guard setting that tightens the plugin's options.
- **The engine:**
  - session cost;
  - each request's token counts, never its text;
  - when the main loop goes idle, never its answer;
  - the agents list.

**Sent back into the session:**

- a guard's refusal, which the model reads as the tool's error;
- a one-line note on a reviewer's read that did not count;
- the retro counts, added to the `agile-15-retro` Skill call.

## Code layout

```
hooks/hooks.json          the one module
hooks/register.tsx        every hook; binds $ into a Host for the modules below
hooks/host.ts             the Host type: every program and MCP call the mod makes
hooks/guards.ts           guard state: reads, rounds, bypasses; the checks run per call
hooks/receipts.ts         /receipts
hooks/state/*.ts          pure logic: board, flow, agents, console views, guards, review coverage,
                          settings (config.ts), bypasses (bypass.ts), receipts, retro
docs/                     these pages; docs/img/generate.ts draws the pictures from the console's own rows
tests/unit/*.spec.ts      bun test: pure state, and the hook modules over tests/unit/fake-host.ts;
                          skills.spec.ts runs every git and gh command the skills write through the guards
tests/engine/*.test.ts    claude plugin test: register.tsx in the engine, with gh, git and Jira stubbed
```

The engine allows one hooks module per plugin, one unmatched hook per event, and `$` only in that module, so `register.tsx` owns the hooks and hands the other modules a `Host` of bound calls. To typecheck, point a tsconfig at `hooks/` and the declarations `/plugin-types` writes, with `jsx: react`, `jsxFactory: h` and `allowImportingTsExtensions`.
