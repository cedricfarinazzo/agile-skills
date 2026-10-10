// Pure checks behind the guard mods: each rule here is written as prose in a skill or agent file,
// and a hook refuses or annotates the call that breaks it.

import type { ciOf } from './board.ts'
import { sameSha } from './review.ts'

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const short = (agentType: string) => agentType.split(':').at(-1) ?? agentType

const EDITING = new Set(['Write', 'Edit', 'NotebookEdit'])

// by tool name after the server prefix, so a server connected under another name is held the same
const POSTING_MCP = new Set([
  'add_issue_comment',
  'add_comment_to_pending_review',
  'add_reply_to_pull_request_comment',
  'pull_request_review_write',
  'update_pull_request',
  'merge_pull_request',
  'issue_write',
  'create_or_update_file',
  'push_files',
  'addCommentToJiraIssue',
  'transitionJiraIssue',
  'editJiraIssue',
  'createJiraIssue',
  'createIssueLink',
  'createConfluencePage',
  'updateConfluencePage',
  'createConfluenceFooterComment',
  'createConfluenceInlineComment',
])

const mcpName = (tool: string) => tool.match(/^mcp__.+?__(.+)$/)?.[1] ?? ''

const POSTING_BASH = /\b(gh\s+(pr\s+(comment|review|merge|edit|close|ready)|issue\s+(comment|edit|close|create))|gh\s+api\b[^|;&]*(-X|--method)\s*(POST|PATCH|PUT|DELETE)|git\s+push)\b/

/**
 * The tool grants CLAUDE.md withholds on purpose, enforced for the agent whose loop makes the call.
 *
 * @param agentType the calling loop's agent type from `$.agent.list()` (`agile-execution:review-lens`)
 * @returns the refusal, or undefined when the call is allowed
 */
export function grantDenial(agentType: string, tool: string, args: Record<string, unknown>): string | undefined {
  const agent = short(agentType)
  if (agent === 'jira-postmortem' && mcpName(tool) === 'createIssueLink') {
    return 'jira-postmortem may not create issue links: agile-11-merge-train links colliding tickets itself.'
  }
  if (agent !== 'review-lens' && agent !== 'pr-reviewer') return undefined
  if (EDITING.has(tool)) return `${agent} reviews and never edits files: report the finding instead.`
  if (POSTING_MCP.has(mcpName(tool)) || (tool === 'Bash' && POSTING_BASH.test(str(args.command)))) {
    const owner = agent === 'review-lens' ? 'self-reviewer publishes the verdict' : 'the jira-postmortem step posts to Jira'
    return `${agent} never posts to the PR, Jira or Confluence (${owner}): return it in the receipt.`
  }
  if (agent === 'review-lens' && tool === 'Skill' && /implement-review$/.test(str(args.skill))) {
    return 'review-lens reads the implement-review SKILL.md as a file: invoking the skill runs its Step 3 and posts a duplicate verdict.'
  }
  return undefined
}

/** The PR a merge call targets, and the head it pins when the call pins one. */
export function mergeTargetOf(tool: string, args: Record<string, unknown>): { pr: number; head?: string } | undefined {
  if (mcpName(tool) === 'merge_pull_request' && typeof args.pullNumber === 'number') {
    return { pr: args.pullNumber, head: str(args.expectedHeadSha) || undefined }
  }
  const command = tool === 'Bash' ? str(args.command) : ''
  const merge = command.match(/\bgh pr merge\s+(\d+)/)
  return merge ? { pr: Number(merge[1]), head: command.match(/--match-head-commit[=\s]+([0-9a-f]{7,40})\b/)?.[1] } : undefined
}

/** What the merge guard read itself, at the moment of the merge call. */
export type MergeFacts = {
  /** `gh pr view`: the live head and state; undefined when gh failed. */
  live?: { headRefOid: string; state: string }
  /** Every workflow run on the live head (`gh run list --commit`); undefined when gh failed. */
  ci?: ReturnType<typeof ciOf>
  /** PR files no reviewer read in their landing form; undefined when the files could not be listed. */
  unread?: string[]
}

/**
 * The 3f gates on a train merge, checked against GitHub rather than the loop's account of it: the
 * head is pinned and is the live head, every workflow run on it finished green, and every file of
 * the PR was read by a reviewer (`git show <sha>:<path>`) at a sha where it already had its landing
 * content. A gate that cannot read its source refuses: it fails closed.
 */
