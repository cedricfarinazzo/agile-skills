// Pure board state: every function takes a state and returns a new one, so tests need no engine.

export type Loop = 'implement' | 'merge-train' | 'drain'
export type Stage = 'build' | 'merge'
export type Outcome = 'running' | 'STUCK' | 'DRAINED'

export type Ticket = {
  key: string
  phase?: string
  pr?: number
  /** Set by ticket-validator's verdict: sent back as Needs Info, or parked on a critical decision. */
  parked?: 'needs-info' | 'decision'
  reworks?: number
}

export type Pr = {
  number: number
  key?: string
  step?: string
  merged?: boolean
  /** How many times each train step started for this PR. */
  seen?: Record<string, number>
  /** The sha the last review vouched for (`Reviewed sha:`). */
  reviewed?: string
  /** The PR head, from the last `gh pr view --json headRefOid` or pinned merge. */
  head?: string
}

/** A CI run as `gh run view/list --json` reported it, keyed by the sha it ran on. */
export type Run = { id?: number; status: string; conclusion?: string; reads: number }

export type Pass = { start: number; merge?: number; end?: number; built: number; merged: number }

export type Board = {
  loop?: Loop
  stage?: Stage
  drain?: { pass: number; outcome: Outcome }
  tickets: Record<string, Ticket>
  order: string[]
  prs: Record<string, Pr>
  prOrder: number[]
  /** The Jira site (`https://x.atlassian.net`) and GitHub repo URL, read off tool output. */
  site?: string
  repo?: string
  runs?: Record<string, Run>
  /** Story points by ticket key, from the loop's own Jira reads. */
  points?: Record<string, number>
  /** Work left (no merged PR, not parked) over time, one sample per change, in one unit. */
  burn?: { at: number; left: number; total: number }[]
  burnUnit?: 'points' | 'tickets'
  passes?: Pass[]
}

export const EMPTY: Board = { tickets: {}, order: [], prs: {}, prOrder: [] }

