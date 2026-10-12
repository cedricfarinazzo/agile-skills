/* @jsx h */
import type { EngineInterface, ProcessRunResult, Register, RenderNode } from 'claude-code'
import { EMPTY, POINTS_FIELD, TICKET_KEY, applyJira, dispatchText, markerTargets, pruned, nextPageOf, applyPrs, applyRuns, cloudIdOf, jqlOf, judged, issuesOf, keysOf, loadBoard, observeStart, parkedOf, pointsFieldOf, sampled, stallsOf, stampCosts, withKeys, type Board } from './state/board.ts'
import { TABS, alertRow, chartCells, chartGlyphs, consoleRows, offersOf, rasterCells, statusText, tabOf, type Coverage, type Ctx, type Row, type Tab } from './state/console.ts'
import { isBuildWork, keepRefusal, prHeadOf, ruleOf, ticketBudgetDenial, type Refusal } from './state/guards.ts'
import { offerText, ticketBudgetOpen, type Offer } from './state/bypass.ts'
import { configOf, limitsLine, modesLine, repoConfigOf, tightened, type GuardConfig } from './state/config.ts'
import { filesTargets, withFiles, withRun, withSpend, withTokens, withoutLedger } from './state/flow.ts'
import { laneOf, noteCall, noteTokens, type Stats } from './state/agents.ts'
import { liveOf } from './state/phase.ts'
import { modelOf, modelOfId, movedCost, strongTicket, ticketOfText, ticketsOfText, usdOf, withCost } from './state/cost.ts'
import { EMPTY_RETRO, loadRetro, retroDrain, retroEnd, retroStart, retroText, type Retro } from './state/retro.ts'
import { agentTypeOf, allowancesNow, branchOf, coverageOf, guardedCall, guardsAfter, guardsAllow, guardsCheck, guardsConfigure, guardsPrune, guardsReset, guardsStart, loopRunning } from './guards.ts'
import type { Usage } from './state/flow.ts'
import { argsOf, type Compare, type Finished, type Host, type PrRow, type RunRow } from './host.ts'
import { RECEIPTS_COMMAND, receiptsAfter, receiptsCommand, receiptsNow, receiptsReset, receiptsStart } from './receipts.ts'

// The plugin's one hooks module. The board is read from the sources the mod queries itself: gh for
// PRs, CI runs and open PRs' files, the session's Atlassian MCP server for tickets, the engine for
// cost, request usage and agents. It refreshes a few seconds after the loop's own writes and
// dispatches, when /agile-board opens, and every 5 minutes as a fallback while a loop runs or the
// pane is in use. Tool calls add only the dispatches themselves (which orchestrator or train step
// started, when). The board is kept in
// $.store and drawn three ways: a one-line status entry, an alert row above the prompt when
// something needs a person, and the agile console pane (/agile-board).
// The guards (guards.ts) and /receipts (receipts.ts) share these hooks: each event is registered
// once, and `$` reaches them only as the Host bound here.

const STORE_KEY = 'board'
const RETRO_KEY = 'retro'
const PANE = 'agile-console'
const TICK_MS = 15_000
// the fallback: the loop's own calls trigger a refresh (soon), so a timer catches only changes made elsewhere
const GH_EVERY = 300_000
const JIRA_EVERY = 300_000
// an event refreshes at most this often, however many land
const GH_GAP = 10_000
const JIRA_GAP = 30_000
const FILES_PER_SYNC = 5
const SOON_MS = 3_000
const MARKER_READS = 4
const JIRA_PAGES = 4
/** Issues a Jira page asks for, and the floor it halves to when an answer passes the MCP output limit. */
const JIRA_PAGE = 50
const JIRA_PAGE_MIN = 5
/** A Jira answer that came back as the engine's too-large notice instead of JSON. */
class TooLarge extends Error {
  constructor() {
    super('the Jira answer passed the MCP output limit even at the smallest page')
  }
}
/** Tickets whose comments alone pass the limit: their markers are not read again this session. */
const tooLarge = new Set<string>()
let board: Board = EMPTY
let retro: Retro = EMPTY_RETRO
let shown = true
let tab: Tab = 'board'
let autoOpen = true
let pointsField = POINTS_FIELD
let cloudId: string | undefined
let refusals: Refusal[] = []
let allowed = 0
let paneAt = 0
let soonQueued = false
let persistQueued = false
const busy = { gh: false, jira: false }
let ghError: string | undefined
let cap = 0
let config: GuardConfig
let configNotes: string[] = []
/** Per open PR at its head: how each file counts as read, for the Guards tab; refreshed at most every 15 s. */
let coverage: Record<number, { head: string; at: number; files: Record<string, string | undefined> }> = {}
let agentStats: Stats = {}
/** Per loop agent: the ticket it works, the last request counted and when, for the Cost tab. Memory only. */
/** Agent dispatches whose ticket the prompt named, waiting for the agent they start: the description may not carry the key. */
const dispatches: { type: string; tickets: string[]; at: number }[] = []
/**
 * A subagent's cost. `claim` is what it was dispatched for (its description and prompt, model-written
 * text, so only a claim); `shown` the ticket its own state-changing calls last named, which outranks
 * the claim. `accrued` is what it has cost by ticket, so a claim its work contradicts is moved whole.
 */
type Worker = { claim: string[]; shown?: string; stage?: 'build' | 'merge'; accrued: Record<string, number>; last?: { parts: Record<string, number>; usd: number }; at?: number; unattributed: number; branchTries: number }
const workers = new Map<string, Worker>()
/** Bumped by /agile-board reset and a fresh drain: a read begun before it saves nothing. */
let epoch = 0
// the plugin store is shared by every repo: each key is scoped to the session's working directory
let scope = ''

const PR_NUMBER = /^\d{1,9}$/
const SHA = /^[0-9a-f]{7,40}$/
const BRANCH = /^(?!-)[A-Za-z0-9._/-]{1,200}$/
const GH_TIMEOUT = { timeoutMs: 15_000 }

