import type { Host } from './host.ts'
import { ciOf, applyRuns, dispatchText, EMPTY, PR_REF } from './state/board.ts'
import { allow, loadAllowances, offerText, openOf, take3f, takeFix, type Allowance, type Offer } from './state/bypass.ts'
import { DEFAULTS, type Gate, type GuardConfig } from './state/config.ts'
import { PUSH_FORM, fixDenial, grantDenial, isFixDispatch, mergeProblems, mergeTargetOf, pushDenial, pushesIn, pushPlanOf, sideDoorDenial, type MergeChecks, type MergeFacts, type Refusal, type Rounds } from './state/guards.ts'
import { CHUNK, addDiffs, addParts, addReads, chunkText, failedIn, howRead, outputLines, parseReads, planChunks, reviewedAt, sameSha, showedDiff, showedFile, truncated, type Change, type Diffs, type How, type Know, type Parts, type Reads, type Spec } from './state/review.ts'

// Guards: the rules the skills state in prose, enforced on the call that would break them.
// - a subagent's tool grant: review-lens and pr-reviewer never edit or post, jira-postmortem never links;
// - the 3f merge gates, checked against GitHub at the merge call: a pinned live head, green CI on it,
//   and every file read by a reviewer as it lands, in full or by a diff since a full read;
// - the push guard: no push to main/master, no force push without a lease, no computed push target;
// - the fix-round cap: at most `fixRounds` pushes onto a reviewed head per open PR, from any phase.
// Each gate is enforced, warned about or off by the plugin's options (config.ts). A refused merge
// or fix round can be allowed once by a person from the Guards tab (bypass.ts).
// Nothing here reads what the model wrote: a guard turns on with the orchestrator's Skill call (or the
// calling agent's type) and stays on until /agile-board reset.

const READS_KEY = 'reads'
const PARTS_KEY = 'parts'
const DIFFS_KEY = 'diffs'
const ROUNDS_KEY = 'rounds'
const BYPASS_KEY = 'bypass'
const LOOP_AGENT = /^agile-(execution|merge-review|sprint-drain):/
const MERGE_AGENT = /^agile-(merge-review|sprint-drain):/
// whose reads are a review: the independent reviewer, and the session agent that runs the train inline
const REVIEWER = /(^|:)(pr-reviewer|merge-session)$/
// the author's side: its reads are never the review of its own work
const BUILD_SIDE = /^agile-execution:|:build-session$/
const SESSION = /:(build|merge)-session$/

let cwd: string | undefined
let config: GuardConfig = DEFAULTS
let trainActive = false
let loopActive = false
let reads: Reads = {}
let parts: Parts = {}
let diffs: Diffs = {}
// per PR, the reviewed heads its fix rounds pushed onto
let rounds: Record<string, Rounds> = {}
let allowances: Allowance[] = []
// why recent reads by a reviewer did not count, for the merge refusal
let skipped: string[] = []
// per loop ('' is the main loop): the orchestrator it last invoked, so the main loop's reads count only on the merge side
const loopStage = new Map<string, 'build' | 'merge'>()
// the loops running merge-review-pr inline: '' is the main loop, else a subagent's id
const inlineReviews = new Set<string>()
const agentTypes = new Map<string, string>()

export async function agentTypeOf(host: Host, id: string): Promise<string | undefined> {
  if (!agentTypes.has(id)) {
    for (const a of await host.agents().catch(() => [])) agentTypes.set(a.id, a.type)
  }
  return agentTypes.get(id)
}

/** The plugin options, already checked and tightened (config.ts). */
export function guardsConfigure(next: GuardConfig) {
  config = next
}

/** The open bypasses, none while `allowBypass` is off (stored ones from before are not honoured). */
const openBypasses = () => (config.allowBypass ? allowances : [])

export const guardConfig = () => config

