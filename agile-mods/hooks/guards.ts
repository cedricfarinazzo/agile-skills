import type { Host } from './host.ts'
import { ciOf, applyRuns, dispatchText, EMPTY, PR_REF } from './state/board.ts'
import { FIX_ROUNDS, PUSH_FORM, fixDenial, grantDenial, isFixDispatch, mergeDenial, mergeTargetOf, pushDenial, pushPlanOf, sideDoorDenial, type Rounds } from './state/guards.ts'
import { earlierShas, sameSha, unreadFiles, withReads, type Reads } from './state/review.ts'

// Guards: the rules the skills state in prose, enforced on the call that would break them.
// - a subagent's tool grant: review-lens and pr-reviewer never edit or post, jira-postmortem never links;
// - the 3f merge gates, checked against GitHub at the merge call: a pinned live head, green CI on it,
//   and every file read by a reviewer as it lands;
// - the push guard: no push to main/master, no force push without a lease, no computed push target;
// - the fix-round cap: at most FIX_ROUNDS fix rounds push to one open PR's branch, from any phase.
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
// per PR, the fix rounds that pushed to it
let fixRounds: Record<string, Rounds> = {}
// per loop ('' is the main loop): a number that moves at each of its Skill or Agent calls
const loopSeq = new Map<string, number>()
let seq = 0
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
  // an older version kept a list of heads per PR: not rounds, so not carried over
  if (fixes && typeof fixes === 'object') fixRounds = Object.fromEntries(Object.entries(fixes as Record<string, unknown>).filter(([, r]) => Array.isArray((r as Rounds)?.ids) && Array.isArray((r as Rounds)?.heads))) as Record<string, Rounds>
}

/**
 * Which fix round a push belongs to, from facts about the caller: a dispatched agent's whole run is
 * one round (its id, from the engine); in the main loop or a session agent, which run many phases,
 * the pushes between two of its Skill or Agent calls are one, so a review in between ends a round.
 */
function roundOf(type: string, agentId: string | undefined): string {
  if (agentId && !/:(build|merge)-session$/.test(type)) return `agent:${agentId}`
  return `loop:${agentId ?? ''}:${loopSeq.get(agentId ?? '') ?? 0}`
}

/**
 * The fix-round cap at the push. Each branch the push sends is read from the command (or, for a bare
 * push, from git's own push target); a branch with an open PR (`gh pr list --head`) takes a round,
 * unless what it sends is merge commits alone (`git rev-list --no-merges`), which is an update.
 * Nothing the model wrote decides the branch, the PR, the head or the round.
 */
async function fixPush(host: Host, command: string, type: string, agentId: string | undefined): Promise<string | undefined> {
  const plan = pushPlanOf(command)
  if ('error' in plan) return `the fix-round cap reads every push in the loop, and ${plan.error}: ${PUSH_FORM}.`
  const dir = plan.dir ?? cwd ?? '.'
  const refs = plan.refs.length ? plan.refs : [{ src: 'HEAD', dst: (await host.pushBranch(dir)) ?? (await host.branch(dir)) ?? '' }]
  for (const ref of refs) {
    const dst = ref.dst === 'HEAD' ? await host.branch(dir) : ref.dst
    if (!dst) return `the fix-round cap could not tell which branch this push sends (git rev-parse failed in ${dir}): ${PUSH_FORM}.`
    const pr = await host.prOfBranch(dst)
    if (pr === null) continue
    if (!pr) return `the fix-round cap could not read the PR of ${dst} (gh pr list --head failed), so it refuses. Retry once gh answers.`
    if ((await host.onlyMerges(dir, pr.headRefOid, ref.src, pr.baseRefName)) === true) continue
    const round = roundOf(type, agentId)
    const known = fixRounds[pr.number]
    const deny = fixDenial(pr.number, known, round)
    if (deny) return deny
    if (known?.ids.includes(round)) continue
    fixRounds = { ...fixRounds, [pr.number]: { ids: [...(known?.ids ?? []), round], heads: [...(known?.heads ?? []), pr.headRefOid] } }
    void host.storeSet(FIXES_KEY, fixRounds).catch(err => host.log(`agile-mods: store write failed: ${err}`))
  }
  return undefined
}

/**
 * A 3c dispatch for a PR whose rounds are spent is refused before it does the work. The PR is read
 * from the dispatch text, so this check can only refuse sooner; the push is where the cap holds.
 */
function fixDispatch(args: Record<string, unknown>): string | undefined {
  const named = new Set([...dispatchText(args).matchAll(new RegExp(PR_REF.source, 'gi'))].map(m => Number(m[1])))
  if (named.size !== 1) return undefined
  const [pr] = named
  return fixRounds[pr!] && fixRounds[pr!]!.ids.length >= FIX_ROUNDS ? fixDenial(pr!, fixRounds[pr!], 'dispatch') : undefined
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
  if (tool === 'Skill' || tool === 'Agent') loopSeq.set(agentId ?? '', ++seq)

  if (isFixDispatch(tool, args) && (trainActive || MERGE_AGENT.test(type ?? ''))) {
    const deny = fixDispatch(args)
    if (deny) return `agile-mods: ${deny}`
  }

  const inLoop = loopActive || LOOP_AGENT.test(type ?? '')
  const side = inLoop ? sideDoorDenial(tool, args) : undefined
  if (side) return `agile-mods: ${side}`

  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  if (inLoop && /\bgit\b.*\bpush\b/.test(command)) {
    const refspec = /\bpush\b(\s+-\S+)*\s+\S+\s+\S+/.test(command)
    const deny = pushDenial(command, refspec && !/\bHEAD\b/.test(command) ? undefined : await branchOf(host, command))
    if (deny) return `agile-mods: ${deny}`
    const cap = await fixPush(host, command, type ?? '', agentId)
    if (cap) return `agile-mods: ${cap}`
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
  fixRounds = {}
  loopSeq.clear()
  if (host) void host.storeSet(READS_KEY, reads).catch(() => undefined)
  if (host) void host.storeSet(FIXES_KEY, fixRounds).catch(() => undefined)
}