/** A gh answer: stdout when it exited 0, else undefined with the first stderr line kept for the board. */
async function gh(run: Promise<ProcessRunResult>): Promise<string | undefined> {
  try {
    const r = await run
    if (r.exitCode === 0) return r.stdout
    ghError = r.stderr.trim().split('\n')[0] || `gh exited ${r.exitCode}`
  } catch (err) {
    ghError = String(err)
  }
  return undefined
}

const parsed = <T,>(text: string | undefined): T | undefined => {
  try {
    return text === undefined ? undefined : (JSON.parse(text) as T)
  } catch {
    return undefined
  }
}

/** The session's Atlassian JQL search tool, by its full name (`mcp__<server>__searchJiraIssuesUsingJql`). */
async function jiraSearchTool($: EngineInterface): Promise<string | undefined> {
  const tools = await $.tool.list().catch(() => [])
  return tools.map(t => t.name).find(n => /^mcp__.+__searchJiraIssuesUsingJql$/.test(n))
}

// Every program the mods run is written out here, argument by argument. The only computed
// arguments are a PR number, a commit sha and a branch name, each checked against its pattern
// before the call, and the directory a push names. No output leaves the machine.
function hostOf($: EngineInterface): Host {
  return {
    now: () => $.clock.now(),
    branch: dir => $.process.run(['git', '-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5_000 })
      .then(r => (r.exitCode === 0 ? r.stdout.trim() : undefined), () => undefined),
    prs: async () => parsed<PrRow[]>(await gh($.process.run(['gh', 'pr', 'list', '--state', 'all', '--limit', '100', '--json', 'number,title,headRefName,headRefOid,state,createdAt,mergedAt,url,additions,deletions'], GH_TIMEOUT))),
    runs: async () => parsed<RunRow[]>(await gh($.process.run(['gh', 'run', 'list', '--limit', '100', '--json', 'databaseId,headSha,status,conclusion,workflowName,createdAt'], GH_TIMEOUT))),
    prView: async pr => (PR_NUMBER.test(String(pr)) ? parsed(await gh($.process.run(['gh', 'pr', 'view', String(pr), '--json', 'headRefOid,state'], GH_TIMEOUT))) : undefined),
    runsOn: async sha => (SHA.test(sha) ? parsed<RunRow[]>(await gh($.process.run(['gh', 'run', 'list', '--commit', sha, '--limit', '50', '--json', 'databaseId,headSha,status,conclusion,workflowName,createdAt'], GH_TIMEOUT))) : undefined),
    pushBranch: dir => $.process.run(['git', '-C', dir, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{push}'], { timeoutMs: 5_000 })
      .then(r => (r.exitCode === 0 ? r.stdout.trim().replace(/^[^/]+\//, '') : undefined), () => undefined),
    onlyMerges: async (dir, head, ref, baseRef) => {
      if (!SHA.test(head) || !(ref === 'HEAD' || BRANCH.test(ref)) || !BRANCH.test(baseRef)) return undefined
      const r = await $.process.run(['git', '-C', dir, 'rev-list', '--no-merges', `${head}..${ref}`, `^origin/${baseRef}`], { timeoutMs: 5_000 }).catch(() => undefined)
      return r?.exitCode === 0 ? r.stdout.trim() === '' : undefined
    },
    prOfBranch: async branch => {
      if (!BRANCH.test(branch)) return undefined
      const rows = parsed<{ number: number; headRefOid: string; baseRefName: string }[]>(await gh($.process.run(['gh', 'pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,headRefOid,baseRefName'], GH_TIMEOUT)))
      return rows && (rows[0] ?? null)
    },
    prFiles: async pr => {
      if (!PR_NUMBER.test(String(pr))) return undefined
      const out = await gh($.process.run(['gh', 'api', '--paginate', `repos/{owner}/{repo}/pulls/${pr}/files`, '--jq', '.[] | select(.status != "removed") | .filename'], GH_TIMEOUT))
      return out?.split('\n').filter(Boolean)
    },
    compare: async (base, head) => (SHA.test(base) && SHA.test(head) ? parsed<Compare>(await gh($.process.run(['gh', 'api', `repos/{owner}/{repo}/compare/${base}...${head}`, '--jq', '{status: .status, files: [.files[].filename]}'], GH_TIMEOUT))) : undefined),
    jira: async (cloud, jql, fields, page, size = JIRA_PAGE) => {
      const tool = await jiraSearchTool($)
      if (!tool) throw new Error('no Atlassian MCP server connected')
      // an answer past the engine's MCP output limit arrives as a notice, not JSON: the caller retries smaller
      const input = { cloudId: cloud, jql, fields, maxResults: size, responseContentFormat: 'markdown', ...(page && { nextPageToken: page }) }
      // the call goes through the session's permissions: asked first, so a refresh never opens a dialog
      const { decision } = await $.tool.check({ tool, input })
      if (decision !== 'allow') throw new Error(`allow ${tool} in /permissions to sync Jira`)
      const r = await $.mcp.call(tool.replace(/^mcp__(.+)__[^_]+$/, '$1'), 'searchJiraIssuesUsingJql', input)
      const text = r.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('')
      if (r.isError) throw new Error(text.slice(0, 120) || 'Jira search failed')
      const answer = r.structuredContent ?? parsed(text)
      if (answer === undefined) throw new TooLarge()
      return answer
    },
    lines: async (dir, sha, path) => {
      if (!/^[0-9a-f]{40}$/.test(sha) || path.startsWith('-')) return undefined
      const r = await $.process.run(['git', '-C', dir, 'show', `${sha}:${path}`], { timeoutMs: 10_000 }).catch(() => undefined)
      if (r?.exitCode !== 0) return undefined
      return r.stdout.split('\n').length - (r.stdout.endsWith('\n') ? 1 : 0)
    },
    show: async (dir, sha, path) => {
      if (!/^[0-9a-f]{40}$/.test(sha) || path.startsWith('-')) return undefined
      const r = await $.process.run(['git', '-C', dir, 'show', `${sha}:${path}`], { timeoutMs: 10_000 }).catch(() => undefined)
      return r?.exitCode === 0 && !r.isStdoutTruncated ? r.stdout : undefined
    },
    diffText: async (dir, from, to, paths) => {
      if (!SHA.test(from) || !SHA.test(to) || paths?.some(p => p.startsWith('-'))) return undefined
      // the guard's own diff: no external driver or textconv a repo set, binary files as text
      const r = await $.process.run(['git', '-C', dir, 'diff', '--no-ext-diff', '--no-textconv', '--text', '--no-color', '-M', from, to, ...(paths?.length ? ['--', ...paths] : [])], { timeoutMs: 15_000 }).catch(() => undefined)
      return r?.exitCode === 0 && !r.isStdoutTruncated ? r.stdout : undefined
    },
    resolve: async (dir, rev) => {
      if (!SHA.test(rev)) return undefined
      const r = await $.process.run(['git', '-C', dir, 'rev-parse', '--verify', '--quiet', `${rev}^{commit}`], { timeoutMs: 5_000 }).catch(() => undefined)
      const out = r?.exitCode === 0 ? r.stdout.trim() : ''
      return /^[0-9a-f]{40}$/.test(out) ? out : undefined
    },
    changes: async (dir, from, to) => {
      if (!SHA.test(from) || !SHA.test(to)) return undefined
      // -C: a file the model's diff could show as a copy (hunks only) must not read here as an add (shown whole)
      const r = await $.process.run(['git', '-C', dir, 'diff', '--name-status', '-C', '-z', from, to], { timeoutMs: 10_000 }).catch(() => undefined)
      if (r?.exitCode !== 0) return undefined
      // -z: status, then one path (two for a rename or copy), each NUL-terminated
      const words = r.stdout.split('\0')
      const out: { status: string; path: string; from?: string }[] = []
      for (let i = 0; i < words.length - 1;) {
        const status = words[i++]!.charAt(0)
        if (status === 'R' || status === 'C') {
          const old = words[i++]!
          out.push({ status: 'R', path: words[i++]!, from: old })
        } else out.push({ status, path: words[i++]! })
      }
      return out
    },
    descends: async (dir, from, to) => {
      if (!SHA.test(from) || !SHA.test(to)) return undefined
      const r = await $.process.run(['git', '-C', dir, 'merge-base', '--is-ancestor', from, to], { timeoutMs: 5_000 }).catch(() => undefined)
      return r?.exitCode === 0 ? true : r?.exitCode === 1 ? false : undefined
    },
    tree: async (dir, ref) => {
      if (!(SHA.test(ref) || ref === 'HEAD' || BRANCH.test(ref))) return undefined
      const r = await $.process.run(['git', '-C', dir, 'rev-parse', '--verify', '--quiet', `${ref}^{tree}`], { timeoutMs: 5_000 }).catch(() => undefined)
      const out = r?.exitCode === 0 ? r.stdout.trim() : ''
      return /^[0-9a-f]{40}$/.test(out) ? out : undefined
    },
    agents: () => $.agent.list(),
    storeGet: key => $.store.get(scope + key),
    storeSet: (key, value) => $.store.set(scope + key, value),
    log: text => $.ui.log(text),
    toast: (text, timeoutMs) => $.ui.toast(text, timeoutMs ? { timeoutMs } : undefined),
  }
}

/**
 * A save for a read that awaits: dropped once /agile-board reset ran since the read began, so an
 * answer to the old board's query never puts its tickets and PRs back.
 */
const keeper = ($: EngineInterface) => {
  const at = epoch
  return (next: Board) => {
    if (at === epoch) save($, next)
  }
}

/** Re-reads PRs and CI runs with gh. */
async function syncGh($: EngineInterface) {
  if (busy.gh) return
  busy.gh = true
  const keep = keeper($)
  try {
    const host = hostOf($)
    ghError = undefined
    const [prs, runs] = await Promise.all([host.prs(), host.runs()])
    const now = await $.clock.now()
    if (!prs || !runs) return keep({ ...board, gh: { ...board.gh, error: ghError ?? 'gh failed' } })
    keep(sampled(judged(applyRuns(applyPrs(board, prs, now), runs, now), now, false), now))
    // open PRs' files for the overlap map, read once per head
    for (const { pr, head } of filesTargets(board, FILES_PER_SYNC)) {
      const files = await host.prFiles(pr)
      if (files) keep(withFiles(board, pr, head, files))
    }
  } finally {
    busy.gh = false
  }
}

/** Re-reads the board's tickets from Jira: its projects' open sprints and the keys the loop is on. */
async function syncJira($: EngineInterface) {
  const jql = jqlOf(board)
  if (busy.jira || !jql) return
  if (!cloudId) {
    save($, { ...board, jira: { ...board.jira, error: 'no cloudId: set it under ## Skill configuration in AGENTS.md or CLAUDE.md' } })
    return
  }
  busy.jira = true
  const keep = keeper($)
  try {
    const host = hostOf($)
    let page: string | undefined
    let size = JIRA_PAGE
    const returned = new Set<string>()
    let complete = false
    for (let i = 0; i < JIRA_PAGES; i++) {
      let answer: unknown
      try {
        answer = await host.jira(cloudId, jql, ['summary', 'status', 'labels', 'statuscategorychangedate', pointsField], page, size)
      } catch (err) {
        // a page too large for the engine's limit: the same page again, half the size
        if (!(err instanceof TooLarge) || size <= JIRA_PAGE_MIN) throw err
        size = Math.max(JIRA_PAGE_MIN, Math.floor(size / 2))
        i--
        continue
      }
      keep(applyJira(board, answer, pointsField, await $.clock.now()))
      for (const issue of issuesOf(answer)) returned.add(String(issue.key))
      page = nextPageOf(answer)
      if (!page) {
        complete = true
        break
      }
    }
    // the whole read answered: what it did not return is a past sprint's, and leaves the board
    if (complete) keep(pruned(board, returned))
    for (const key of markerTargets(board, MARKER_READS + tooLarge.size).filter(k => !tooLarge.has(k)).slice(0, MARKER_READS)) {
      try {
        keep(applyJira(board, await host.jira(cloudId, `key = ${key}`, ['comment'], undefined, 1), pointsField, await $.clock.now()))
      } catch (err) {
        // one ticket whose comments pass the limit: its markers stay unread, the rest of the board syncs
        if (!(err instanceof TooLarge)) throw err
        tooLarge.add(key)
      }
    }
    const now = await $.clock.now()
    keep(sampled(judged(board, now, false), now))
  } catch (err) {
    keep({ ...board, jira: { ...board.jira, error: err instanceof Error ? err.message : String(err) } })
  } finally {
    busy.jira = false
  }
}

/** Whether the board refreshes on its own: a loop is running, or the pane was drawn in the last minute. */
const live = (now: number) => (loopRunning() && board.drain?.outcome !== 'DRAINED') || now - paneAt < 60_000

async function tick($: EngineInterface, force = false) {
  const now = await $.clock.now()
  if (!force && !live(now)) return
  if (loopRunning()) await meter($)
  const since = (s?: { at?: number }) => (s?.at === undefined ? Infinity : now - s.at)
  if (since(board.gh) >= (force ? GH_GAP : GH_EVERY)) await syncGh($)
  if (since(board.jira) >= (force ? JIRA_GAP : JIRA_EVERY)) await syncJira($)
}

/** A refresh a few seconds after a call that changed GitHub or Jira, once however many land. */
function soon($: EngineInterface) {
  if (soonQueued) return
  soonQueued = true
  $.clock.after(SOON_MS, () => {
    soonQueued = false
    void tick($, true).catch(() => undefined)
  })
}

const ORCHESTRATOR = /(^|:)(agile-10-implement|agile-11-merge-train|agile-sprint-drain)$/
const WRITES = /\b(gh\s+(pr|run|api)\b|git\s+push\b)/
const writes = (tool: string, args: Record<string, unknown>) =>
  (tool === 'Bash' && WRITES.test(String(args.command ?? ''))) || /^mcp__.+__(transitionJiraIssue|editJiraIssue|addCommentToJiraIssue|createJiraIssue|create_pull_request|merge_pull_request|update_pull_request)$/.test(tool)

/** Reads the cost ledger: the loop's spend, and the cost at each drain pass boundary that has none yet. */
async function meter($: EngineInterface) {
  const u = await $.session.usage().catch(() => undefined)
  if (u?.cost === undefined) return
  save($, stampCosts(withSpend(board, u.cost.usd), u.cost.usd))
}

/** Redraws the status line, which reads the clock for the spend rate and the forecast. */
function showStatus($: EngineInterface) {
  if (!shown) return $.ui.status(undefined)
  void $.clock.now().then(now => $.ui.status(statusText(board, now, cap, allowancesNow().length))).catch(() => undefined)
}

function save($: EngineInterface, next: Board) {
  if (next === board) return
  const before = board
  const known = new Set([...stallsOf(board), ...parkedOf(board)])
  board = next
  const fresh = [...stallsOf(board).map(s => `looping: ${s}`), ...parkedOf(board).map(s => `parked: ${s}`)].filter(s => !known.has(s.replace(/^\w+: /, '')))
  if (fresh.length) $.ui.toast(`agile: ${fresh.join(' · ')}`, { timeoutMs: 10000 })
  void $.store.set(scope + STORE_KEY, board).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
  showStatus($)
  $.ui.invalidate('ui.render')
  // a pass opened or ended: stamp the ledger at that boundary
  if (board.passes?.length !== before.passes?.length || board.passes?.at(-1)?.end !== before.passes?.at(-1)?.end) void meter($)
  if (board.drain?.outcome !== before.drain?.outcome) saveRetro($, retro)
  if (autoOpen && board.drain?.outcome === 'running' && before.drain?.outcome !== 'running') {
    // opened unasked, so it waits for a wide terminal and never takes the keyboard
    void $.ui.open({ id: PANE, title: 'agile console' }).catch(() => undefined)
  }
}

/** Writes the board to the store once, 10 s from now, for changes too frequent to write each time. */
function persistLater($: EngineInterface) {
  if (persistQueued) return
  persistQueued = true
  $.clock.after(10_000, () => {
    persistQueued = false
    void $.store.set(scope + STORE_KEY, board).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
  })
}

function saveRetro($: EngineInterface, next: Retro) {
  const synced = board.drain ? retroDrain(next, board.drain.pass, board.drain.outcome) : next
  if (synced === retro) return
  retro = synced
  void $.store.set(scope + RETRO_KEY, retro).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
}

/** A ticket a cap bypass covered is over: done, parked, or its PR merged. */
const ticketEnded = (key: string) => {
  const t = board.tickets[key]
  return t?.category === 'done' || !!t?.parked || board.prOrder.some(n => board.prs[n]?.key === key && board.prs[n]?.merged)
}

const bypassTail = (offer: Offer) =>
  config.allowBypass ? ` A person can allow this once from /agile-board guards (${offerText(offer)}): return blocked (guard, bypass available) and wait; do not ask them to run the command themselves.` : ''

/** A gate set to warn, or a call let through on a bypass: on the Guards tab and as a toast, never to the model. */
function note($: EngineInterface, entry: Refusal) {
  refusals = keepRefusal(refusals, entry)
  if (entry.kind === 'bypassed') saveRetro($, { ...retro, bypassed: (retro.bypassed ?? 0) + 1 })
  $.ui.toast(`agile guard ${entry.kind}: ${entry.text.slice(0, 160)}`, { timeoutMs: 8000 })
  $.ui.invalidate('ui.render')
}

/** /agile-board allow <n> and the Guards tab's button: a person allows the n-th open refusal once. */
async function allowAt($: EngineInterface, n: number): Promise<string> {
  if (!config.allowBypass) return 'bypass is off (agile-mods allowBypass)'
  // by id, not by position: a refusal that lands while the person reads the list changes nothing they press
  const r = offersOf(refusals).find(x => x.id === n)
  if (!r?.offer) return `no refusal [${n}] to allow: /agile-board allow lists them`
  const now = await $.clock.now()
  guardsAllow(hostOf($), r.offer, now)
  refusals = refusals.map(x => (x === r ? { ...x, offer: undefined, text: `${x.text} [allowed]` } : x))
  $.ui.toast(`agile: allowed ${offerText(r.offer)}, tell the loop to retry`, { timeoutMs: 10000 })
  showStatus($)
  $.ui.invalidate('ui.render')
  return `allowed once: ${offerText(r.offer)}. Tell the loop to retry.`
}

const COLORS: Record<string, string> = { c: 'cyan', m: 'magenta', g: 'green', y: 'yellow', r: 'red', bl: 'blue' }
const BADGES: Record<string, string> = { bgr: 'red', bgg: 'green', bgy: 'yellow' }

/** Text props for a segment's style tags. */
function styleOf(tags?: string): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const t of (tags ?? '').split(' ')) {
    if (t === 'd') props.dimColor = true
    else if (t === 'b') props.bold = true
    else if (t === 'u') props.underline = true
    else if (COLORS[t]) props.color = COLORS[t]
    else if (BADGES[t]) Object.assign(props, { backgroundColor: BADGES[t], color: 'black' })
  }
  return props
}

export const register: Register = (on, options) => {
  autoOpen = options?.autoOpen !== false
  const given = configOf(options as Record<string, unknown> | undefined)
  config = given.config
  configNotes = given.notes
  cap = config.ticketBudgetUsd
  guardsConfigure(config)

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    scope = `${r.cwd}:`
    const host = hostOf($)
    const stored = loadBoard(await $.store.get(scope + STORE_KEY).catch(() => undefined))
    // the cost ledger restarts with the session
    if (stored) board = withoutLedger(stored)
    const storedRetro = loadRetro(await $.store.get(scope + RETRO_KEY).catch(() => undefined))
    if (storedRetro) retro = storedRetro
    await guardsStart(host, r.cwd)
    // agile-10-implement's story-points-field and cloudId, pinned in the consumer repo's AGENTS.md or CLAUDE.md
    // the guard settings there too, read once now and applied only where stricter: the loop can edit those files
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      const text = await $.fs.read(`${r.cwd}/${file}`).catch(() => '')
      pointsField = pointsField === POINTS_FIELD ? (pointsFieldOf(text) ?? pointsField) : pointsField
      cloudId ??= cloudIdOf(text)
      const repo = tightened(config, repoConfigOf(text))
      config = repo.config
      configNotes = [...configNotes, ...repo.notes.map(n => `${file}: ${n}`)]
    }
    cap = config.ticketBudgetUsd
    guardsConfigure(config)
    await receiptsStart(host)
    await $.command.register({
      name: 'agile-board',
      description: 'Agile console: board, flow, cost, wip, drain, guards and links tabs, plus show, hide, retro, reset, allow <n> (agile-mods)',
      argumentHint: '[board | flow | cost | wip | drain | guards | links | show | hide | retro | reset | allow <n>]',
      immediate: true,
    }).catch(err => $.ui.log(`agile-mods: /agile-board not registered: ${err}`))
    await $.command.register(RECEIPTS_COMMAND).catch(err => $.ui.log(`agile-mods: /receipts not registered: ${err}`))
    showStatus($)
    // elapsed times move while a loop runs; the redraw is throttled by the engine
    $.clock.every(5000, () => {
      if (board.loop && board.drain?.outcome !== 'STUCK' && board.drain?.outcome !== 'DRAINED') $.ui.invalidate('ui.render')
    })
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))
    return r
  })

  on('command.run', { command: 'agile-board' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const allowArg = arg.match(/^allow(?:\s+(\d+))?$/)
    // a bypass and a reset (which drops reviews, rounds and bypasses and turns the guards off until the next loop)
    // are a person's decisions: typed at the prompt or sent from their phone, never run by the model, a plugin or a relay
    const person = e.origin?.kind === 'composer' || e.origin?.kind === 'bridge'
    if ((allowArg?.[1] || arg === 'reset') && !person) {
      return { text: `agile-mods: /agile-board ${arg} is run only by a person, at the prompt${allowArg ? ' or from the Guards tab' : ''}` }
    }
    if (arg === 'reset') {
      epoch += 1
      save($, EMPTY)
      saveRetro($, EMPTY_RETRO)
      guardsReset(hostOf($))
      receiptsReset(hostOf($))
      refusals = []
      allowed = 0
      tooLarge.clear()
      agentStats = {}
      return { text: 'agile board and retro counts cleared' }
    }
    if (allowArg) {
      if (!allowArg[1]) {
        const open = offersOf(refusals)
        return { text: open.length ? open.map(r => `[${r.id}] ${offerText(r.offer!)}: ${r.text.replace(/^agile-mods:\s*/, '').slice(0, 100)}`).join('\n') : 'no refusal to allow' }
      }
      return { text: await allowAt($, Number(allowArg[1])) }
    }
    if (arg === 'retro') return { text: retroText(retro, board, await $.clock.now()) ?? 'no loop data recorded yet' }
    if (arg === 'hide' || arg === 'show') {
      shown = arg === 'show'
      showStatus($)
      $.ui.invalidate('ui.render')
      return { text: shown ? 'agile status and alerts shown' : 'agile status and alerts hidden' }
    }
    const wanted = arg ? tabOf(arg) : tab
    if (!wanted) return { text: `unknown tab "${arg}": board, flow, wip, drain, guards, links, or show, hide, retro, reset, allow <n>` }
    tab = wanted
    paneAt = await $.clock.now()
    void tick($, true).catch(() => undefined)
    const pane = await $.ui.open({ id: PANE, title: 'agile console', focus: true, closeOnEscape: true })
    $.ui.invalidate('ui.render')
    return pane.isPlaced ? {} : { text: `the agile console needs a wider terminal (${pane.reason}); widen it and run /agile-board again` }
  })

  on('command.run', { command: 'receipts' }, async ($, e) => ({ text: await receiptsCommand(hostOf($), e.args.trim().toLowerCase()) }))

  on('tool.call', async ($, e, next) => {
    const host = hostOf($)
    const args = argsOf(e)
    // a new run's spend and ticket costs count from here: a session's first loop call while no drain runs
    // (a resumed drain keeps counting). Nothing the model can call inside a session resets it; a new
    // session or /agile-board reset starts over
    const skill = e.tool === 'Skill' ? String(args.skill ?? '') : ''
    if (ORCHESTRATOR.test(skill) && !loopRunning() && board.drain?.outcome !== 'running') {
      save($, withRun(board, await $.clock.now()))
      await meter($)
    }
    const at = await $.clock.now()
    guardsPrune(host, at, ticketEnded)
    const type = e.agentId ? await agentTypeOf(host, e.agentId) : undefined
    const by = type ? { agent: type.split(':').at(-1) } : {}
    let deny: string | undefined
    let offer: Offer | undefined
    // the tickets a build call names, among those the board knows; with none named, the ticket its agent
    // works, or the branch a PR is opened for. A cost counted so far is an estimate
    const named = [...new Set((dispatchText(args) + ' ' + String(args.command ?? '')).match(new RegExp(TICKET_KEY.source, 'g')) ?? [])].filter(k => board.tickets[k])
    const gate = config.modes.ticketBudget
    let over: ReturnType<typeof ticketBudgetDenial>
    if (cap > 0 && gate !== 'off') {
      // the ticket its agent works counts beside the ones the call names: a call that names another ticket too is no way round
      let own: string | undefined
      if (e.agentId && type) own = ticketOfWorker(await workerOf(host, e.agentId, type))
      // a call that opens a PR: the branch it names, else the one checked out where it runs (a leading `cd <dir> &&`)
      if (!named.length && !own && isBuildWork(e.tool, args) && e.tool !== 'Agent' && e.tool !== 'Skill') {
        const head = prHeadOf(e.tool, args) ?? (e.tool === 'Bash' ? await branchOf(host, String(args.command ?? '')) : undefined)
        own = ticketOfText(board, head ?? '')
      }
      const allowed = allowancesNow()
      const input = {
        cost: (k: string) => board.tickets[k]?.cost?.usd ?? 0,
        cap,
        named,
        ...(own && { own }),
        capped: board.order.filter(k => (board.tickets[k]?.cost?.usd ?? 0) >= cap && !ticketEnded(k)),
      }
      over = ticketBudgetDenial({ ...input, allowed: k => ticketBudgetOpen(allowed, k) }, e.tool, args)
      // let through only because a person allowed it: logged and counted, never told to the model
      const without = over ? undefined : ticketBudgetDenial({ ...input, allowed: () => false }, e.tool, args)
      if (without) note($, { at, rule: 'ticketBudget', kind: 'bypassed', text: `past the ticket cap on a person's bypass: ${without.text}`, ...by })
    }
    if (over) {
      if (gate === 'warn') note($, { at, rule: 'ticketBudget', kind: 'warned', text: over.text, ...by })
      else {
        // a refusal naming one ticket can be allowed once; one that names none cannot, since there is no ticket to allow
        if (over.tickets.length === 1) offer = { rule: 'ticketBudget', ticket: over.tickets[0]! }
        deny = over.text + (offer ? bypassTail(offer) : '')
      }
    }
    if (!deny) {
      const verdict = await guardsCheck(host, e.tool, args, e.agentId)
      for (const n of verdict.notes) note($, { at, rule: n.rule, kind: n.kind, text: n.text, ...by })
      if (verdict.deny) {
        deny = `agile-mods: ${verdict.deny}`
        offer = verdict.offer
      }
    }
    if (deny) {
      refusals = keepRefusal(refusals, { at, rule: ruleOf(deny), text: deny, ...by, ...(offer && config.allowBypass && { offer }) })
      $.ui.toast(deny.replace(/^agile-mods:\s*/, 'agile guard: ').replace(/ A person can allow.*$/, ''), { timeoutMs: 8000 })
      $.ui.invalidate('ui.render')
      return { deny }
    }
    allowed += 1

    const now = await $.clock.now()
    if (e.agentId) agentStats = noteCall(agentStats, e.agentId, e.tool, args, now)
    if (e.agentId) await followTicket($, host, e.agentId, e.tool, args, now)
    if (e.tool === 'Agent') noteDispatch(args, now)
    if (typeof args.cloudId === 'string' && /^mcp__.+__/.test(e.tool)) cloudId ??= args.cloudId
    // a drain that starts fresh (not resuming a running or STUCK one) empties the board: reads begun before it save nothing
    if (/(^|:)agile-sprint-drain$/.test(skill) && board.drain?.outcome !== 'running' && board.drain?.outcome !== 'STUCK') epoch += 1
    save($, withKeys(observeStart(board, e.tool, args, now), keysOf(e.tool, args)))
    saveRetro($, retroStart(retro, e.tool, args, now))
    const r = await next(e)
    const done: Finished = {
      denied: r.deny !== undefined,
      isError: r.isError === true,
      text: r.deny !== undefined || r.isError ? undefined : r.text,
    }
    // a reviewer's read that did not count: told now, so it reads again within the same review
    const readNote = await guardsAfter(host, e.tool, args, e.agentId, done.text, done.isError)
    if (writes(e.tool, args) || ((e.tool === 'Skill' || e.tool === 'Agent') && loopRunning())) soon($)
    saveRetro($, retroEnd(retro, e.tool, done.text))
    await receiptsAfter(host, e.tool, args, done)
    $.ui.invalidate('ui.render')

    if (e.tool === 'Skill' && done.text !== undefined && /(^|:)agile-15-retro$/.test(String(args.skill))) {
      const data = retroText(retro, board, await $.clock.now())
      if (data && r.deny === undefined && !r.isError) return { ...r, context: [...(r.context ?? []), data] }
    }
    if (readNote && r.deny === undefined) return { ...r, context: [...(r.context ?? []), readNote] }
    return r
  }).catch(($, e, next) => {
    // the hook threw, timed out, or was skipped on re-entry: a call a guard covers is refused rather
    // than let through unchecked; any other call goes on
    if (next.called) return next(e)
    return guardedCall(e.tool, argsOf(e)) ? { deny: 'agile-mods: the guard could not check this call, so it refuses it. Retry it.' } : next(e)
  })

  // the main loop went idle: a drain with work left whose pass moved nothing is STUCK
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || !loopRunning()) return r
    await syncGh($).catch(() => undefined)
    const now = await $.clock.now()
    save($, sampled(judged(board, now, true), now))
    saveRetro($, retro)
    await meter($)
    return r
  })

  // each model request's usage, by the stage it served: a loop agent's by its type, the main loop's by the board's stage
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (!r.usage || !loopRunning()) return r
    // bookkeeping only: a failure here never touches the request
    try {
      const type = e.agentId ? await agentTypeOf(hostOf($), e.agentId) : undefined
      const stage = type ? stageOf(type) : e.agentId ? undefined : board.stage
      const now = await $.clock.now()
      if (e.agentId) agentStats = noteTokens(agentStats, e.agentId, r.usage, now)
      if (e.agentId && type) await countRequest(hostOf($), e.agentId, type, r.usage, now)
      // counted in memory on every request, written to the store at most every 10 s
      if (stage) {
        board = withTokens(board, stage, r.usage)
        persistLater($)
      }
    } catch {
      // the next request counts again
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!shown || e.props.hasSurvey) return next(e)
    const row = alertRow(board, { now: await $.clock.now(), refusals, allowed, receipts: receiptsNow(), cap }, e.props.bodyColumns)
    if (!row) return next(e)
    const ui = await $.ui.resolve(e)
    const { Box } = ui
    return (
      <Box flexDirection="column">
        {renderRow(ui, row, 'alert')}
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    paneAt = await $.clock.now()
    const ui = await $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const usage = await $.session.usage().catch(() => undefined)
    const now = await $.clock.now()
    const agents = tab === 'drain' || tab === 'flow' || tab === 'cost' || tab === 'wip' ? await $.agent.list().catch(() => []) : []
    const lanes = tab === 'drain' ? laneOf(agents, agentStats, now) : undefined
    const live = tab === 'flow' || tab === 'cost' || tab === 'wip' ? liveOf(agents, board) : undefined
    const guard = tab === 'guards' ? { modes: modesLine(config), limits: limitsLine(config), notes: configNotes, allowances: allowancesNow(), bypass: config.allowBypass, coverage: await coverageNow($, now) } : undefined
    const ctx: Ctx = { now, usd: usage?.cost?.usd, refusals, allowed, receipts: receiptsNow(), lanes, cap, ...(live && { live }), ...(guard && { guard }) }
    const w = Math.max(30, e.props.bodyColumns - 2)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          {TABS.map(t => (
            <Button key={`tab-${t.id}`} label={t.label} hotkey={t.hotkey} plain dimColor={tab !== t.id} onPress={() => {
              tab = t.id
              $.ui.invalidate('ui.render')
            }} />
          ))}
        </Box>
        <Text>{' '}</Text>
        {consoleRows(tab, board, ctx, w).map((row, i) => renderRow(ui, row, `r${i}`, n => void allowAt($, n)))}
      </Box>
    )
  })
}