const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/
const PHASE = /agile:phase=([a-z_]+)/g
const PR_URL = /\/pull\/(\d+)/
export const PR_REF = /(?:\/pull\/|#|\bPR\s*#?)(\d+)/i
const JIRA_SITE = /(https:\/\/[^\s"'<>()/]+)\/browse\/[A-Z][A-Z0-9]+-\d+/
const GITHUB_REPO = /(https:\/\/github\.com\/[^\s"'<>()/]+\/[^\s"'<>()/]+)\/pull\/\d+/
const OUTCOME = /══\s*(DRAINED|STUCK)\s*══/
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

/** A step started this many times for one PR is a loop, not progress. */
export const STALL_AT = 3
const MAX_SAMPLES = 60
const MAX_RUNS = 40

export const stepOf = (name: string) => STEPS.find(([re]) => re.test(name))?.[1]
const str = (value: unknown) => (typeof value === 'string' ? value : '')
const dispatchText = (args: Record<string, unknown>) => str(args.args) + ' ' + str(args.prompt) + ' ' + str(args.description)

/** Accepts a stored board, filling fields an older version did not keep. */
export function loadBoard(value: unknown): Board | undefined {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as Board).order)) return undefined
  return { ...EMPTY, ...(value as Partial<Board>) }
}

/**
 * The PR and sha a finished review vouches for: `Reviewed sha: <sha>`, or the new sha of a
 * delta review (`<old>..<new>`); the PR from the receipt's heading, else from the dispatch.
 */
export function reviewedOf(args: Record<string, unknown>, text: string): { pr: number; sha: string } | undefined {
  const line = text.match(/^.*Reviewed sha:.*$/im)?.[0]
  const sha = line?.match(/\b[0-9a-f]{7,40}\b/g)?.at(-1)
  const pr = Number(text.match(/## PR #(\d+) Review/)?.[1] ?? dispatchText(args).match(PR_REF)?.[1])
  return sha && pr ? { pr, sha } : undefined
}

export const sameSha = (a: string, b: string) => a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a))

/** The CI run recorded for a sha (full or abbreviated). */
export const runOf = (board: Board, sha: string): Run | undefined =>
  Object.entries(board.runs ?? {}).find(([s]) => sameSha(s, sha))?.[1]

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
  if (skill.endsWith('agile-sprint-drain')) return { ...board, loop: 'drain', stage: undefined, drain: { pass: 0, outcome: 'running' }, passes: [] }
  if (skill.endsWith('agile-10-implement')) {
    if (!draining) return { ...board, loop: 'implement', stage: 'build' }
    const closed = withPass(board, () => ({ end: now }))
    return {
      ...closed,
      loop: 'drain',
      stage: 'build',
      drain: { ...board.drain!, pass: board.drain!.pass + 1 },
      passes: [...(closed.passes ?? []), { start: now, built: 0, merged: 0 }],
    }
  }
  if (skill.endsWith('agile-11-merge-train')) {
    const next = { ...board, loop: draining ? 'drain' as const : 'merge-train' as const, stage: 'merge' as const }
    return draining ? withPass(next, p => (p.merge ? {} : { merge: now })) : next
  }
  return board
}

/**
 * Folds the start of a tool call: what is about to run shows while it runs
 * (an orchestrator, a merge-train step, a merge command).
 */
export function observeStart(board: Board, tool: string, args: Record<string, unknown>, now = 0): Board {
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
  return board
}

type Listed = { number?: unknown; title?: unknown; headRefName?: unknown; mergedAt?: unknown; headRefOid?: unknown }
type RunRow = { databaseId?: unknown; headSha?: unknown; status?: unknown; conclusion?: unknown }

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const merged = (board: Board, number: number): Board => {
  const known = board.prs[number]
  const next = withPr(board, number, { merged: true, step: 'merged' })
  return known?.merged ? next : withPass(next, p => ({ merged: p.merged + 1 }))
}

const listed = (board: Board, text: string, isMerged: boolean): Board => {
  const rows = parseJson(text)
  if (!Array.isArray(rows)) return board
  return (rows as Listed[]).reduce((b, row) => {
    if (typeof row.number !== 'number') return b
    // a merged listing only closes PRs already on the board; it does not add history
    if (isMerged) return b.prs[row.number] ? merged(b, row.number) : b
    const key = (str(row.headRefName) + ' ' + str(row.title)).match(TICKET_KEY)?.[0]
    const head = SHA.test(str(row.headRefOid)) ? str(row.headRefOid) : undefined
    return withPr(b, row.number, { ...(key && { key }), ...(head && { head }) })
  }, board)
}

const created = (board: Board, pr: number, key: string | undefined): Board => {
  const known = board.prs[pr]
  const next = withPr(board, pr, key ? { key } : {})
  return known ? next : withPass(next, p => ({ built: p.built + 1 }))
}

/** Records every run in a `gh run view/list --json` answer that names its head sha. */
const withRuns = (board: Board, text: string): Board => {
  const parsed = parseJson(text)
  const rows = (Array.isArray(parsed) ? parsed : [parsed]) as RunRow[]
  let runs = board.runs ?? {}
  for (const row of rows) {
    const sha = str(row?.headSha)
    if (!SHA.test(sha) || !str(row.status)) continue
    const known = runs[sha]
    const id = typeof row.databaseId === 'number' ? row.databaseId : known?.id
    const same = known && known.status === str(row.status) && known.conclusion === (str(row.conclusion) || undefined)
    const { [sha]: _, ...rest } = runs
    runs = { ...rest, [sha]: { ...(id && { id }), status: str(row.status), ...(str(row.conclusion) && { conclusion: str(row.conclusion) }), reads: same ? known.reads + 1 : 1 } }
  }
  const keys = Object.keys(runs)
  if (keys.length > MAX_RUNS) runs = Object.fromEntries(keys.slice(-MAX_RUNS).map(k => [k, runs[k]!]))
  return runs === board.runs ? board : { ...board, runs }
}

/** The consumer repo's `story-points-field` from its AGENTS.md / CLAUDE.md text. */
export const pointsFieldOf = (config: string) => config.match(/story-points-field\W*?\s*[:=]?\s*`?(customfield_\d+)/i)?.[1]

/** Every `{ key, fields: { <points field>: n } }` in a Jira search or issue answer. */
function withPoints(board: Board, text: string, field: string): Board {
  const found: Record<string, number> = {}
  const walk = (node: unknown, depth: number) => {
    if (depth > 6 || typeof node !== 'object' || node === null) return
    if (Array.isArray(node)) return node.forEach(n => walk(n, depth + 1))
    const { key, fields } = node as { key?: unknown; fields?: Record<string, unknown> }
    const points = fields?.[field]
    if (typeof key === 'string' && TICKET_KEY.test(key) && typeof points === 'number') found[key] = points
    for (const v of Object.values(node)) walk(v, depth + 1)
  }
  walk(parseJson(text), 0)
  if (!Object.keys(found).length) return board
  return { ...board, points: { ...board.points, ...found } }
}

/**
 * Folds one finished tool call into the board.
 *
 * @param args the call's input as `tool.call` carries it (the tool's arguments beside `tool`)
 * @param text what the model read back; undefined on a deny or an error
 * @param field the Jira field holding story points
 */
export function observeTool(prior: Board, tool: string, args: Record<string, unknown>, text: string | undefined, field = POINTS_FIELD): Board {
  if (text === undefined) return prior
  const site = tool.startsWith('mcp__atlassian__') && !prior.site ? text.match(JIRA_SITE)?.[1] : undefined
  const repo = !prior.repo ? text.match(GITHUB_REPO)?.[1] : undefined
  const board = site || repo ? { ...prior, ...(site && { site }), ...(repo && { repo }) } : prior

  if (tool === 'mcp__atlassian__searchJiraIssuesUsingJql' || tool === 'mcp__atlassian__getJiraIssue') return withPoints(board, text, field)

  if (tool === 'mcp__atlassian__addCommentToJiraIssue') {
    const key = str(args.issueIdOrKey)
    const phases = [...str(args.commentBody).matchAll(PHASE)].map(m => m[1]!)
    const phase = phases.at(-1)
    if (!TICKET_KEY.test(key) || !phase) return board
    const reworks = phases.filter(p => p === 'rework').length
    const known = board.tickets[key]
    return withTicket(board, key, { phase, ...(reworks && { reworks: (known?.reworks ?? 0) + reworks }) })
  }

  if (tool === 'Agent') {
    const agent = str(args.subagent_type)
    if (/(^|:)ticket-validator$/.test(agent)) {
      const key = dispatchText(args).match(TICKET_KEY)?.[0]
      const verdict = text.match(/\b(critical-park|rejected)\b/)?.[1]
      return key && verdict ? withTicket(board, key, { parked: verdict === 'rejected' ? 'needs-info' : 'decision' }) : board
    }
    if (/(^|:)pr-reviewer$/.test(agent)) {
      const review = reviewedOf(args, text)
      return review ? withPr(board, review.pr, { reviewed: review.sha }) : board
    }
    return board
  }

  if (tool === 'mcp__github__create_pull_request') {
    const key = (str(args.head) + ' ' + str(args.title)).match(TICKET_KEY)?.[0]
    const pr = Number(text.match(PR_URL)?.[1])
    return pr ? created(board, pr, key) : board
  }

  // the MCP merge answers from the API, so a non-error result is the merge
  if (tool === 'mcp__github__merge_pull_request') {
    return typeof args.pullNumber === 'number' ? merged(board, args.pullNumber) : board
  }

  if (tool === 'Bash') {
    const command = str(args.command)
    if (/\bgh pr create\b/.test(command)) {
      const key = command.match(TICKET_KEY)?.[0]
      const pr = Number(text.match(PR_URL)?.[1])
      return pr ? created(board, pr, key) : board
    }
    if (/\bgh pr list\b/.test(command) && /--json\b/.test(command)) {
      const state = command.match(/--state\s+(\w+)/)?.[1] ?? 'open'
      return state === 'open' || state === 'merged' ? listed(board, text, state === 'merged') : board
    }
    if (/\bgh run (view|list)\b/.test(command) && /headSha/.test(command)) return withRuns(board, text)
    const view = command.match(/\bgh pr view\s+(\d+)\b/)
    if (view) {
      const pr = Number(view[1])
      const row = parseJson(text) as Listed | undefined
      const head = /headRefOid/.test(command) ? (SHA.test(str(row?.headRefOid)) ? str(row?.headRefOid) : text.trim().match(SHA)?.[0]) : undefined
      const next = head ? withPr(board, pr, { head }) : board
      // gh pr merge's exit code is not the signal: only a view showing mergedAt is
      return /mergedAt/.test(command) && typeof row?.mergedAt === 'string' && row.mergedAt ? merged(next, pr) : next
    }
  }

  return board
}

/** Folds a finished turn's answer: the drain's closing banner sets its outcome, an inline review's receipt its sha. */
export function observeAnswer(board: Board, text: string, now = 0, inlineReview?: number): Board {
  const review = inlineReview !== undefined ? reviewedOf({ args: `PR ${inlineReview}` }, text) : undefined
  const reviewed = review ? withPr(board, review.pr, { reviewed: review.sha }) : board
  const outcome = text.match(OUTCOME)?.[1] as Outcome | undefined
  if (!outcome || !reviewed.drain) return reviewed
  const closed = withPass(reviewed, () => ({ end: now }))
  return { ...closed, drain: { ...reviewed.drain, outcome } }
}

/**
 * Work not yet merged or parked, out of every ticket the board knows: in story points when every
 * ticket's points are known, else in tickets (a mixed sum would mean neither).
 */
export function leftOf(board: Board): { left: number; total: number; unit: 'points' | 'tickets' } {
  const points = board.points ?? {}
  const unit = board.order.length && board.order.every(k => k in points) ? 'points' : 'tickets'
  const weight = (k: string) => (unit === 'points' ? points[k]! : 1)
  const sum = (keys: string[]) => keys.reduce((s, k) => s + weight(k), 0)
  const left = board.order.filter(k => {
    const t = board.tickets[k]!
    return !t.parked && !(t.pr && board.prs[t.pr]?.merged)
  })
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

const BARS = '▁▂▃▄▅▆▇█'

/** The burndown band line: tickets left over time as a sparkline. */
export function burnLine(board: Board, width = 24): string | undefined {
  const samples = board.burn ?? []
  if (samples.length < 2) return undefined
  const max = Math.max(...samples.map(s => s.total))
  const bars = samples.slice(-width).map(s => BARS[Math.min(BARS.length - 1, Math.round((s.left / max) * (BARS.length - 1)))]).join('')
  const last = samples.at(-1)!
  return `burn ${bars}  ${last.left}/${last.total} ${board.burnUnit === 'points' ? 'pts' : 'tickets'} left`
}

/** Stalls: a PR step started STALL_AT times or more, a ticket reworked STALL_AT times or more. */
export function stallsOf(board: Board): string[] {
  const prs = board.prOrder.flatMap(n => {
    const p = board.prs[n]!
    return p.merged ? [] : Object.entries(p.seen ?? {}).filter(([, c]) => c >= STALL_AT).map(([s, c]) => `PR #${n} ${s} ×${c}`)
  })
  const tickets = board.order.flatMap(k => ((board.tickets[k]!.reworks ?? 0) >= STALL_AT ? [`${k} rework ×${board.tickets[k]!.reworks}`] : []))
  return [...prs, ...tickets]
}