export function mergeDenial(pr: number, pin: string | undefined, facts: MergeFacts): string | undefined {
  if (!pin) return `pin the reviewed head: gh pr merge ${pr} --squash --match-head-commit <reviewed sha> (or expectedHeadSha), so GitHub refuses a head that moved after the review.`
  const { live, ci, unread } = facts
  if (!live) return `PR #${pr}: the merge guard could not read the PR (gh pr view ${pr} failed), so it refuses rather than merge unchecked. Check gh auth and retry.`
  if (live.state !== 'OPEN') return undefined
  if (!sameSha(live.headRefOid, pin)) {
    return `PR #${pr}: the pinned head ${pin.slice(0, 12)} is not the PR head ${live.headRefOid.slice(0, 12)}. Review the delta (git diff ${pin.slice(0, 12)}..${live.headRefOid.slice(0, 12)}), re-enter 3e on the new head, and pin it.`
  }
  if (!ci) return `PR #${pr}: the merge guard could not read CI on ${pin.slice(0, 12)} (gh run list --commit failed), so it refuses. Retry once gh answers.`
  if (ci.state === 'none') return `PR #${pr}: no CI run on ${pin.slice(0, 12)}. Wait for the run on this head (3e) before merging.`
  if (ci.state === 'pending') return `PR #${pr}: CI on ${pin.slice(0, 12)} has not finished (${ci.detail}). Wait for it (3e), then merge.`
  if (ci.state === 'red') return `PR #${pr}: CI on ${pin.slice(0, 12)} is red (${ci.detail}). Fix it (3c), re-enter 3e, then merge.`
  if (!unread) return `PR #${pr}: the merge guard could not list the PR's files (gh api pulls/${pr}/files failed), so it cannot check the review covered them. Retry once gh answers.`
  if (unread.length) {
    const shown = unread.slice(0, 5).join(', ') + (unread.length > 5 ? ` and ${unread.length - 5} more` : '')
    return `PR #${pr}: no review read ${unread.length} file(s) as they land at ${pin.slice(0, 12)}: ${shown}. A review reads each file in full with git show <sha>:<path> (merge-review-pr step 4); re-dispatch pr-reviewer on what is missing.`
  }
  return undefined
}

const BASE = /^(main|master)$/

/**
 * A push that the autonomous loop must never make: onto the base branch, or a force push
 * without a lease.
 *
 * @param branch the branch checked out where the push runs, for a push that names no refspec
 */