/** How each open PR's files count as read at its head, from the board's file lists; read again at most every 15 s. */
async function coverageNow($: EngineInterface, now: number): Promise<Coverage> {
  const host = hostOf($)
  for (const n of board.prOrder) {
    const pr = board.prs[n]
    if (!pr || pr.state !== 'OPEN' || !pr.files || !pr.filesHead || !/^[0-9a-f]{40}$/.test(pr.filesHead)) continue
    const known = coverage[n]
    if (known && known.head === pr.filesHead && now - known.at < 15_000) continue
    coverage = { ...coverage, [n]: { head: pr.filesHead, at: now, files: await coverageOf(host, pr.filesHead, pr.files).catch(() => ({})) } }
  }
  const open = new Set(board.prOrder.filter(n => board.prs[n]?.state === 'OPEN'))
  return Object.entries(coverage).filter(([n]) => open.has(Number(n))).map(([n, c]) => ({ pr: Number(n), head: c.head, files: c.files }))
}

/** Remembers the tickets a dispatch's prompt or description names, for the agent it starts. */
function noteDispatch(args: Record<string, unknown>, now: number) {
  const tickets = ticketsOfText(board, dispatchText(args))
  const type = String(args.subagent_type ?? '')
  if (!tickets.length || !type) return
  dispatches.push({ type, tickets, at: now })
  while (dispatches.length > 50 || (dispatches[0] && now - dispatches[0].at > 3_600_000)) dispatches.shift()
}

