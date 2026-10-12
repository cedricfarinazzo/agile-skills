// Pure: what each ticket cost the run. A request's tokens come from `turn.step` per subagent, so
// its dollars are tokens times a price per million tokens of the model it reports (else its agent
// file's); a ticket's cost is the sum over the agents that worked it. The main session's own requests are not
// counted here: the run's overhead is the ledger's spend minus what the tickets add up to.

import { PR_REF, TICKET_KEY, type Board, type Stage, type Ticket } from './board.ts'
import type { Usage } from './flow.ts'

export type Model = 'opus' | 'sonnet' | 'haiku'

/** USD per million input and output tokens. The same table as session-audit's `DEFAULT_PRICES`. */
export const PRICES: Record<Model, [number, number]> = { opus: [5, 25], sonnet: [3, 15], haiku: [1, 5] }
/** Cache reads and writes as a multiple of the input price. */
export const CACHE_READ = 0.1
export const CACHE_WRITE = 1.25

/** The `model:` each loop agent's file declares (`<plugin>/agents/<name>.md`). */
export const AGENT_MODEL: Record<string, Model> = {
  'build-implementer': 'opus',
  'build-monitor': 'sonnet',
  'build-session': 'opus',
  'fix-until-satisfied': 'sonnet',
  'jira-postmortem': 'sonnet',
  'merge-session': 'sonnet',
  'pr-publisher': 'sonnet',
  'pr-reviewer': 'opus',
  'pr-updater': 'sonnet',
  'review-lens': 'sonnet',
  'self-reviewer': 'sonnet',
  'ticket-planner': 'opus',
  'ticket-validator': 'sonnet',
}

/** The model of a loop agent type (`agile-execution:build-implementer`); undefined for any other agent. */
export const modelOf = (type: string): Model | undefined => AGENT_MODEL[type.split(':').at(-1)!]

/** The price tier of a model id a request reports (`claude-opus-5-5`); undefined for an id it does not recognise. */
export const modelOfId = (id: string | undefined): Model | undefined => (/opus/i.test(id ?? '') ? 'opus' : /sonnet/i.test(id ?? '') ? 'sonnet' : /haiku/i.test(id ?? '') ? 'haiku' : undefined)

/** One model request in USD. */
export function usdOf(u: Usage, model: Model): number {
  const [input, output] = PRICES[model]
  return (u.input_tokens * input + u.cache_read_input_tokens * input * CACHE_READ + u.cache_creation_input_tokens * input * CACHE_WRITE + u.output_tokens * output) / 1e6
}

export type Cost = {
  usd: number
  /** The share of `usd` spent by build agents, and by merge agents. */
  build: number
  merge: number
  /** Milliseconds its agents were working: the gaps between their requests, a wait over `GAP` not counted. */
  ms: number
  /** When its first request was made. */
  firstAt: number
}

/** A wait longer than this between one agent's requests (a CI watch, a human) is not working time. */
export const GAP = 5 * 60_000

/** Adds one request's dollars, and the working time since the agent's last request, to a ticket. */
export function withCost(board: Board, key: string, usd: number, stage: Stage | undefined, ms: number, now: number): Board {
  const t = board.tickets[key]
  if (!t) return board
  const c: Cost = t.cost ?? { usd: 0, build: 0, merge: 0, ms: 0, firstAt: now }
  const cost: Cost = { ...c, usd: c.usd + usd, build: c.build + (stage === 'build' ? usd : 0), merge: c.merge + (stage === 'merge' ? usd : 0), ms: c.ms + Math.min(Math.max(0, ms), GAP) }
  return { ...board, tickets: { ...board.tickets, [key]: { ...t, cost } } }
}

/**
 * Moves a request already counted from one ticket to another: the call that named the new ticket was
 * made by it. Never more than the first holds, and nothing when it holds no cost (a new run cleared it).
 */
export function movedCost(board: Board, from: string, to: string, usd: number, stage: Stage | undefined, now: number): Board {
  const held = board.tickets[from]?.cost?.usd
  if (from === to || held === undefined || !board.tickets[to]) return board
  const amount = Math.max(0, Math.min(usd, held))
  return withCost(withCost(board, from, -amount, stage, 0, now), to, amount, stage, 0, now)
}

/** A new run: every ticket's cost starts again with the spend ledger. */
export function withoutCosts(board: Board): Board {
  if (!Object.values(board.tickets).some(t => t.cost) && board.unattributed === undefined) return board
  const tickets: Board['tickets'] = {}
  for (const [k, t] of Object.entries(board.tickets)) {
    const { cost: _, ...rest } = t
    tickets[k] = rest
  }
  const { unattributed: _u, ...rest } = board
  return { ...rest, tickets }
}

/** The tickets on the board that a text names, in order: keys it carries, or the PR it names. */
export function ticketsOfText(board: Board, text: string): string[] {
  const keys = [...new Set([...text.matchAll(new RegExp(TICKET_KEY.source, 'g'))].map(m => m[0]).filter(k => board.tickets[k]))]
  if (keys.length) return keys
  const pr = text.match(PR_REF)?.[1]
  const key = pr ? board.prs[pr]?.key : undefined
  return key ? [key] : []
}

/** The one ticket on the board that a text names, when it names exactly one. */
export function ticketOfText(board: Board, text: string): string | undefined {
  const keys = ticketsOfText(board, text)
  return keys.length === 1 ? keys[0] : undefined
}

