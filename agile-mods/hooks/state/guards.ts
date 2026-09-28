// Pure checks behind the guard mods: each rule here is written as prose in a skill or agent file,
// and a hook refuses or annotates the call that breaks it.

import { sameSha, type Run } from './board.ts'

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const short = (agentType: string) => agentType.split(':').at(-1) ?? agentType

const EDITING = new Set(['Write', 'Edit', 'NotebookEdit'])

const POSTING_MCP = new Set([
  'mcp__github__add_issue_comment',
  'mcp__github__add_comment_to_pending_review',
  'mcp__github__add_reply_to_pull_request_comment',
  'mcp__github__pull_request_review_write',
  'mcp__github__update_pull_request',
  'mcp__github__merge_pull_request',
  'mcp__github__issue_write',
  'mcp__github__create_or_update_file',
  'mcp__github__push_files',
  'mcp__atlassian__addCommentToJiraIssue',
  'mcp__atlassian__transitionJiraIssue',
  'mcp__atlassian__editJiraIssue',
  'mcp__atlassian__createJiraIssue',
  'mcp__atlassian__createIssueLink',
  'mcp__atlassian__createConfluencePage',
  'mcp__atlassian__updateConfluencePage',
  'mcp__atlassian__createConfluenceFooterComment',
  'mcp__atlassian__createConfluenceInlineComment',
])

const POSTING_BASH = /\b(gh\s+(pr\s+(comment|review|merge|edit|close|ready)|issue\s+(comment|edit|close|create))|gh\s+api\b[^|;&]*(-X|--method)\s*(POST|PATCH|PUT|DELETE)|git\s+push)\b/

/**
 * The tool grants CLAUDE.md withholds on purpose, enforced for the agent whose loop makes the call.
 *
 * @param agentType the calling loop's agent type from `$.agent.list()` (`agile-execution:review-lens`)
 * @returns the refusal, or undefined when the call is allowed
 */
export function grantDenial(agentType: string, tool: string, args: Record<string, unknown>): string | undefined {
  const agent = short(agentType)
  if (agent === 'jira-postmortem' && tool === 'mcp__atlassian__createIssueLink') {
    return 'jira-postmortem may not create issue links: agile-11-merge-train links colliding tickets itself.'
  }
  if (agent !== 'review-lens' && agent !== 'pr-reviewer') return undefined
  if (EDITING.has(tool)) return `${agent} reviews and never edits files: report the finding instead.`
  if (POSTING_MCP.has(tool) || (tool === 'Bash' && POSTING_BASH.test(str(args.command)))) {
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
  if (tool === 'mcp__github__merge_pull_request' && typeof args.pullNumber === 'number') {
    return { pr: args.pullNumber, head: str(args.expectedHeadSha) || undefined }
  }
  const command = tool === 'Bash' ? str(args.command) : ''
  const merge = command.match(/\bgh pr merge\s+(\d+)/)
  return merge ? { pr: Number(merge[1]), head: command.match(/--match-head-commit[=\s]+([0-9a-f]{7,40})\b/)?.[1] } : undefined
}

/**
 * The 3f gates on a train merge: the head is pinned (GitHub then refuses a head that moved), the
 * pin is the reviewed sha when a pr-reviewer receipt named one, and CI on that sha is green on
 * two agreeing reads.
 */
export function mergeDenial(pr: number, head: string | undefined, reviewed: string | undefined, run: Run | undefined): string | undefined {
  if (!head) return `pin the reviewed head: gh pr merge ${pr} --squash --match-head-commit <reviewed sha> (or expectedHeadSha), so GitHub refuses a head that moved after the review.`
  if (reviewed && !sameSha(reviewed, head)) {
    return `PR #${pr}: the pinned head ${head.slice(0, 12)} is not the reviewed sha ${reviewed.slice(0, 12)}: unreviewed code. Re-dispatch pr-reviewer on the delta (reviewed=${reviewed}) and re-enter 3e.`
  }
  if (!run) return `PR #${pr}: no CI run seen on ${head.slice(0, 12)}. Read it by run id with gh run view <id> --json status,conclusion,headSha (3e) before merging.`
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    return `PR #${pr}: CI run${run.id ? ` ${run.id}` : ''} on ${head.slice(0, 12)} is ${run.status}${run.conclusion ? `/${run.conclusion}` : ''}, not completed/success.`
  }
  if (run.reads < 2) return `PR #${pr}: CI run${run.id ? ` ${run.id}` : ''} read green once. Re-read it (gh run view <id> --json status,conclusion,headSha): two agreeing reads, or the run is not finished.`
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
    const refs = words.filter(w => !w.startsWith('-')).slice(1)
    const targets = refs.map(r => r.replace(/^\+/, '').split(':').at(-1)!.replace(/^refs\/heads\//, '')).map(r => (r === 'HEAD' ? branch ?? r : r))
    const target = targets.find(t => BASE.test(t)) ?? (!refs.length && branch && BASE.test(branch) ? branch : undefined)
    if (target) return `the loop never pushes to ${target}: work lands through a PR and gh pr merge.`
  }
  return undefined
}