/** The oldest waiting dispatch of this agent type, taken so another agent of the type does not reuse it. */
function claimDispatch(type: string): string[] {
  const i = dispatches.findIndex(d => d.type === type || type.endsWith(`:${d.type}`) || d.type.endsWith(`:${type}`))
  return i < 0 ? [] : dispatches.splice(i, 1)[0]!.tickets
}

/** The ticket a subagent is shown to work, else the one ticket it was dispatched for. */
const ticketOfWorker = (w: Worker) => w.shown ?? (w.claim.length === 1 ? w.claim[0] : undefined)

/** A subagent's tracking, made when its first request or call is seen. */
async function workerOf(host: Host, id: string, type: string): Promise<Worker> {
  let w = workers.get(id)
  if (!w) {
    const info = (await host.agents().catch(() => [])).find(a => a.id === id)
    // its description and the prompt of the dispatch that started it
    const claim = [...new Set([...(info?.description ? ticketsOfText(board, info.description) : []), ...claimDispatch(type)])]
    w = { claim, accrued: {}, unattributed: 0, branchTries: 0, ...(stageOf(type) && { stage: stageOf(type)! }) }
    workers.set(id, w)
    if (workers.size > 100) workers.delete(workers.keys().next().value!)
  }
  return w
}

/**
 * Counts one request of a subagent: dollars from its tokens, working time since its last one. Any
 * subagent counts, not only the loop's own: build work dispatched as a general-purpose agent must not
 * escape the cap. The model is the one the request reports, else the one its agent file declares, else
 * the dearest tier, so a model nobody priced is never counted too low. It goes to the ticket the agent
 * is shown to work, else is shared by the tickets it was dispatched for.
 */