/** The branch checked out where a push runs: its `git -C <dir>` or leading `cd <dir> &&`, else the session's. */
async function branchOf(host: Host, command: string): Promise<string | undefined> {
  const dir = command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/)?.[1] ?? command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/)?.[1]
  return host.branch(dir?.replace(/^["']|["']$/g, '') ?? cwd ?? '.')
}

const persist = (host: Host, key: string, value: unknown) => void host.storeSet(key, value).catch(err => host.log(`agile-mods: store write failed: ${err}`))
const objectOr = <T,>(value: unknown, fallback: T): T => (value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : fallback)

export async function guardsStart(host: Host, sessionCwd: string) {
  cwd = sessionCwd
  reads = objectOr(await host.storeGet(READS_KEY).catch(() => undefined), reads)
  parts = objectOr(await host.storeGet(PARTS_KEY).catch(() => undefined), parts)
  diffs = objectOr(await host.storeGet(DIFFS_KEY).catch(() => undefined), diffs)
  const stored = objectOr<Record<string, unknown>>(await host.storeGet(ROUNDS_KEY).catch(() => undefined), {})
  // only this shape: rounds kept per agent run by an older version are not review rounds
  rounds = Object.fromEntries(Object.entries(stored).filter(([, r]) => Array.isArray((r as Rounds)?.heads))) as Record<string, Rounds>
  allowances = loadAllowances(await host.storeGet(BYPASS_KEY).catch(() => undefined))
}

/** Whether a caller's reads are a review: pr-reviewer, merge-session, the main loop on the merge side, or an inline merge-review-pr. */
function reviewing(type: string | undefined, agentId: string | undefined): boolean {
  if (REVIEWER.test(type ?? '')) return true
  if (BUILD_SIDE.test(type ?? '') || (!agentId && loopStage.get('') === 'build')) return false
  if (inlineReviews.has(agentId ?? '')) return true
  return !agentId && loopStage.get('') === 'merge'
}

/** What git says changed between two trees, from the local repository, else GitHub's compare for a head that descends. */
function knowOf(host: Host): Know {
  const cache = new Map<string, Promise<Change[] | undefined>>()
  const ancestry = new Map<string, Promise<boolean | undefined>>()
  return {
    changes: (from, to) => {
      const key = `${from}..${to}`
      if (!cache.has(key)) {
        cache.set(key, (async () => {
          const local = await host.changes(cwd ?? '.', from, to)
          if (local) return local
          const cmp = await host.compare(from, to)
          // GitHub lists at most 300 files: a longer list may leave out a changed file, so it says nothing
          return cmp && cmp.files.length < 300 && (cmp.status === 'ahead' || cmp.status === 'identical') ? cmp.files.map(path => ({ status: 'M', path })) : undefined
        })())
      }
      return cache.get(key)!
    },
    lines: (sha, path) => host.lines(cwd ?? '.', sha, path),
    descends: (from, to) => {
      const key = `${from}<${to}`
      if (!ancestry.has(key)) {
        ancestry.set(key, (async () => {
          const local = await host.descends(cwd ?? '.', from, to)
          if (local !== undefined) return local
          const cmp = await host.compare(from, to)
          return cmp ? cmp.status === 'ahead' || cmp.status === 'identical' : undefined
        })())
      }
      return ancestry.get(key)!
    },
  }
}

/** How each file of a PR counts as read at its head; undefined for a file no review covers. */
export async function coverageOf(host: Host, head: string, files: string[]): Promise<Record<string, How | undefined>> {
  const know = knowOf(host)
  const state = { reads, parts, diffs }
  const out: Record<string, How | undefined> = {}
  for (const f of files) out[f] = await howRead(state, know, head, f)
  return out
}

/** The facts the 3f gates need, read from GitHub and git now; a gate that is off is not read. */
async function mergeFacts(host: Host, pr: number, checks: MergeChecks, inline: boolean): Promise<MergeFacts> {
  const live = await host.prView(pr)
  if (!live || live.state !== 'OPEN') return { live }
  const sha = live.headRefOid
  let ci: MergeFacts['ci']
  if (checks.mergeCi) {
    const runs = await host.runsOn(sha)
    ci = runs ? ciOf(applyRuns(EMPTY, runs, 0).runs?.[sha]) : undefined
    // an enforced red or missing CI refuses anyway: the review is not read
    if (ci?.state !== 'green' && config.modes.mergeCi === 'enforce') return { live, ci }
  }
  if (!checks.mergeReview) return { live, ci }
  const files = await host.prFiles(pr)
  if (!files) return { live, ci }
  const how = await coverageOf(host, sha, files)
  const unread = files.filter(f => !how[f])
  const plans: string[] = []
  for (const f of unread.slice(0, 3)) {
    const text = await host.show(cwd ?? '.', sha, f)
    if (text !== undefined && text.length > CHUNK) plans.push(chunkText(sha, f, planChunks(text)))
  }
  return { live, ci, unread, plans, skipped: [...new Set(skipped)].slice(-3), inline }
}

/**
 * Whether the ref a push sends has the tree of this PR's own history: the live head, a head a round
 * pushed onto, or a reviewed sha the live head descends from. Another PR's reviewed tree is not this
 * PR's to restore.
 */
async function restores(host: Host, dir: string, ref: string, head: string, known: Rounds | undefined): Promise<boolean> {
  const tree = await host.tree(dir, ref)
  if (!tree) return false
  const reviewed = [...new Set([...Object.keys(reads), ...Object.keys(diffs), ...Object.keys(parts)])].slice(-12)
  const own = [head, ...(known?.heads ?? [])]
  for (const sha of reviewed) if (!own.includes(sha) && (await host.descends(dir, sha, head)) === true) own.push(sha)
  for (const sha of own) if ((await host.tree(dir, sha)) === tree) return true
  return false
}

/** One call's verdict: a refusal (with what a person could allow), and notes for warned or bypassed gates. */
export type Verdict = { deny?: string; offer?: Offer; notes: { kind: 'warned' | 'bypassed'; text: string; rule: Refusal['rule'] }[] }

const bypassTail = (offer: Offer) =>
  config.allowBypass ? ` A person can allow this once from /agile-board guards (${offerText(offer)}): return blocked (guard, bypass available) and wait; do not ask them to run the command themselves.${offer.rule === '3f' ? ` Once allowed, the retried merge pins --match-head-commit ${offer.head}.` : ''}` : ''

/**
 * The fix-round cap at the push. Each branch the push sends is read from the command (or, for a bare
 * push, from git's own push target); a branch with an open PR (`gh pr list --head`) whose head a
 * review read starts a new round, unless a round already started there, it sends merge commits
 * alone (`git rev-list --no-merges`, an update), or it restores a reviewed tree. A push onto a head
 * no review read continues the round it is in. Nothing the model wrote decides the branch, the PR,
 * the head or the round.
 */
async function fixPush(host: Host, command: string, now: number, verdict: Verdict): Promise<void> {
  const plan = pushPlanOf(command)
  if ('error' in plan) {
    verdict.deny = `the fix-round cap reads every push in the loop, and ${plan.error}: ${PUSH_FORM}.`
    return
  }
  if (plan.delete) return
  const dir = plan.dir ?? cwd ?? '.'
  const refs = plan.refs.length ? plan.refs : [{ src: 'HEAD', dst: (await host.pushBranch(dir)) ?? (await host.branch(dir)) ?? '' }]
  for (const ref of refs) {
    // a ref that deletes sends no commit
    if (ref.src === '') continue
    const dst = ref.dst === 'HEAD' ? await host.branch(dir) : ref.dst
    if (!dst) {
      verdict.deny = `the fix-round cap could not tell which branch this push sends (git rev-parse failed in ${dir}): ${PUSH_FORM}.`
      return
    }
    const pr = await host.prOfBranch(dst)
    if (pr === null) continue
    if (!pr) {
      verdict.deny = `the fix-round cap could not read the PR of ${dst} (gh pr list --head failed), so it refuses. Retry once gh answers.`
      return
    }
    // a commit in the same command lands after this check could see it: no update or restore exemption
    if (!plan.commits && (await host.onlyMerges(dir, pr.headRefOid, ref.src, pr.baseRefName)) === true) continue
    const head = pr.headRefOid
    if (!reviewedAt(reads, parts, diffs, head)) continue
    const known = rounds[pr.number]
    if (known?.heads.some(h => sameSha(h, head))) continue
    if (!plan.commits && (await restores(host, dir, ref.src, head, known))) continue
    let next: Rounds = known ?? { heads: [] }
    const deny = fixDenial(pr.number, next, config.fixRounds)
    if (deny) {
      const left = takeFix(openBypasses(), pr.number, now)
      if (!left) {
        const offer: Offer = { rule: 'fix', pr: pr.number }
        const restore = plan.commits ? ' A push that restores a reviewed tree is free: commit first, then push in a command of its own so the cap can see the tree.' : ''
        verdict.deny = deny + restore + bypassTail(offer)
        verdict.offer = offer
        return
      }
      allowances = left
      persist(host, BYPASS_KEY, allowances)
      next = { ...next, extra: (next.extra ?? 0) + 1 }
      verdict.notes.push({ kind: 'bypassed', text: `PR #${pr.number}: fix round ${next.heads.length + 1} allowed by a person past the cap of ${config.fixRounds}`, rule: 'fix' })
    }
    rounds = { ...rounds, [pr.number]: { ...next, heads: [...next.heads, head] } }
    persist(host, ROUNDS_KEY, rounds)
  }
}

/**
 * A 3c dispatch for a PR whose rounds are spent, while its live head is reviewed and no round started
 * there, is refused before it does the work. The PR is read from the dispatch text, so this check can
 * only refuse sooner; the push is where the cap holds.
 */
async function fixDispatch(host: Host, args: Record<string, unknown>): Promise<string | undefined> {
  const named = new Set([...dispatchText(args).matchAll(new RegExp(PR_REF.source, 'gi'))].map(m => Number(m[1])))
  if (named.size !== 1) return undefined
  const [pr] = named
  const known = rounds[pr!]
  if (!fixDenial(pr!, known, config.fixRounds) || openBypasses().some(a => a.rule === 'fix' && a.pr === pr)) return undefined
  const live = await host.prView(pr!)
  if (!live || !reviewedAt(reads, parts, diffs, live.headRefOid) || known!.heads.some(h => sameSha(h, live.headRefOid))) return undefined
  return fixDenial(pr!, known, config.fixRounds)
}

/** Applies a gate's mode to what it found: enforce refuses, warn notes, off was not checked. */
function gated(verdict: Verdict, gate: Gate, rule: Refusal['rule'], text: string | undefined): boolean {
  if (!text || config.modes[gate] === 'off') return false
  if (config.modes[gate] === 'warn') {
    verdict.notes.push({ kind: 'warned', text, rule })
    return false
  }
  verdict.deny = text
  return true
}

/** Before a tool call: what a grant, a 3f gate, the push guard or the fix-round cap says of it. */
export async function guardsCheck(host: Host, tool: string, args: Record<string, unknown>, agentId: string | undefined): Promise<Verdict> {
  const verdict: Verdict = { notes: [] }
  const type = agentId ? await agentTypeOf(host, agentId) : undefined
  if (type && gated(verdict, 'grants', 'grant', grantDenial(type, tool, args))) return verdict
  const skill = typeof args.skill === 'string' ? args.skill : ''
  if (tool === 'Skill') {
    if (/(^|:)(agile-11-merge-train|agile-sprint-drain)$/.test(skill)) trainActive = true
    if (/(^|:)(agile-10-implement|agile-11-merge-train|agile-sprint-drain)$/.test(skill)) loopActive = true
    // what credits reads (the merge stage, an inline review) waits for the Skill call to run (guardsAfter);
    // what withholds credit applies at once. An inline review lasts until its loop invokes the next skill
    if (/(^|:)(agile-10-implement|implement-[a-z]+)$/.test(skill)) loopStage.set(agentId ?? '', 'build')
    inlineReviews.delete(agentId ?? '')
  }
  const now = await host.now()
  // expired merge and fix bypasses go; budget ones end with their ticket (guardsPrune)
  allowances = openOf(allowances, now, () => false, 0)

  if (config.fixRounds && isFixDispatch(tool, args) && (trainActive || MERGE_AGENT.test(type ?? ''))) {
    const deny = await fixDispatch(host, args)
    if (deny) {
      const pr = Number(deny.match(/^PR #(\d+)/)?.[1])
      verdict.offer = { rule: 'fix', pr }
      verdict.deny = deny + bypassTail(verdict.offer)
      return verdict
    }
  }

  const inLoop = loopActive || LOOP_AGENT.test(type ?? '')
  if (inLoop && gated(verdict, 'sideDoor', 'side', sideDoorDenial(tool, args))) return verdict

  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  if (inLoop && pushesIn(command)) {
    // the branch where the push runs: the plan's directory (its cds followed), else the leading cd or -C
    const plan = pushPlanOf(command)
    // read only for a push that names no branch, or HEAD
    const named = !('error' in plan) && plan.refs.length > 0 && !plan.refs.some(r => r.src === 'HEAD' || r.dst === 'HEAD') && !/\bHEAD\b/.test(command)
    const branch = named ? undefined : 'error' in plan || !plan.dir ? await branchOf(host, command) : await host.branch(plan.dir)
    if (gated(verdict, 'push', 'push', pushDenial(command, branch))) return verdict
    if (config.fixRounds) {
      await fixPush(host, command, now, verdict)
      if (verdict.deny) return verdict
    }
  }

  const target = mergeTargetOf(tool, args)
  if (!target || !(trainActive || MERGE_AGENT.test(type ?? ''))) return verdict
  const checks: MergeChecks = { mergePin: config.modes.mergePin !== 'off', mergeCi: config.modes.mergeCi !== 'off', mergeReview: config.modes.mergeReview !== 'off' }
  if (!checks.mergePin && !checks.mergeCi && !checks.mergeReview) return verdict
  const facts = await mergeFacts(host, target.pr, checks, SESSION.test(type ?? '') || (!agentId && loopStage.get('') === 'merge'))
  const problems = mergeProblems(target.pr, target.head, facts, checks)
  for (const p of problems.filter(p => config.modes[p.gate] === 'warn')) verdict.notes.push({ kind: 'warned', text: p.text, rule: '3f' })
  const enforced = problems.filter(p => config.modes[p.gate] === 'enforce')
  if (!enforced.length) return verdict
  // a bypass waives the gates for one head, never the pin: the merge must pin the allowed head, so
  // GitHub refuses it if anything was pushed since
  const left = target.head ? take3f(openBypasses(), target.pr, [target.head], now) : undefined
  if (left) {
    allowances = left
    persist(host, BYPASS_KEY, allowances)
    for (const p of enforced) verdict.notes.push({ kind: 'bypassed', text: p.text, rule: '3f' })
    return verdict
  }
  // a merge bypass names the head it allows: with no head known (gh down, no pin), none is offered
  const head = facts.live?.headRefOid ?? target.head
  if (head) verdict.offer = { rule: '3f', pr: target.pr, head }
  verdict.deny = enforced[0]!.text + (verdict.offer ? bypassTail(verdict.offer) : '')
  return verdict
}

/** Before a tool call: the refusal, when a gate refuses it. */
export async function guardsBefore(host: Host, tool: string, args: Record<string, unknown>, agentId: string | undefined): Promise<string | undefined> {
  const { deny } = await guardsCheck(host, tool, args, agentId)
  return deny ? `agile-mods: ${deny}` : undefined
}

/**
 * After a shell call by a reviewer: the `git show <sha>:<path>` and `git diff <a>..<b>` reads that
 * count toward 3f, each sha resolved to the full one in the repository the read ran in. Returns a
 * one-line note for the model when a read in the command did not count, so the reviewer fixes it
 * within the same review.
 */
export async function guardsAfter(host: Host, tool: string, args: Record<string, unknown>, agentId: string | undefined, output: string | undefined, isError = false): Promise<string | undefined> {
  if (tool === 'Skill' && output !== undefined && !isError) {
    const skill = typeof args.skill === 'string' ? args.skill : ''
    if (/(^|:)agile-11-merge-train$/.test(skill)) loopStage.set(agentId ?? '', 'merge')
    if (/(^|:)merge-review-pr$/.test(skill)) inlineReviews.add(agentId ?? '')
    return undefined
  }
  if (tool !== 'Bash' || typeof args.command !== 'string') return undefined
  const type = agentId ? await agentTypeOf(host, agentId) : undefined
  if (!reviewing(type, agentId)) return undefined
  const parsed = parseReads(args.command)
  if (!parsed.reads.length && !parsed.diffs.length && !parsed.skipped.length) return undefined
  const note = (problems: string[]) => {
    if (!problems.length) return undefined
    skipped = [...skipped, ...problems].slice(-10)
    return `agile-mods: not counted for review: ${problems.join('; ')}.`
  }
  if (output === undefined) return isError && (parsed.reads.length || parsed.diffs.length) ? note(['the command exited with an error, so none of its reads counted: run each read as a command of its own']) : undefined
  if (truncated(output)) {
    const plans: string[] = []
    for (const r of parsed.reads.slice(0, 3)) {
      const text = await host.show(r.dir ?? cwd ?? '.', r.sha, r.path)
      if (text !== undefined) plans.push(`read ${r.path} as ${chunkText(r.sha, r.path, planChunks(text))}`)
    }
    return note([`the output passed 30,000 characters and was cut, so nothing in it counted${plans.length ? `: ${plans.join('; ')}` : ': read one file per command, in chunks of at most 25,000 characters'}`])
  }
  const counted = failedIn(output, parsed)
  const problems = [...counted.skipped]
  const full = new Map<string, string | undefined>()
  const resolve = async (sha: string, dir: string | undefined) => {
    const key = `${dir ?? ''}:${sha}`
    if (!full.has(key)) full.set(key, sha.length === 40 ? sha : await host.resolve(dir ?? cwd ?? '.', sha))
    const found = full.get(key)
    if (!found && !problems.some(p => p.includes(sha))) problems.push(`${sha} is not a commit in this repository`)
    return found
  }
  // each read is checked against git's own text: its lines must be in what the command printed
  const seen = outputLines(output)
  const specs: Spec[] = []
  for (const r of counted.reads) {
    const sha = await resolve(r.sha, r.dir)
    if (!sha) continue
    const text = await host.show(r.dir ?? cwd ?? '.', sha, r.path)
    if (text !== undefined && showedFile(text, seen, r.range)) specs.push({ ...r, sha })
    else problems.push(`${r.path} at ${sha.slice(0, 7)} is not in the output as git has it, so it did not count: print it plainly`)
  }
  const diffReads = []
  for (const d of counted.diffs) {
    const [from, to] = [await resolve(d.from, d.dir), await resolve(d.to, d.dir)]
    if (!from || !to) continue
    const diff = await host.diffText(d.dir ?? cwd ?? '.', from, to, d.paths)
    const shown = diff === undefined ? [] : showedDiff(diff, seen)
    // the diff covers only the paths whose changed lines are in the output, named one by one
    if (diff !== undefined && (shown.length || !/^diff --git/m.test(diff))) diffReads.push({ ...d, from, to, paths: shown })
    const missed = diff === undefined ? ['the diff'] : [...diff.matchAll(/^diff --git a\/.+ b\/(.+)$/gm)].map(m => m[1]!).filter(p => !shown.includes(p))
    if (missed.length) problems.push(`git diff ${from.slice(0, 7)}..${to.slice(0, 7)}: ${missed.slice(0, 3).join(', ')}${missed.length > 3 ? ` and ${missed.length - 3} more` : ''} not in the output as git has it (an external diff, textconv, -w or a cut), so not counted`)
  }
  const nextReads = addReads(reads, specs)
  if (nextReads !== reads) persist(host, READS_KEY, (reads = nextReads))
  const nextParts = addParts(parts, specs)
  if (nextParts !== parts) persist(host, PARTS_KEY, (parts = nextParts))
  const nextDiffs = addDiffs(diffs, diffReads)
  if (nextDiffs !== diffs) persist(host, DIFFS_KEY, (diffs = nextDiffs))
  return note(problems)
}

/** The bypasses a person allowed that are still open. */
export const allowancesNow = () => openBypasses()

/** A person allowed an offer from the Guards tab: kept until used, expired, or its ticket ends. */
export function guardsAllow(host: Host, offer: Offer, now: number, merged: number) {
  allowances = allow(allowances, offer, now, merged)
  persist(host, BYPASS_KEY, allowances)
}

/** Drops budget allowances whose ticket is done or parked (or, naming none, once another PR merged), and expired ones. */
export function guardsPrune(host: Host, now: number, ended: (ticket: string) => boolean, merged: number) {
  const next = openOf(allowances, now, ended, merged)
  if (next !== allowances) persist(host, BYPASS_KEY, (allowances = next))
}

/** Whether a guard covers this call (a merge, a push, an edit or post): checked from the call alone, for a hook that could not run. */
export const guardedCall = (tool: string, args: Record<string, unknown>) =>
  !!mergeTargetOf(tool, args) || (tool === 'Bash' && /\bgit\b.*\bpush\b|\bgh\s+(pr|issue|api)\b/.test(String(args.command ?? ''))) || ['Write', 'Edit', 'NotebookEdit'].includes(tool) || /^mcp__.+__(add|create|update|edit|transition|merge|push|issue_write|pull_request_review_write)/.test(tool)

/** Whether a loop has started in this session, for the board's refresh. */
export const loopRunning = () => loopActive

/** /agile-board reset: no loop is running, and no review, round or bypass is on record. */
export function guardsReset(host?: Host) {
  trainActive = false
  loopActive = false
  inlineReviews.clear()
  loopStage.clear()
  reads = {}
  parts = {}
  diffs = {}
  rounds = {}
  allowances = []
  skipped = []
  if (host) for (const [key, value] of [[READS_KEY, reads], [PARTS_KEY, parts], [DIFFS_KEY, diffs], [ROUNDS_KEY, rounds], [BYPASS_KEY, allowances]] as const) void host.storeSet(key, value).catch(() => undefined)
}