const JIRA_WRITE = /^mcp__.+__(editJiraIssue|addCommentToJiraIssue|transitionJiraIssue)$/
/** A command that starts with git or gh doing branch or PR work (after any `VAR=x` words). */
const BRANCH_WORK = /^\s*(?:\w+=\S*\s+)*(?:git\s+(?:-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+)?(?:push|checkout|switch|branch|worktree\s+add)\b|gh\s+pr\s+(?:create|edit|merge|ready|checkout)\b)/

/**
 * The commands a shell line runs: split on `&&`, `||`, `;`, `|` and newlines that are outside quotes,
 * with an unquoted `#` comment dropped. A word in a quoted string (`echo "git push VC-4"`) or a
 * comment is no command, so it is no evidence of work.
 */
export function commandsOf(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote = ''
  const flush = () => {
    if (cur.trim()) out.push(cur.trim())
    cur = ''
  }
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (quote) {
      cur += c
      // a double quote has backslash escapes; a single quote has none
      if (quote === '"' && c === '\\' && i + 1 < line.length) cur += line[++i]
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
    } else if (c === '\\' && i + 1 < line.length) {
      cur += c + line[++i]
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]!))) {
      while (i + 1 < line.length && line[i + 1] !== '\n') i++
    } else if (c === ';' || c === '|' || c === '\n') {
      flush()
      while (line[i + 1] === c) i++
    } else if (c === '&') {
      // `2>&1`, `>&2` and `&>file` are redirections, not a separator
      const redirect = line[i - 1] === '>' || line[i - 1] === '<' || line[i + 1] === '>'
      if (redirect) cur += c
      else {
        flush()
        while (line[i + 1] === '&') i++
      }
    } else cur += c
  }
  flush()
  return out
}

/**
 * The one ticket a call that changes something names: a write to its Jira issue, a push, checkout or
 * branch of its branch, or a `gh pr` create, edit or merge of its PR. A read names a ticket without
 * working on it, so it shows nothing. What an agent was dispatched for is only a claim; this is what it
 * is shown to work.
 */
export function strongTicket(board: Board, tool: string, args: Record<string, unknown>): string | undefined {
  if (JIRA_WRITE.test(tool)) {
    const key = typeof args.issueIdOrKey === 'string' ? args.issueIdOrKey : ''
    return board.tickets[key] ? key : undefined
  }
  if (/^mcp__.+__create_pull_request$/.test(tool)) return ticketOfText(board, typeof args.head === 'string' ? args.head : '')
  if (tool !== 'Bash' || typeof args.command !== 'string') return undefined
  // each command of the line that is itself branch or PR work, and the one ticket they all name
  const tickets = new Set<string>()
  for (const cmd of commandsOf(args.command).filter(c => BRANCH_WORK.test(c))) {
    const pr = cmd.match(/\bgh\s+pr\s+(?:merge|edit|ready|checkout)\s+(?:-\S+\s+)*#?(\d+)/)?.[1]
    const key = ticketOfText(board, cmd) ?? (pr ? board.prs[pr]?.key : undefined)
    if (key) tickets.add(key)
  }
  return tickets.size === 1 ? [...tickets][0] : undefined
}

export type Row = { key: string; cost: Cost; lines?: number; elapsed?: number; merged: boolean }

/** One row per ticket with a cost, dearest first. Lines are a merged PR's additions + deletions. */
export function rowsOf(board: Board, now: number): Row[] {
  return board.order
    .map(k => board.tickets[k]!)
    .filter((t): t is Ticket & { cost: Cost } => !!t.cost)
    .map(t => {
      const pr = t.pr ? board.prs[t.pr] : undefined
      const merged = !!pr?.merged || t.category === 'done'
      const start = t.since ?? t.cost.firstAt
      const end = pr?.merged && pr.mergedAt !== undefined ? pr.mergedAt : now
      const lines = pr?.additions !== undefined && pr.deletions !== undefined ? pr.additions + pr.deletions : undefined
      return { key: t.key, cost: t.cost, ...(lines !== undefined && { lines }), elapsed: Math.max(0, end - start), merged }
    })
    .sort((a, b) => b.cost.usd - a.cost.usd)
}

export const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export type Summary = {
  /** Every ticket's cost, and the ledger's spend beyond them: the orchestrator, `overhead`. */
  tickets: number
  /** What subagents that named no ticket cost: counted, but on no ticket and under no cap. */
  unattributed: number
  overhead: number
  /** The merged tickets' median cost, their cost per changed line, and what they cost in all. */
  median?: number
  perLine?: number
  merged: number
  mergedUsd: number
  /** The price table is too low when the tickets add up to more than the ledger spent. */
  drift: boolean
}

/** The totals of the Cost tab; `spent` is the run's ledger spend. */
export function summaryOf(rows: Row[], spent: number, unattributed = 0): Summary {
  const tickets = rows.reduce((n, r) => n + r.cost.usd, 0)
  const merged = rows.filter(r => r.merged)
  const lined = merged.filter(r => r.lines)
  const lines = lined.reduce((n, r) => n + r.lines!, 0)
  return {
    tickets,
    overhead: Math.max(0, spent - tickets - unattributed),
    unattributed,
    ...(merged.length && { median: median(merged.map(r => r.cost.usd)) }),
    ...(lines && { perLine: lined.reduce((n, r) => n + r.cost.usd, 0) / lines }),
    merged: merged.length,
    mergedUsd: merged.reduce((n, r) => n + r.cost.usd, 0),
    drift: spent > 1 && tickets + unattributed > spent * 1.1,
  }
}
