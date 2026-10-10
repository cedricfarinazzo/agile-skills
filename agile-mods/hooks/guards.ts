import type { Host } from './host.ts'
import { ciOf, applyRuns, dispatchText, EMPTY, PR_REF } from './state/board.ts'
import { fixDenial, grantDenial, isFixDispatch, mergeDenial, mergeTargetOf, pushDenial } from './state/guards.ts'
import { earlierShas, sameSha, unreadFiles, withReads, type Reads } from './state/review.ts'

// Guards: the rules the skills state in prose, enforced on the call that would break them.
// - a subagent's tool grant: review-lens and pr-reviewer never edit or post, jira-postmortem never links;
// - the 3f merge gates, checked against GitHub at the merge call: a pinned live head, green CI on it,
//   and every file read by a reviewer as it lands;
// - the push guard: no push to main/master, no force push without a lease, no computed push target;
// - the fix-round cap: 3c on at most FIX_ROUNDS distinct live heads per PR, read with gh at dispatch.
// Nothing here reads what the model wrote: a guard turns on with the orchestrator's Skill call (or the
// calling agent's type) and stays on until /agile-board reset.

const READS_KEY = 'reads'
const FIXES_KEY = 'fixes'
const LOOP_AGENT = /^agile-(execution|merge-review|sprint-drain):/
const MERGE_AGENT = /^agile-(merge-review|sprint-drain):/

let cwd: string | undefined
let trainActive = false
let loopActive = false
let reads: Reads = {}
// per PR, the live heads its 3c dispatches were made at
let fixHeads: Record<string, string[]> = {}
// the loops running merge-review-pr inline: '' is the main loop, else a subagent's id
const inlineReviews = new Set<string>()
const agentTypes = new Map<string, string>()

export async function agentTypeOf(host: Host, id: string): Promise<string | undefined> {
  if (!agentTypes.has(id)) {
    for (const a of await host.agents().catch(() => [])) agentTypes.set(a.id, a.type)
  }
  return agentTypes.get(id)
}

