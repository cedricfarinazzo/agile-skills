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

/** A call a guard refused, kept for the console's Guards tab. */
export type Refusal = { at: number; rule: 'grant' | '3f' | 'push'; text: string; agent?: string }

export const MAX_REFUSALS = 20

export const keepRefusal = (list: Refusal[], refusal: Refusal): Refusal[] => [...list, refusal].slice(-MAX_REFUSALS)

/** Which guard wrote a refusal, read from its text. */
export function ruleOf(text: string): Refusal['rule'] {
  if (/never pushes to|never force-pushes|names the branch it pushes/.test(text)) return 'push'
  if (/--match-head-commit|expectedHeadSha|merge guard|CI |no review read|pinned head/.test(text)) return '3f'
  return 'grant'
}