/** Parked tickets, with why. */
export const parkedOf = (board: Board): string[] =>
  board.order.flatMap(k => {
    const why = board.tickets[k]!.parked
    return why ? [`${k} ${why === 'needs-info' ? 'Needs Info' : 'awaiting decision'}`] : []
  })

export const drainLine = (board: Board): string | undefined =>
  board.drain
    ? `drain · pass ${board.drain.pass}${board.drain.outcome === 'running' && board.stage ? ` · ${board.stage}` : ''} · ${board.drain.outcome}`
    : undefined

/** Build queue: one line per ticket without a merged PR, newest last. */
export function buildLines(board: Board, rows: number): string[] {
  const keys = board.order.filter(k => {
    const pr = board.tickets[k]?.pr
    return !(pr && board.prs[pr]?.merged)
  })
  // slice(-0) is slice(0): zero rows must draw nothing, not the whole queue
  if (rows <= 0) return []
  return keys.slice(-rows).map(key => {
    const t = board.tickets[key]!
    const phase = t.parked ? (t.parked === 'needs-info' ? 'needs info' : 'parked') : (t.phase ?? '—')
    return `${key.padEnd(10)} ${phase.padEnd(13)}${t.pr ? ` PR #${t.pr}` : ''}`
  })
}

/** The links pane: each ticket's Jira page and each PR, once the site and repo are known. */
export function linksOf(board: Board): { label: string; href: string }[] {
  const tickets = board.site ? board.order.map(key => ({ label: `${key} ${board.tickets[key]?.phase ?? ''}`.trim(), href: `${board.site}/browse/${key}` })) : []
  const prs = board.repo ? board.prOrder.map(n => ({ label: `PR #${n}${board.prs[n]?.key ? ` ${board.prs[n]!.key}` : ''}${board.prs[n]?.merged ? ' merged' : ''}`, href: `${board.repo}/pull/${n}` })) : []
  return [...tickets, ...prs]
}