/** The branch checked out where a push runs: its `git -C <dir>` or leading `cd <dir> &&`, else the session's. */
async function branchOf(host: Host, command: string): Promise<string | undefined> {
  const dir = command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)?.[1] ?? command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/)?.[1]
  return host.branch(dir?.replace(/^["']|["']$/g, '') ?? cwd ?? '.')
}

export async function guardsStart(host: Host, sessionCwd: string) {
  cwd = sessionCwd
  const stored = await host.storeGet(READS_KEY).catch(() => undefined)
  if (stored && typeof stored === 'object') reads = stored as Reads
  const fixes = await host.storeGet(FIXES_KEY).catch(() => undefined)
  if (fixes && typeof fixes === 'object') fixHeads = fixes as Record<string, string[]>
}

/** The fix-round cap on a 3c dispatch: counted by the PR's live head at each dispatch. */
async function fixRound(host: Host, args: Record<string, unknown>): Promise<string | undefined> {
  const pr = Number(dispatchText(args).match(PR_REF)?.[1])
  if (!pr) return 'a 3c dispatch names the PR it fixes (#N), so the fix-round cap can count it.'
  const live = await host.prView(pr)
  if (!live) return `PR #${pr}: the fix-round cap could not read the PR (gh pr view ${pr} failed). Retry once gh answers.`
  const heads = fixHeads[pr] ?? []
  const deny = fixDenial(pr, heads, live.headRefOid)
  if (deny || heads.some(h => sameSha(h, live.headRefOid))) return deny
  fixHeads = { ...fixHeads, [pr]: [...heads, live.headRefOid] }
  void host.storeSet(FIXES_KEY, fixHeads).catch(err => host.log(`agile-mods: store write failed: ${err}`))
  return undefined
}

/** The facts the 3f gates need, read from GitHub now. */
async function mergeFacts(host: Host, pr: number, pin: string) {
  const live = await host.prView(pr)
  if (!live || live.state !== 'OPEN' || !sameSha(live.headRefOid, pin)) return { live }
  const runs = await host.runsOn(live.headRefOid)
  const ci = runs ? ciOf(applyRuns(EMPTY, runs, 0).runs?.[live.headRefOid]) : undefined
  if (ci?.state !== 'green') return { live, ci }
  const files = await host.prFiles(pr)
  if (!files) return { live, ci }
  const deltas: Record<string, string[] | undefined> = {}
  for (const sha of earlierShas(reads, live.headRefOid, files).slice(-6)) {
    const cmp = await host.compare(sha, live.headRefOid)
    // only a head that descends from the read sha keeps those reads
    deltas[sha] = cmp && (cmp.status === 'ahead' || cmp.status === 'identical') ? cmp.files : undefined
  }
  return { live, ci, unread: unreadFiles(reads, live.headRefOid, files, deltas) }
}

/** Before a tool call: the refusal, when a grant, a 3f gate or the push guard forbids it. */
export async function guardsBefore(host: Host, tool: string, args: Record<string, unknown>, agentId: string | undefined): Promise<string | undefined> {
  const type = agentId ? await agentTypeOf(host, agentId) : undefined
  const grant = type ? grantDenial(type, tool, args) : undefined
  if (grant) return `agile-mods: ${grant}`
  const skill = typeof args.skill === 'string' ? args.skill : ''
  if (tool === 'Skill') {
    if (/(^|:)(agile-11-merge-train|agile-sprint-drain)$/.test(skill)) trainActive = true
    if (/(^|:)(agile-10-implement|agile-11-merge-train|agile-sprint-drain)$/.test(skill)) loopActive = true
    // an inline review lasts until its loop invokes the next skill
    if (/(^|:)merge-review-pr$/.test(skill)) inlineReviews.add(agentId ?? '')
    else inlineReviews.delete(agentId ?? '')
  }

  if (isFixDispatch(tool, args) && (trainActive || MERGE_AGENT.test(type ?? ''))) {
    const deny = await fixRound(host, args)
    if (deny) return `agile-mods: ${deny}`
  }

  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  if ((loopActive || LOOP_AGENT.test(type ?? '')) && /\bgit\b.*\bpush\b/.test(command)) {
    const refspec = /\bpush\b(\s+-\S+)*\s+\S+\s+\S+/.test(command)
    const deny = pushDenial(command, refspec && !/\bHEAD\b/.test(command) ? undefined : await branchOf(host, command))
    if (deny) return `agile-mods: ${deny}`
  }

  const target = mergeTargetOf(tool, args)
  if (!target || !(trainActive || MERGE_AGENT.test(type ?? ''))) return undefined
  const deny = mergeDenial(target.pr, target.head, target.head ? await mergeFacts(host, target.pr, target.head) : {})
  return deny ? `agile-mods: ${deny}` : undefined
}

/** After a successful tool call: a reviewer's `git show <sha>:<path>` reads count toward 3f. */
export async function guardsAfter(host: Host, tool: string, args: Record<string, unknown>, agentId: string | undefined, output: string | undefined) {
  if (output === undefined || tool !== 'Bash' || typeof args.command !== 'string') return
  const type = agentId ? await agentTypeOf(host, agentId) : undefined
  if (!/(^|:)pr-reviewer$/.test(type ?? '') && !inlineReviews.has(agentId ?? '')) return
  const next = withReads(reads, args.command, output)
  if (next === reads) return
  reads = next
  void host.storeSet(READS_KEY, reads).catch(err => host.log(`agile-mods: store write failed: ${err}`))
}

/** Whether a guard covers this call (a merge, a push, an edit or post): checked from the call alone, for a hook that could not run. */
export const guardedCall = (tool: string, args: Record<string, unknown>) =>
  !!mergeTargetOf(tool, args) || (tool === 'Bash' && /\bgit\b.*\bpush\b|\bgh\s+(pr|issue|api)\b/.test(String(args.command ?? ''))) || ['Write', 'Edit', 'NotebookEdit'].includes(tool) || /^mcp__.+__(add|create|update|edit|transition|merge|push|issue_write|pull_request_review_write)/.test(tool)

/** Whether a loop has started in this session, for the board's refresh. */
export const loopRunning = () => loopActive

/** /agile-board reset: no loop is running, and no review is on record. */
export function guardsReset(host?: Host) {
  trainActive = false
  loopActive = false
  inlineReviews.clear()
  reads = {}
  fixHeads = {}
  if (host) void host.storeSet(READS_KEY, reads).catch(() => undefined)
  if (host) void host.storeSet(FIXES_KEY, fixHeads).catch(() => undefined)
}
