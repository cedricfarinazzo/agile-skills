// Pure board state: every function takes a state and returns a new one, so tests need no engine.

export type Loop = 'implement' | 'merge-train' | 'drain'
export type Stage = 'build' | 'merge'
export type Outcome = 'running' | 'STUCK' | 'DRAINED'

export type Ticket = {
  key: string
  phase?: string
  pr?: number
}

export type Pr = {
  number: number
  key?: string
  step?: string
  merged?: boolean
}

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
}

export const EMPTY: Board = { tickets: {}, order: [], prs: {}, prOrder: [] }

const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/
const PHASE = /agile:phase=([a-z_]+)/g
const PR_URL = /\/pull\/(\d+)/
export const PR_REF = /(?:\/pull\/|#|\bPR\s*#?)(\d+)/i
const JIRA_SITE = /(https:\/\/[^\s"'<>()/]+)\/browse\/[A-Z][A-Z0-9]+-\d+/
const GITHUB_REPO = /(https:\/\/github\.com\/[^\s"'<>()/]+\/[^\s"'<>()/]+)\/pull\/\d+/
const OUTCOME = /══\s*(DRAINED|STUCK)\s*══/

// the merge train's per-PR steps, by agent (dispatch) or sub-skill (inline, concurrency=0)
const STEPS: [RegExp, string][] = [
  [/(^|:)(pr-updater|merge-update-pr)$/, '3a update'],
  [/(^|:)(pr-reviewer|merge-review-pr)$/, '3b review'],
  [/(^|:)(merge-)?fix-until-satisfied$/, '3c fix'],
  [/(^|:)(merge-)?jira-postmortem$/, '4 postmortem'],
]

export const stepOf = (name: string) => STEPS.find(([re]) => re.test(name))?.[1]
const str = (value: unknown) => (typeof value === 'string' ? value : '')

/** Accepts a stored board, filling fields an older version did not keep. */
export function loadBoard(value: unknown): Board | undefined {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as Board).order)) return undefined
  return { ...EMPTY, ...(value as Partial<Board>) }
}

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

const onOrchestrator = (board: Board, skill: string): Board => {
  const draining = board.drain?.outcome === 'running'
  if (skill.endsWith('agile-sprint-drain')) return { ...board, loop: 'drain', stage: undefined, drain: { pass: 0, outcome: 'running' } }
  if (skill.endsWith('agile-10-implement')) {
    const drain = draining ? { ...board.drain!, pass: board.drain!.pass + 1 } : board.drain
    return { ...board, loop: draining ? 'drain' : 'implement', stage: 'build', drain }
  }
  if (skill.endsWith('agile-11-merge-train')) return { ...board, loop: draining ? 'drain' : 'merge-train', stage: 'merge' }
  return board
}

/**
 * Folds the start of a tool call: what is about to run shows while it runs
 * (an orchestrator, a merge-train step, a merge command).
 */
export function observeStart(board: Board, tool: string, args: Record<string, unknown>): Board {
  if (tool === 'Skill' || tool === 'Agent') {
    const name = tool === 'Skill' ? str(args.skill) : str(args.subagent_type)
    const next = tool === 'Skill' ? onOrchestrator(board, name) : board
    const step = stepOf(name)
    const pr = Number((str(args.args) + ' ' + str(args.prompt) + ' ' + str(args.description)).match(PR_REF)?.[1])
    return step && pr ? withPr(next, pr, { step }) : next
  }
  const merge = tool === 'Bash' ? str(args.command).match(/\bgh pr merge\s+(\d+)/) : null
  if (merge) return withPr(board, Number(merge[1]), { step: '3f merge' })
  return board
}

type Listed = { number?: unknown; title?: unknown; headRefName?: unknown; mergedAt?: unknown }

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const listed = (board: Board, text: string, merged: boolean): Board => {
  const rows = parseJson(text)
  if (!Array.isArray(rows)) return board
  return (rows as Listed[]).reduce((b, row) => {
    if (typeof row.number !== 'number') return b
    // a merged listing only closes PRs already on the board; it does not add history
    if (merged) return b.prs[row.number] ? withPr(b, row.number, { merged: true, step: 'merged' }) : b
    const key = (str(row.headRefName) + ' ' + str(row.title)).match(TICKET_KEY)?.[0]
    return withPr(b, row.number, key ? { key } : {})
  }, board)
}

/**
 * Folds one finished tool call into the board.
 *
 * @param args the call's input as `tool.call` carries it (the tool's arguments beside `tool`)
 * @param text what the model read back; undefined on a deny or an error
 */
export function observeTool(prior: Board, tool: string, args: Record<string, unknown>, text: string | undefined): Board {
  if (text === undefined) return prior
  const site = tool.startsWith('mcp__atlassian__') && !prior.site ? text.match(JIRA_SITE)?.[1] : undefined
  const repo = !prior.repo ? text.match(GITHUB_REPO)?.[1] : undefined
  const board = site || repo ? { ...prior, ...(site && { site }), ...(repo && { repo }) } : prior

  if (tool === 'mcp__atlassian__addCommentToJiraIssue') {
    const key = str(args.issueIdOrKey)
    const phase = [...str(args.commentBody).matchAll(PHASE)].map(m => m[1]!).at(-1)
    return TICKET_KEY.test(key) && phase ? withTicket(board, key, { phase }) : board
  }

  if (tool === 'mcp__github__create_pull_request') {
    const key = (str(args.head) + ' ' + str(args.title)).match(TICKET_KEY)?.[0]
    const pr = Number(text.match(PR_URL)?.[1])
    return pr ? withPr(board, pr, key ? { key } : {}) : board
  }

  // the MCP merge answers from the API, so a non-error result is the merge
  if (tool === 'mcp__github__merge_pull_request') {
    return typeof args.pullNumber === 'number' ? withPr(board, args.pullNumber, { merged: true, step: 'merged' }) : board
  }

  if (tool === 'Bash') {
    const command = str(args.command)
    if (/\bgh pr create\b/.test(command)) {
      const key = command.match(TICKET_KEY)?.[0]
      const pr = Number(text.match(PR_URL)?.[1])
      return pr ? withPr(board, pr, key ? { key } : {}) : board
    }
    if (/\bgh pr list\b/.test(command) && /--json\b/.test(command)) {
      const state = command.match(/--state\s+(\w+)/)?.[1] ?? 'open'
      return state === 'open' || state === 'merged' ? listed(board, text, state === 'merged') : board
    }
    // gh pr merge's exit code is not the signal: only a view showing mergedAt is
    const view = command.match(/\bgh pr view\s+(\d+)\b/)
    if (view && /mergedAt/.test(command)) {
      const row = parseJson(text) as Listed | undefined
      return typeof row?.mergedAt === 'string' && row.mergedAt ? withPr(board, Number(view[1]), { merged: true, step: 'merged' }) : board
    }
  }

  return board
}

/** Folds a finished turn's answer: the drain's closing banner sets its outcome. */
export function observeAnswer(board: Board, text: string): Board {
  const outcome = text.match(OUTCOME)?.[1] as Outcome | undefined
  if (!outcome || !board.drain) return board
  return { ...board, drain: { ...board.drain, outcome } }
}

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
    return `${key.padEnd(10)} ${(t.phase ?? '—').padEnd(13)}${t.pr ? ` PR #${t.pr}` : ''}`
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
  return sorted.slice(0, Math.max(0, rows)).map(p =>
    `#${String(p.number).padEnd(6)} ${(p.key ?? '').padEnd(10)} ${p.merged ? 'merged' : (p.step ?? 'queued')}`)
}
