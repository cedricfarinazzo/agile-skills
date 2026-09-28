import type { Host } from './host.ts'
import { runOf, type Board } from './state/board.ts'
import { grantDenial, mergeDenial, mergeTargetOf, pushDenial } from './state/guards.ts'

// Guards: the rules the skills state in prose, enforced on the call that would break them.
// - a subagent's tool grant: review-lens and pr-reviewer never edit or post, jira-postmortem never links;
// - the 3f merge gates, from a merge train's start to its final report: a pinned head, the reviewed sha, fresh green CI;
// - the push guard, inside the loop: no push to main/master, no force push without a lease.

let cwd: string | undefined
let trainActive = false
let loopActive = false
let drainActive = false
let inlineReview: number | undefined
const agentTypes = new Map<string, string>()

async function agentTypeOf(host: Host, id: string): Promise<string | undefined> {
  if (!agentTypes.has(id)) {
    for (const a of await host.agents().catch(() => [])) agentTypes.set(a.id, a.type)
  }
  return agentTypes.get(id)
}

/** The branch checked out where a push runs: its `git -C <dir>` or leading `cd <dir> &&`, else the session's. */
async function branchOf(host: Host, command: string): Promise<string | undefined> {
  const dir = command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)?.[1] ?? command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/)?.[1]
  const run = await host.run(['git', '-C', dir?.replace(/^["']|["']$/g, '') ?? cwd ?? '.', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5_000 }).catch(() => undefined)
  return run?.exitCode === 0 ? run.stdout.trim() : undefined
}

export const guardsStart = (sessionCwd: string) => {
  cwd = sessionCwd
}

/** Before a tool call: the refusal, when a grant, a 3f gate or the push guard forbids it. */
export async function guardsBefore(host: Host, board: Board, tool: string, args: Record<string, unknown>, agentId: string | undefined): Promise<string | undefined> {
  const type = agentId ? await agentTypeOf(host, agentId) : undefined
  const grant = type ? grantDenial(type, tool, args) : undefined
  if (grant) return `agile-mods: ${grant}`
  const skill = typeof args.skill === 'string' ? args.skill : ''
  if (tool === 'Skill' && /(^|:)(agile-11-merge-train|agile-sprint-drain)$/.test(skill)) trainActive = true
  if (tool === 'Skill' && /(^|:)agile-sprint-drain$/.test(skill)) drainActive = true
  if (tool === 'Skill' && /(^|:)(agile-10-implement|agile-11-merge-train|agile-sprint-drain)$/.test(skill)) loopActive = true
  if (tool === 'Skill' && /(^|:)merge-review-pr$/.test(skill)) inlineReview = Number(String(args.args ?? '').match(/\d+/)?.[0]) || undefined

  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  if ((loopActive || /^agile-(execution|merge-review):/.test(type ?? '')) && /\bgit\b.*\bpush\b/.test(command)) {
    const refspec = /\bpush\b(\s+-\S+)*\s+\S+\s+\S+/.test(command)
    const deny = pushDenial(command, refspec && !/\bHEAD\b/.test(command) ? undefined : await branchOf(host, command))
    if (deny) return `agile-mods: ${deny}`
  }

  const target = mergeTargetOf(tool, args)
  if (!target || !trainActive) return undefined
  const deny = mergeDenial(target.pr, target.head, board.prs[target.pr]?.reviewed, target.head ? runOf(board, target.head) : undefined)
  return deny ? `agile-mods: ${deny}` : undefined
}

/** The PR an inline merge-review-pr is reviewing this turn, whose answer names its reviewed sha. */
export const inlineReviewOf = () => inlineReview

// a loop spans turns (3e waits a turn for CI), so it ends with its final report, not with a turn
// a drain runs both orchestrators each pass, so only its closing banner ends it
const DRAIN_END = /══\s*(DRAINED|STUCK)\s*══/
const TRAIN_END = /Per-PR outcome/
const IMPLEMENT_END = /## Sprint implementation/

/** A main-loop turn ended: a final report ends its loop; the inline review ends with the turn. */
export function guardsTurn(answer: string) {
  inlineReview = undefined
  if (DRAIN_END.test(answer)) guardsReset()
  if (drainActive) return
  if (TRAIN_END.test(answer)) trainActive = false
  if (TRAIN_END.test(answer) || IMPLEMENT_END.test(answer)) loopActive = trainActive
}

/** /agile-board reset: no loop is running. */
export function guardsReset() {
  drainActive = false
  trainActive = false
  loopActive = false
  inlineReview = undefined
}