/** Merge queue: open PRs first in list order, then the merged ones, capped to the rows. */
export function mergeLines(board: Board, rows: number): string[] {
  const prs = board.prOrder.map(n => board.prs[n]!)
  const sorted = [...prs.filter(p => !p.merged), ...prs.filter(p => p.merged)]
  return sorted.slice(0, Math.max(0, rows)).map(p => {
    const loops = Object.entries(p.seen ?? {}).filter(([, c]) => c >= STALL_AT).map(([s, c]) => ` ⟳${s.split(' ')[0]}×${c}`).join('')
    return `#${String(p.number).padEnd(6)} ${(p.key ?? '').padEnd(10)} ${p.merged ? 'merged' : (p.step ?? 'queued')}${p.merged ? '' : loops}`
  })
}

export const LANES = ['3a', '3b', '3c', '3e', '3f', '4'] as const
export type Cell = 'done' | 'now' | 'todo' | 'fail'

/** One swimlane row per PR: a cell per train step, the CI state of its head, its reviewed sha. */
export function laneRows(board: Board): { pr: number; key: string; cells: Cell[]; ci: string; reviewed: string }[] {
  return board.prOrder.map(n => {
    const p = board.prs[n]!
    const run = p.head ? runOf(board, p.head) : undefined
    const green = run?.status === 'completed' && run.conclusion === 'success'
    const red = run?.status === 'completed' && run.conclusion !== 'success'
    const current = p.merged ? '4' : p.step?.split(' ')[0]
    const reached = new Set(Object.keys(p.seen ?? {}).map(s => s.split(' ')[0]!))
    if (run) reached.add('3e')
    if (p.step === '3f merge' || p.merged) reached.add('3f')
    const cells = LANES.map((lane): Cell => {
      if (p.merged) return 'done'
      if (lane === '3e' && red) return 'fail'
      if (lane === '3e' && run && !green) return 'now'
      if (lane === current) return 'now'
      return reached.has(lane) ? 'done' : 'todo'
    })
    const ci = !run ? '' : green ? 'CI ✔' : red ? `CI ✖ ${run.conclusion}` : `CI … ${run.status}`
    return { pr: n, key: p.key ?? '', cells, ci, reviewed: p.reviewed?.slice(0, 7) ?? '' }
  })
}

/** One timeline row per drain pass: build and merge time as bar segments, and what the pass moved. */
export function passRows(board: Board, now: number, width = 30): { pass: number; build: number; merge: number; text: string }[] {
  const passes = board.passes ?? []
  if (!passes.length) return []
  const span = (p: Pass) => (p.end ?? now) - p.start
  const longest = Math.max(1, ...passes.map(span))
  return passes.map((p, i) => {
    const end = p.end ?? now
    const buildMs = (p.merge ?? end) - p.start
    const mergeMs = p.merge ? end - p.merge : 0
    const build = Math.round((buildMs / longest) * width)
    const merge = Math.round((mergeMs / longest) * width)
    const moved = p.built || p.merged ? `build ${p.built} → merge ${p.merged}` : p.end ? 'nothing moved' : 'running'
    const mins = Math.max(1, Math.round((end - p.start) / 60_000))
    return { pass: i + 1, build, merge, text: `${moved} · ${mins} min` }
  })
}
