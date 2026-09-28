# Guards

[← agile-mods](../README.md)

No command · always active · code: `hooks/guards.ts`, checks in `hooks/state/guards.ts`

Rules the skills state in prose, enforced on the call that would break them. A refused call returns an error to the model that names the rule and what to do instead, so the loop corrects itself rather than stalling.

| Rule (where the prose lives) | Enforcement |
|---|---|
| `review-lens` and `pr-reviewer` never edit or post; `review-lens` never invokes `implement-review` (CLAUDE.md, tool grants) | A call from inside that agent's loop to `Write`/`Edit`/`NotebookEdit`, a posting GitHub/Atlassian MCP tool, `gh pr comment/review/merge/edit`, `gh issue comment/…`, `gh api -X POST/PATCH/PUT/DELETE` or `git push` is refused |
| `jira-postmortem` never creates issue links | `mcp__atlassian__createIssueLink` from that agent is refused |
| 3f merge gates (`agile-11-merge-train` 3e and 3f) | From a merge train's or drain's start to its final report, `gh pr merge <n>` / `mcp__github__merge_pull_request` is refused unless: the head is pinned (`--match-head-commit <sha>` / `expectedHeadSha`), so GitHub itself refuses a head that moved; the pin equals the reviewed sha, when a `pr-reviewer` receipt named one; and a CI run on that sha read `completed`/`success` on two agreeing reads (`gh run view <id> --json status,conclusion,headSha`) |
| Work reaches the base branch only through a PR; force push only with a lease (`agile-11-merge-train` Rules) | From an implement, merge-train or drain start to its final report, and in any `agile-execution` / `agile-merge-review` agent: a `git push` to `main`/`master` (by refspec, or with none from a checkout of it) and `--force` / `-f` / `--mirror` are refused; `--force-with-lease` passes |

**When a loop counts as running.** A loop spans several turns (3e waits a turn for CI), so it runs from its orchestrator's start to its final report: `## Sprint implementation` (implement), `Per-PR outcome` (merge train), or `══ DRAINED ══` / `══ STUCK ══` (drain; inside a drain, only this banner ends it). `/agile-board reset` also ends it. Merges and pushes outside a loop are not gated.

**Why the head is pinned.** The pin moves the "is this still the reviewed head?" check to GitHub, at the moment of the merge, where nothing can move in between. When the train runs the review inline (`concurrency=0`), a hook reads the reviewed sha only when the turn ends, after the merge; the gate then checks that a pin and green CI exist, and GitHub checks the pin.

## What a refusal looks like

```
agile-mods: pin the reviewed head: gh pr merge 42 --squash --match-head-commit <reviewed sha> (or expectedHeadSha), so GitHub refuses a head that moved after the review.
agile-mods: PR #42: CI run 9123 read green once. Re-read it (gh run view <id> --json status,conclusion,headSha): two agreeing reads, or the run is not finished.
agile-mods: the loop never pushes to main: work lands through a PR and gh pr merge.
agile-mods: pr-reviewer reviews and never edits files: report the finding instead.
```

## Keeping it in sync

Each guard mirrors a rule written in a skill or in `CLAUDE.md`. Change the rule (a grant, the `Reviewed sha:` line, the 3e/3f `gh run view` / `gh pr merge` commands) and update `hooks/state/guards.ts` in the same change.
