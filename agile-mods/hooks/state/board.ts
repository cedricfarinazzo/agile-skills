// Pure board state: every function takes a state and returns a new one, so tests need no engine.
// What the board shows is read from the sources the mod queries itself (gh for PRs and CI, the Jira
// MCP server for tickets). Tool calls add only what the call itself is: which orchestrator or train
// step was dispatched, and when. No answer or receipt the model writes is read.

import type { PrRow, RunRow } from '../host.ts'
import { sameSha } from './review.ts'

export type Loop = 'implement' | 'merge-train' | 'drain'
export type Stage = 'build' | 'merge'
export type Outcome = 'running' | 'STUCK' | 'DRAINED'

export type Ticket = {
  key: string
  summary?: string
  /** The Jira status name, and its category (`new`, `indeterminate`, `done`). */
  status?: string
  category?: string
  /** The latest `agile:phase=<x>` marker in the ticket's Jira comments. */
  phase?: string
  /** `agile:phase=rework` markers in its comments. */
  reworks?: number
  /** Labelled `needs-info`, or in a Needs Info status. */
  parked?: 'needs-info'
  points?: number
  pr?: number
  /** Named by one of the loop's own Jira calls. */
  named?: boolean
  /** When its comments were last read for markers. */
  markedAt?: number
}

export type Pr = {
  number: number
  key?: string
  /** `OPEN`, `MERGED` or `CLOSED`, as gh reports it. */
  state?: string
  merged?: boolean
  head?: string
  createdAt?: number
  mergedAt?: number
  /** The train step last dispatched for this PR. */
  step?: string
  /** How many times each train step was dispatched for this PR. */
  seen?: Record<string, number>
}

/** A workflow run on a sha, the latest per workflow. */
export type Run = { id?: number; workflow: string; status: string; conclusion?: string; at?: number }

/** `cost0` and `cost1` are the session's cost in USD when the pass started and ended. */
export type Pass = { start: number; merge?: number; end?: number; cost0?: number; cost1?: number }

/** When a source last answered, and its error when the last try failed. */
export type Sync = { at?: number; error?: string }

export type Board = {
  loop?: Loop
  stage?: Stage
  drain?: { pass: number; outcome: Outcome }
  /** When the first loop of this board started: PRs created before it are history, not the board's. */
  since?: number
  tickets: Record<string, Ticket>
  order: string[]
  prs: Record<string, Pr>
  prOrder: number[]
  /** The Jira site and GitHub repo URLs, for the links tab. */
  site?: string
  repo?: string
  /** Runs by the sha they ran on. */
  runs?: Record<string, Run[]>
  /** Work left (not done, no merged PR, not parked) over time, one sample per change, in one unit. */
  burn?: { at: number; left: number; total: number }[]
  burnUnit?: 'points' | 'tickets'
  passes?: Pass[]
  gh?: Sync
  jira?: Sync
}

export const EMPTY: Board = { tickets: {}, order: [], prs: {}, prOrder: [] }

export const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/
const KEY_ONLY = /^[A-Z][A-Z0-9]+-\d+$/
export const PR_REF = /(?:\/pull\/|#|\bPR\s*#?)(\d+)/i
const PHASE = /agile:phase=([a-z_]+)/g
const SHA = /^[0-9a-f]{40}$/
/** agile-10-implement's `story-points-field` default. */
export const POINTS_FIELD = 'customfield_10016'

// the merge train's per-PR steps, by agent (dispatch) or sub-skill (inline, concurrency=0)
const STEPS: [RegExp, string][] = [
  [/(^|:)(pr-updater|merge-update-pr)$/, '3a update'],
  [/(^|:)(pr-reviewer|merge-review-pr)$/, '3b review'],
  [/(^|:)(merge-)?fix-until-satisfied$/, '3c fix'],
  [/(^|:)(merge-)?jira-postmortem$/, '4 postmortem'],
]

/** A step dispatched this many times for one PR is a loop, not progress. */
export const STALL_AT = 3
const MAX_SAMPLES = 60
const MAX_RUN_SHAS = 40
const GREEN = new Set(['success', 'skipped', 'neutral'])

export const stepOf = (name: string) => STEPS.find(([re]) => re.test(name))?.[1]
const str = (value: unknown) => (typeof value === 'string' ? value : '')
const time = (value: unknown) => {
  const t = Date.parse(str(value))
  return Number.isNaN(t) ? undefined : t
}
export const dispatchText = (args: Record<string, unknown>) => str(args.args) + ' ' + str(args.prompt) + ' ' + str(args.description)

/** Accepts a stored board, filling fields an older version did not keep. */
export function loadBoard(value: unknown): Board | undefined {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as Board).order)) return undefined
  return { ...EMPTY, ...(value as Partial<Board>) }
}