export function pushDenial(command: string, branch: string | undefined): string | undefined {
  for (const push of command.split(/&&|\|\||;|\|/).filter(c => /\bgit\b.*\bpush\b/.test(c))) {
    const words = push.trim().split(/\s+/).slice(push.trim().split(/\s+/).indexOf('push') + 1)
    const flags = words.filter(w => w.startsWith('-'))
    if (flags.some(f => f === '--force' || f === '--mirror' || /^-[a-zA-Z]*f/.test(f))) {
      return 'the loop never force-pushes without a lease: use --force-with-lease, and say so in the receipt.'
    }
    const refs = words.filter(w => !w.startsWith('-')).map(w => w.replace(/^["']|["']$/g, '')).slice(1)
    if (refs.some(r => /[$`]/.test(r))) return 'the loop names the branch it pushes: a computed push target ($VAR, $(...)) cannot be checked against main.'
    const targets = refs.map(r => r.replace(/^\+/, '').split(':').at(-1)!.replace(/^refs\/heads\//, '')).map(r => (r === 'HEAD' ? branch ?? r : r))
    const target = targets.find(t => BASE.test(t)) ?? (!refs.length && branch && BASE.test(branch) ? branch : undefined)
    if (target) return `the loop never pushes to ${target}: work lands through a PR and gh pr merge.`
  }
  return undefined
}

/** Fix rounds per PR across train runs (`agile-11-merge-train` Stop conditions): this many pushes, then 3d. */
export const FIX_ROUNDS = 3

/** A 3c dispatch: `fix-until-satisfied` by agent, or `merge-fix-until-satisfied` inline. */
export const isFixDispatch = (tool: string, args: Record<string, unknown>) =>
  (tool === 'Agent' && /(^|:)fix-until-satisfied$/.test(str(args.subagent_type))) || (tool === 'Skill' && /(^|:)merge-fix-until-satisfied$/.test(str(args.skill)))

/** The fix rounds a PR had: one id per round that pushed, and the head each round pushed onto. */
export type Rounds = { ids: string[]; heads: string[] }

/**
 * The fix-round cap on a push to an open PR's branch: a round already counted pushes again freely; a
 * new round past FIX_ROUNDS is refused.
 *
 * @param round the pushing round: one dispatched agent's run, or the main loop's (or a session
 *   agent's) pushes between two of its Skill or Agent calls
 */
export function fixDenial(pr: number, rounds: Rounds | undefined, round: string): string | undefined {
  if (!rounds || rounds.ids.includes(round) || rounds.ids.length < FIX_ROUNDS) return undefined
  return `PR #${pr}: ${rounds.ids.length} fix rounds already pushed (onto ${rounds.heads.map(h => h.slice(0, 7)).join(', ')}). The fixes are not converging: take 3d (blocked postmortem, PR left open) and let a human decide.`
}

/** What a push sends where, read from the command: the directory it runs in, and each `src:dst`. */
export type PushPlan = { dir?: string; refs: { src: string; dst: string }[] }

const PUSH_FLAGS = /^(-u|--set-upstream|--force-with-lease(=\S+)?|--no-verify|-q|--quiet|-v|--verbose|--porcelain|-f|--force)$/
const unquote = (w: string) => w.replace(/^"([^"]*)"$|^'([^']*)'$/, '$1$2')

/**
 * Reads a command that pushes, or says why it cannot be read with certainty. Only `&&` chains, a
 * `cd <dir>` or `git -C <dir>`, one `git push`, flags from a known list, and named refs are modelled:
 * anything else the shell could run differently (`;`, a pipe, `$`, a subshell, `--all`, `-o <x>`) is
 * refused, since the cap could not tell which branch it sends. No refs: the branch's own push target.
 */
export function pushPlanOf(command: string): PushPlan | { error: string } {
  const bare = command.replace(/'[^']*'/g, "''").replace(/"[^"$`\\]*"/g, '""')
  if (/[;|`$<>()\n\\]|(?<!&)&(?!&)/.test(bare.replace(/&&/g, ''))) return { error: 'a push in the loop is one plain command' }
  const segments = command.split('&&').map(c => c.trim())
  const pushes = segments.filter(c => /^git\b.*\bpush\b/.test(c))
  if (pushes.length !== 1) return { error: 'a command pushes once' }
  // a step before the push could move the branch or what it holds after the cap read it: only cd may
  let dir: string | undefined
  for (const seg of segments.slice(0, segments.indexOf(pushes[0]!))) {
    const cd = seg.match(/^cd\s+(\S+)$/)
    if (!cd) return { error: 'only a cd may run before a push in the same command' }
    dir = unquote(cd[1]!)
  }
  const words = pushes[0]!.split(/\s+/).map(unquote)
  let i = 1
  if (words[i] === '-C') {
    dir = words[i + 1]
    i += 2
  }
  if (words[i] !== 'push') return { error: 'git options before push are not read' }
  const args = words.slice(i + 1)
  const bad = args.find(a => a.startsWith('-') && !PUSH_FLAGS.test(a))
  if (bad) return { error: `the push option ${bad} is not read` }
  const [, ...specs] = args.filter(a => !a.startsWith('-'))
  const refs = specs.map(spec => {
    const [src, dst] = spec.replace(/^\+/, '').split(':')
    const clean = (r: string) => r.replace(/^refs\/heads\//, '')
    return { src: clean(src!), dst: clean(dst ?? src!) }
  })
  return { ...(dir && { dir }), refs }
}

const GITHUB_BRANCH_WRITES = new Set(['push_files', 'create_or_update_file', 'delete_file', 'create_branch', 'update_pull_request_branch'])
/** Whether a `gh api` call writes: an explicit method other than GET, or fields with no method. */
function ghApiWrites(command: string): boolean {
  const call = command.match(/\bgh\s+api\b[^&;|]*/)?.[0]
  if (!call) return false
  const method = call.match(/(?:\s-X\s*|\s--method[=\s]+)([A-Za-z]+)/)?.[1]
  return method ? method.toUpperCase() !== 'GET' : /\s(-f|-F|--field|--raw-field|--input)[=\s]/.test(call)
}
const GH_API_BRANCH = /\brepos\/\S+\/(contents\/|git\/(refs|commits|trees|blobs)\b|merges\b|pulls\/\d+\/(merge|update-branch)\b|branches\/\S+\/rename\b)/

// git's own commands: inside the loop, any other word after git is an alias, which could hide a push
const GIT_COMMANDS = new Set(('add am annotate apply archive bisect blame branch bundle cat-file check-attr check-ignore check-ref-format ' +
  'checkout cherry cherry-pick clean clone column commit commit-graph commit-tree config count-objects credential describe diff diff-files ' +
  'diff-index diff-tree difftool fetch for-each-ref format-patch fsck gc grep hash-object help init interpret-trailers lfs log ls-files ' +
  'ls-remote ls-tree maintenance merge merge-base merge-file merge-tree mergetool mktree mv name-rev notes pack-refs prune pull push ' +
  'range-diff read-tree rebase reflog remote repack replace rerere reset restore rev-list rev-parse revert rm shortlog show show-branch ' +
  'show-ref sparse-checkout stash status submodule switch symbolic-ref tag update-index update-ref var verify-commit verify-tag version ' +
  'whatchanged worktree write-tree').split(' '))

/** Each git subcommand a command runs, quoted text left out: the word after `git` and its options. */
export const gitCommandsOf = (command: string): string[] =>
  [...command.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
    .matchAll(/(?:^|[\s;&|(`/])git((?:\s+(?:-C\s+\S+|-c\s+\S+|--?[a-z][\w-]*(?:=\S+)?))*)\s+([A-Za-z][\w.-]*)/g)].map(m => m[2]!)

/**
 * A write to GitHub the loop must make with git or gh pr, where the guards read it: a branch written
 * through the API or a GitHub MCP tool, a merge through the API, or a git alias or config override
 * that could hide a push.
 */
export function sideDoorDenial(tool: string, args: Record<string, unknown>): string | undefined {
  if (GITHUB_BRANCH_WRITES.has(mcpName(tool))) return 'the loop writes to a branch with git push, where the guards read it, not through the GitHub API.'
  const command = tool === 'Bash' ? str(args.command) : ''
  if (!command) return undefined
  if (ghApiWrites(command) && GH_API_BRANCH.test(command)) {
    return /\/pulls\/\d+\/merge\b/.test(command)
      ? 'the loop merges with gh pr merge <n> --squash --match-head-commit <reviewed sha>, where the 3f gates read it, not through the API.'
      : 'the loop writes to a branch with git push, where the guards read it, not through the GitHub API.'
  }
  if (/\bGIT_CONFIG_(COUNT|KEY_|VALUE_|PARAMETERS|GLOBAL|SYSTEM)/.test(command)) return 'the loop does not override git config through the environment.'
  const alias = gitCommandsOf(command).find(c => !GIT_COMMANDS.has(c))
  if (alias) return `the loop runs git's own commands by name: "git ${alias}" is not one (an alias could hide a push).`
  return undefined
}

/** The merge side's agents and the read-only agent types, which go on past the budget. */
export const PUSH_FORM = 'run the push as its own command: [cd <dir> &&] git push [-u|--force-with-lease] <remote> <branch>'

const PAST_BUDGET = /^agile-merge-review:|:merge-session$|^(Explore|Plan|claude-code-guide|statusline-setup)$/

/**
 * Build work the budget stops: an implement run or any of its phases, opening a PR, and any agent
 * but the merge side's and the read-only types. The merge train goes on, so open PRs land.
 */
export const isBuildWork = (tool: string, args: Record<string, unknown>) =>
  (tool === 'Skill' && /(^|:)(agile-10-implement|implement-[a-z]+)$/.test(str(args.skill))) ||
  (tool === 'Agent' && !PAST_BUDGET.test(str(args.subagent_type))) ||
  (tool === 'Bash' && (/\bgh\s+pr\s+create\b/.test(str(args.command)) || (ghApiWrites(str(args.command)) && /\brepos\/\S+\/pulls(\s|$|\?|["'])/.test(str(args.command))))) ||
  mcpName(tool) === 'create_pull_request'

/**
 * The budget stop: once the run has spent its budget, no build work starts; the merge side goes on.
 *
 * @param spent USD the run spent, from the engine's cost ledger
 * @param budget the `budgetUsd` option; 0 or less is no budget
 */
export function budgetDenial(spent: number, budget: number, tool: string, args: Record<string, unknown>): string | undefined {
  if (budget <= 0 || spent < budget || !isBuildWork(tool, args)) return undefined
  return `agile-mods: budget: the loop spent $${spent.toFixed(2)} of its $${budget.toFixed(2)} budget (agile-mods budgetUsd). Start no build work: merge what is open, then stop and report BUDGET.`
}

/** A call a guard refused, kept for the console's Guards tab. */
export type Refusal = { at: number; rule: 'grant' | '3f' | 'push' | 'fix' | 'budget'; text: string; agent?: string }

export const MAX_REFUSALS = 20

export const keepRefusal = (list: Refusal[], refusal: Refusal): Refusal[] => [...list, refusal].slice(-MAX_REFUSALS)

/** Which guard wrote a refusal, read from its text. */
export function ruleOf(text: string): Refusal['rule'] {
  if (/never pushes to|never force-pushes|names the branch it pushes/.test(text)) return 'push'
  if (/^(agile-mods: )?budget:/.test(text)) return 'budget'
  if (/fix rounds already|fix-round cap/.test(text)) return 'fix'
  if (/--match-head-commit|expectedHeadSha|merge guard|CI |no review read|pinned head/.test(text)) return '3f'
  return 'grant'
}