async function countRequest(host: Host, id: string, type: string, usage: Usage & { model?: string }, now: number) {
  const model = modelOfId(usage.model) ?? modelOf(type) ?? 'opus'
  const w = await workerOf(host, id, type)
  const ms = w.at === undefined ? 0 : now - w.at
  w.at = now
  const usd = usdOf(usage, model)
  const to = w.shown ? [w.shown] : w.claim
  const parts: Record<string, number> = {}
  // an agent that named no ticket and showed none: counted and shown, on no ticket, until its work shows one
  if (!to.length) {
    w.unattributed += usd
    board = { ...board, unattributed: (board.unattributed ?? 0) + usd }
  }
  for (const t of to) {
    board = withCost(board, t, usd / to.length, w.stage, ms / to.length, now)
    w.accrued[t] = (w.accrued[t] ?? 0) + usd / to.length
    parts[t] = usd / to.length
  }
  w.last = { parts, usd }
}

/**
 * A subagent's call that changes something for one ticket (a Jira write, a push, a PR) shows what it
 * works, whatever its dispatch said. The first such call that contradicts the claim moves all it has
 * cost so far onto that ticket, so naming another ticket in a prompt never moves cost off the one the
 * work is on. Later calls on another ticket (a session working its tickets in turn) move the request
 * that made them.
 */