/** The consumer repo's `story-points-field` from its AGENTS.md / CLAUDE.md text. */
export const pointsFieldOf = (config: string) => config.match(/story-points-field\W*?\s*[:=]?\s*`?(customfield_\d+)/i)?.[1]

/** The consumer repo's Atlassian `cloudId` (a UUID or a site URL) from its AGENTS.md / CLAUDE.md text. */
export const cloudIdOf = (config: string) => config.match(/cloudId\W*?\s*[:=]?\s*`?([0-9a-f]{8}-[0-9a-f-]{27}|https:\/\/[^\s`'"]+)/i)?.[1]

const withTicket = (board: Board, key: string, patch: Partial<Ticket>): Board => {
  const known = board.tickets[key]
  return {
    ...board,
    tickets: { ...board.tickets, [key]: { ...known, ...patch, key } },
    order: known ? board.order : [...board.order, key],
  }
}

const withPr = (board: Board, number: number, patch: Partial<Pr>): Board => {
  const known = board.prs[number]
  const next: Board = {
    ...board,
    prs: { ...board.prs, [number]: { ...known, ...patch, number } },
    prOrder: known ? board.prOrder : [...board.prOrder, number],
  }
  const key = patch.key ?? known?.key
  return key ? withTicket(next, key, { pr: number }) : next
}

const currentPass = (board: Board) => (board.drain?.outcome === 'running' ? board.passes?.at(-1) : undefined)

const withPass = (board: Board, patch: (p: Pass) => Partial<Pass>): Board => {
  const pass = currentPass(board)
  return pass ? { ...board, passes: [...board.passes!.slice(0, -1), { ...pass, ...patch(pass) }] } : board
}

const onOrchestrator = (board: Board, skill: string, now: number): Board => {
  const draining = board.drain?.outcome === 'running'
  const since = board.since ?? now
  if (skill.endsWith('agile-sprint-drain')) return { ...board, since, loop: 'drain', stage: undefined, drain: { pass: 0, outcome: 'running' }, passes: [] }
  if (skill.endsWith('agile-10-implement')) {
    if (!draining) return { ...board, since, loop: 'implement', stage: 'build' }
    const closed = withPass(board, () => ({ end: now }))
    return {
      ...closed,
      loop: 'drain',
      stage: 'build',
      drain: { ...board.drain!, pass: board.drain!.pass + 1 },
      passes: [...(closed.passes ?? []), { start: now }],
    }
  }
  if (skill.endsWith('agile-11-merge-train')) {
    const next = { ...board, since, loop: draining ? 'drain' as const : 'merge-train' as const, stage: 'merge' as const }
    return draining ? withPass(next, p => (p.merge ? {} : { merge: now })) : next
  }
  return board
}

/**
 * Folds the start of a tool call: the orchestrator or merge-train step it dispatches, and a merge
 * command. These are facts about the call, not about how it went.
 */
export function observeStart(prior: Board, tool: string, args: Record<string, unknown>, now = 0): Board {
  // a STUCK drain that acts again is running again
  const board = prior.drain?.outcome === 'STUCK' ? { ...prior, drain: { ...prior.drain, outcome: 'running' as const } } : prior
  if (tool === 'Skill' || tool === 'Agent') {
    const name = tool === 'Skill' ? str(args.skill) : str(args.subagent_type)
    const next = tool === 'Skill' ? onOrchestrator(board, name, now) : board
    const step = stepOf(name)
    const pr = Number(dispatchText(args).match(PR_REF)?.[1])
    if (!step || !pr) return next
    const seen = next.prs[pr]?.seen ?? {}
    return withPr(next, pr, { step, seen: { ...seen, [step]: (seen[step] ?? 0) + 1 } })
  }
  const merge = tool === 'Bash' ? str(args.command).match(/\bgh pr merge\s+(\d+)/) : null
  if (merge) return withPr(board, Number(merge[1]), { step: '3f merge' })
  if (tool.endsWith('__merge_pull_request') && typeof args.pullNumber === 'number') return withPr(board, args.pullNumber, { step: '3f merge' })
  return board
}

/** Ticket keys a Jira tool call names in its own arguments, so the next sync knows the project. */
export function keysOf(tool: string, args: Record<string, unknown>): string[] {
  if (!/__(getJiraIssue|editJiraIssue|transitionJiraIssue|addCommentToJiraIssue)$/.test(tool)) return []
  const key = str(args.issueIdOrKey)
  return KEY_ONLY.test(key) ? [key] : []
}

/** Adds tickets by key, before Jira has answered for them. */
export const withKeys = (board: Board, keys: string[]): Board => keys.reduce((b, k) => (b.tickets[k]?.named ? b : withTicket(b, k, { named: true })), board)

/**
 * Folds `gh pr list`: every open PR, and any PR that is already on the board, names a board
 * ticket, or was created since the first loop started.
 */
export function applyPrs(prior: Board, rows: PrRow[], now: number): Board {
  let board: Board = { ...prior, gh: { at: now } }
  for (const row of rows) {
    if (typeof row.number !== 'number') continue
    const key = (str(row.headRefName) + ' ' + str(row.title)).match(TICKET_KEY)?.[0]
    const createdAt = time(row.createdAt)
    const relevant = row.state === 'OPEN' || board.prs[row.number] || (key && board.tickets[key]) || (board.since !== undefined && createdAt !== undefined && createdAt >= board.since)
    if (!relevant) continue
    const repo = str(row.url).match(/^(https:\/\/[^\s]+?)\/pull\/\d+$/)?.[1]
    if (repo && !board.repo) board = { ...board, repo }
    const mergedAt = time(row.mergedAt)
    board = withPr(board, row.number, {
      ...(key && { key }),
      ...(row.state && { state: row.state }),
      merged: row.state === 'MERGED',
      ...(SHA.test(str(row.headRefOid)) && { head: str(row.headRefOid) }),
      ...(createdAt !== undefined && { createdAt }),
      ...(mergedAt !== undefined && { mergedAt }),
      ...(row.state === 'MERGED' && { step: 'merged' }),
    })
  }
  return board
}

/** Folds `gh run list`: the latest run per workflow on each sha, newest shas kept. */
export function applyRuns(prior: Board, rows: RunRow[], now: number): Board {
  const runs: Record<string, Run[]> = { ...prior.runs }
  for (const row of [...rows].sort((a, b) => (time(a.createdAt) ?? 0) - (time(b.createdAt) ?? 0))) {
    const sha = str(row.headSha)
    if (!SHA.test(sha) || !str(row.status)) continue
    const workflow = str(row.workflowName) || 'ci'
    const run: Run = { ...(typeof row.databaseId === 'number' && { id: row.databaseId }), workflow, status: str(row.status), ...(str(row.conclusion) && { conclusion: str(row.conclusion) }), ...(time(row.createdAt) !== undefined && { at: time(row.createdAt) }) }
    const known = runs[sha] ?? []
    // re-inserted, so the newest shas sort last and survive the cap
    delete runs[sha]
    runs[sha] = [...known.filter(r => r.workflow !== workflow), run]
  }
  const shas = Object.keys(runs)
  const kept = shas.length > MAX_RUN_SHAS ? Object.fromEntries(shas.slice(-MAX_RUN_SHAS).map(s => [s, runs[s]!])) : runs
  return { ...prior, runs: kept, gh: { at: now } }
}

/** The CI verdict over every workflow on one sha: green, red (the first failing conclusion), pending, or none. */
export function ciOf(runs: Run[] | undefined): { state: 'green' | 'red' | 'pending' | 'none'; detail?: string } {
  if (!runs?.length) return { state: 'none' }
  const red = runs.find(r => r.status === 'completed' && !GREEN.has(r.conclusion ?? ''))
  if (red) return { state: 'red', detail: `${red.workflow} ${red.conclusion ?? 'failed'}` }
  const pending = runs.find(r => r.status !== 'completed')
  if (pending) return { state: 'pending', detail: `${pending.workflow} ${pending.status}` }
  return { state: 'green' }
}

/** The runs recorded on a sha (full or abbreviated). */
export const runsOf = (board: Board, sha: string): Run[] | undefined =>
  Object.entries(board.runs ?? {}).find(([s]) => sameSha(s, sha))?.[1]

type Issue = { key?: unknown; webUrl?: unknown; fields?: Record<string, unknown> }

/** Every `{ key, fields }` object in a Jira search answer. */
function issuesOf(answer: unknown): Issue[] {
  const found: Issue[] = []
  const walk = (node: unknown, depth: number) => {
    if (depth > 5 || typeof node !== 'object' || node === null) return
    if (Array.isArray(node)) return node.forEach(n => walk(n, depth + 1))
    const issue = node as Issue
    if (typeof issue.key === 'string' && TICKET_KEY.test(issue.key) && typeof issue.fields === 'object' && issue.fields) return void found.push(issue)
    for (const v of Object.values(node)) walk(v, depth + 1)
  }
  walk(answer, 0)
  return found
}

/**
 * Folds a Jira search answer: status, points and the `needs-info` park from a sprint search, the
 * phase markers and reworks from a search that asked for `comment`. A field the search did not ask
 * for is left as it was.
 */
export function applyJira(prior: Board, answer: unknown, field: string, now: number): Board {
  let board: Board = { ...prior, jira: { at: now } }
  for (const issue of issuesOf(answer)) {
    const key = issue.key as string
    const f = issue.fields!
    const status = f.status as { name?: unknown; statusCategory?: { key?: unknown } } | undefined
    const labels = Array.isArray(f.labels) ? f.labels.map(str) : []
    const phases = f.comment === undefined ? undefined : [...JSON.stringify(f.comment).matchAll(PHASE)].map(m => m[1]!)
    const points = f[field]
    const site = str(issue.webUrl).match(/^(https:\/\/[^/]+)\/browse\//)?.[1]
    if (site && !board.site) board = { ...board, site }
    const parked = labels.includes('needs-info') || /needs?.?info/i.test(str(status?.name))
    board = withTicket(board, key, {
      ...(str(f.summary) && { summary: str(f.summary) }),
      ...(status && {
        status: str(status.name),
        category: str(status.statusCategory?.key),
        parked: parked ? 'needs-info' as const : undefined,
      }),
      ...(phases && { phase: phases.at(-1), reworks: phases.filter(p => p === 'rework').length, markedAt: now }),
      ...(typeof points === 'number' && { points }),
    })
  }
  return board
}

/** The token of a search answer's next page (`pageInfo.endCursor`, or `nextPageToken`), when there is one. */
export function nextPageOf(answer: unknown): string | undefined {
  const a = answer as { nextPageToken?: unknown; isLast?: unknown; issues?: { pageInfo?: { hasNextPage?: unknown; endCursor?: unknown } } } | undefined
  const info = a?.issues?.pageInfo
  if (info) return info.hasNextPage === true && typeof info.endCursor === 'string' ? info.endCursor : undefined
  return a?.isLast !== true && typeof a?.nextPageToken === 'string' ? a.nextPageToken : undefined
}

/** The Jira projects the board knows of, from its ticket keys. */
export const projectsOf = (board: Board) => [...new Set([...board.order, ...board.prOrder.map(n => board.prs[n]?.key ?? '')].filter(k => KEY_ONLY.test(k)).map(k => k.split('-')[0]!))]

/**
 * The open tickets whose comments to read next for phase markers, a few per refresh, least recently
 * read first: the ones the loop is working (named by its Jira calls, with a PR, or in progress).
 * One ticket per query, since a search that returns comments for a whole sprint is too large.
 */
export function markerTargets(board: Board, n: number): string[] {
  return board.order
    .filter(k => {
      const t = board.tickets[k]!
      return KEY_ONLY.test(k) && t.category !== 'done' && (t.named || t.pr || t.category === 'indeterminate')
    })
    .sort((a, b) => (board.tickets[a]!.markedAt ?? 0) - (board.tickets[b]!.markedAt ?? 0))
    .slice(0, n)
}

/** The JQL for the board's tickets: its projects' open sprints, and every key already on it. */
export function jqlOf(board: Board): string | undefined {
  const projects = projectsOf(board)
  if (!projects.length) return undefined
  const keys = board.order.filter(k => KEY_ONLY.test(k)).slice(-50)
  return `(project in (${projects.join(', ')}) AND sprint in openSprints())${keys.length ? ` OR key in (${keys.join(', ')})` : ''}`
}

const isDone = (board: Board, key: string) => {
  const t = board.tickets[key]!
  return t.category === 'done' || !!(t.pr && board.prs[t.pr]?.merged)
}

/**
 * Work not yet done, merged or parked, out of every ticket the board knows: in story points when
 * every ticket's points are known, else in tickets (a mixed sum would mean neither).
 */
export function leftOf(board: Board): { left: number; total: number; unit: 'points' | 'tickets' } {
  const unit = board.order.length && board.order.every(k => typeof board.tickets[k]?.points === 'number') ? 'points' : 'tickets'
  const weight = (k: string) => (unit === 'points' ? board.tickets[k]!.points! : 1)
  const sum = (keys: string[]) => keys.reduce((s, k) => s + weight(k), 0)
  const left = board.order.filter(k => !board.tickets[k]!.parked && !isDone(board, k))
  return { left: sum(left), total: sum(board.order), unit }
}

/** Adds a burndown sample when the counts changed since the last one; a unit change restarts the line. */
export function sampled(board: Board, now: number): Board {
  const { left, total, unit } = leftOf(board)
  const samples = board.burnUnit === unit ? (board.burn ?? []) : []
  const last = samples.at(-1)
  if (!total || (last && last.left === left && last.total === total)) return board
  return { ...board, burnUnit: unit, burn: [...samples, { at: now, left, total }].slice(-MAX_SAMPLES) }
}

/** What a drain can still act on: tickets neither done, merged nor parked, and the board's open ticket PRs. */
export function actionableOf(board: Board): number {
  const tickets = board.order.filter(k => !board.tickets[k]!.parked && !isDone(board, k)).length
  const prs = board.prOrder.filter(n => board.prs[n]!.state === 'OPEN' && board.prs[n]!.key).length
  return tickets + prs
}

/** PRs created and merged inside a pass, from gh's own timestamps. */
export function movesOf(board: Board, p: Pass, now: number): { built: number; merged: number } {
  const end = p.end ?? now
  const inside = (t?: number) => t !== undefined && t >= p.start && t <= end
  const prs = board.prOrder.map(n => board.prs[n]!)
  return { built: prs.filter(pr => inside(pr.createdAt)).length, merged: prs.filter(pr => inside(pr.mergedAt)).length }
}

/** Whether CI is still running on the head of an open ticket PR: a drain waiting on it is not stuck. */
const ciPending = (board: Board) =>
  board.prOrder.some(n => {
    const p = board.prs[n]!
    return p.state === 'OPEN' && p.key && p.head && ciOf(runsOf(board, p.head)).state === 'pending'
  })

/**
 * The drain's outcome from the sources: DRAINED once Jira has answered and nothing actionable is
 * left; STUCK when the session went idle (`idle`) with work left, no CI running on an open ticket
 * PR, and a current pass that moved nothing.
 */
export function judged(board: Board, now: number, idle: boolean): Board {
  if (board.drain?.outcome !== 'running' || !board.drain.pass) return board
  const left = actionableOf(board)
  const pass = currentPass(board)
  const outcome: Outcome | undefined = board.jira?.at !== undefined && !board.jira.error && board.order.length && !left
    ? 'DRAINED'
    : idle && left && pass && !ciPending(board) && !Object.values(movesOf(board, pass, now)).some(Boolean) ? 'STUCK' : undefined
  if (!outcome) return board
  const closed = withPass(board, () => ({ end: now }))
  return { ...closed, drain: { ...board.drain, outcome } }
}

/** Stalls: a PR step dispatched STALL_AT times or more, a ticket reworked STALL_AT times or more. */
export function stallsOf(board: Board): string[] {
  const prs = board.prOrder.flatMap(n => {
    const p = board.prs[n]!
    return p.merged ? [] : Object.entries(p.seen ?? {}).filter(([, c]) => c >= STALL_AT).map(([s, c]) => `PR #${n} ${s} ×${c}`)
  })
  const tickets = board.order.flatMap(k => ((board.tickets[k]!.reworks ?? 0) >= STALL_AT && !isDone(board, k) ? [`${k} rework ×${board.tickets[k]!.reworks}`] : []))
  return [...prs, ...tickets]
}

/** Parked tickets, with why. */
export const parkedOf = (board: Board): string[] => board.order.flatMap(k => (board.tickets[k]!.parked ? [`${k} Needs Info`] : []))

/** The links pane: each ticket's Jira page and each PR, once the site and repo are known. */
export function linksOf(board: Board): { label: string; href: string }[] {
  const tickets = board.site ? board.order.map(key => ({ label: `${key} ${board.tickets[key]?.status ?? ''}`.trim(), href: `${board.site}/browse/${key}` })) : []
  const prs = board.repo ? board.prOrder.map(n => ({ label: `PR #${n}${board.prs[n]?.key ? ` ${board.prs[n]!.key}` : ''}${board.prs[n]?.merged ? ' merged' : ''}`, href: `${board.repo}/pull/${n}` })) : []
  return [...tickets, ...prs]
}

export const LANES = ['3a', '3b', '3c', '3e', '3f', '4'] as const
export type Cell = 'done' | 'now' | 'todo' | 'fail'

/** One swimlane row per PR: a cell per train step, and the CI state of its head as gh reports it. */
export function laneRows(board: Board): { pr: number; key: string; cells: Cell[]; ci: string }[] {
  return board.prOrder.map(n => {
    const p = board.prs[n]!
    const ci = ciOf(p.head ? runsOf(board, p.head) : undefined)
    const current = p.merged ? '4' : p.step?.split(' ')[0]
    const reached = new Set(Object.keys(p.seen ?? {}).map(s => s.split(' ')[0]!))
    if (ci.state !== 'none') reached.add('3e')
    if (p.step === '3f merge' || p.merged) reached.add('3f')
    const cells = LANES.map((lane): Cell => {
      if (p.merged) return 'done'
      if (lane === '3e' && ci.state === 'red') return 'fail'
      if (lane === '3e' && ci.state === 'pending') return 'now'
      if (lane === current) return 'now'
      return reached.has(lane) ? 'done' : 'todo'
    })
    const text = ci.state === 'none' ? '' : ci.state === 'green' ? 'CI ✔' : ci.state === 'red' ? `CI ✖ ${ci.detail}` : `CI … ${ci.detail}`
    return { pr: n, key: p.key ?? '', cells, ci: p.state === 'CLOSED' ? 'closed' : text }
  })
}

/** Records the session's cost on each pass boundary that has none yet; the same board when nothing is new. */
export function stampCosts(board: Board, usd: number): Board {
  const passes = board.passes ?? []
  const next = passes.map(p => {
    const cost0 = p.cost0 ?? usd
    const cost1 = p.end !== undefined ? (p.cost1 ?? usd) : p.cost1
    return cost0 === p.cost0 && cost1 === p.cost1 ? p : { ...p, cost0, cost1 }
  })
  return next.every((p, i) => p === passes[i]) ? board : { ...board, passes: next }
}

/** What one pass cost in USD: until its end, or until `usd` while it runs; undefined before it was stamped. */
export const passCost = (p: Pass, usd?: number): number | undefined => {
  const end = p.cost1 ?? (p.end === undefined ? usd : undefined)
  return p.cost0 === undefined || end === undefined ? undefined : Math.max(0, end - p.cost0)
}