async function followTicket($: EngineInterface, host: Host, id: string, tool: string, args: Record<string, unknown>, now: number) {
  const w = workers.get(id)
  if (!w) return
  let shown = strongTicket(board, tool, args)
  // an agent with no claim at all: the branch a git or gh command runs on says which ticket it works
  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  if (!shown && !w.shown && !w.claim.length && w.branchTries < 5 && /^\s*(?:cd\s+\S+\s*&&\s*)?(?:git|gh)\b/.test(command)) {
    w.branchTries += 1
    shown = ticketOfText(board, (await branchOf(host, command)) ?? '')
  }
  if (!shown || shown === w.shown) return
  const contradicted = w.shown === undefined && w.claim.length > 0 && !w.claim.includes(shown)
  if (contradicted) {
    for (const [from, usd] of Object.entries(w.accrued)) board = movedCost(board, from, shown, usd, w.stage, now)
    w.accrued = { [shown]: Object.values(w.accrued).reduce((n, x) => n + x, 0) }
    note($, { at: now, rule: 'ticketBudget', kind: 'warned', text: `agent dispatched for ${w.claim.join(', ')} worked ${shown} (${tool}): its cost counts on ${shown}` })
  } else if (w.last) {
    // the request that made this call is its ticket's, whatever it was shared by before
    for (const [from, usd] of Object.entries(w.last.parts).filter(([t]) => t !== shown)) {
      board = movedCost(board, from, shown, usd, w.stage, now)
      w.accrued[from] = (w.accrued[from] ?? 0) - usd
      w.accrued[shown] = (w.accrued[shown] ?? 0) + usd
    }
  }
  // what it cost before it showed a ticket moves onto it
  if (w.unattributed > 0) {
    board = withCost({ ...board, unattributed: Math.max(0, (board.unattributed ?? 0) - w.unattributed) }, shown, w.unattributed, w.stage, 0, now)
    w.accrued[shown] = (w.accrued[shown] ?? 0) + w.unattributed
    w.unattributed = 0
  }
  w.last = undefined
  w.shown = shown
}

/** The stage a loop agent serves, by its type; undefined for an agent outside the loop. */
const stageOf = (type: string) =>
  /^agile-execution:|:build-session$/.test(type) ? 'build' as const : /^agile-merge-review:|:merge-session$/.test(type) ? 'merge' as const : undefined

type Elements = Awaited<ReturnType<EngineInterface['ui']['resolve']>>

/** One row as elements: styled text in a line, bordered tiles, the burnup, or a link. */
function renderRow(ui: Elements, row: Row, key: string, onAllow?: (n: number) => void): RenderNode {
  const { Box, Text, Link, Button } = ui
  if (row.kind === 'link') return <Link key={key} href={row.href} label={row.label} />
  if (row.kind === 'allow') {
    return (
      <Box key={key} flexDirection="row" columnGap={1}>
        <Text dimColor>{'          '}</Text>
        <Button key={`allow-${row.n}`} label={`Allow once [${row.n}]`} plain onPress={() => onAllow?.(row.n)} />
        <Text dimColor wrap="truncate">{row.label}</Text>
      </Box>
    )
  }
  if (row.kind === 'tiles') {
    return (
      <Box key={key} flexDirection="row" columnGap={1}>
        {row.tiles.map(t => (
          <Box key={`${key}:${t.label}`} borderStyle="round" flexGrow={1} flexDirection="column" paddingX={1}>
            <Text dimColor>{t.label}</Text>
            <Text bold {...styleOf(t.tone)}>{t.value}</Text>
            <Text dimColor wrap="truncate">{t.sub}</Text>
          </Box>
        ))}
      </Box>
    )
  }
  if (row.kind === 'chart') {
    const { Raster } = ui as { Raster?: (props: Record<string, unknown>) => RenderNode }
    // a Raster draws in the terminal only; elsewhere the same data is text
    if (Raster) return Raster({ key, columns: row.chart.cols, rows: row.chart.rows, cells: rasterCells(chartCells(row.chart)) })
    return (
      <Box key={key} flexDirection="column">
        {chartGlyphs(row.chart).map((segs, i) => (
          <Box key={`${key}:${i}`} flexDirection="row">
            {segs.map((s, j) => <Text key={`g${j}`} {...styleOf(s.c)}>{s.t}</Text>)}
          </Box>
        ))}
      </Box>
    )
  }
  return (
    <Box key={key} flexDirection="row">
      {row.segs.filter(s => s.t).map((s, i) => <Text key={`s${i}`} {...styleOf(s.c)} wrap="truncate">{s.t}</Text>)}
    </Box>
  )
}
