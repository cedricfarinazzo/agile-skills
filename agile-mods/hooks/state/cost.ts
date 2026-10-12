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

/** One agent running every phase of several tickets in turn: its ticket is whichever its calls last named. */
export const isSession = (type: string) => /(^|:)(build|merge)-session$/.test(type)

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
  if (!Object.values(board.tickets).some(t => t.cost)) return board
  const tickets: Board['tickets'] = {}
  for (const [k, t] of Object.entries(board.tickets)) {
    const { cost: _, ...rest } = t
    tickets[k] = rest
  }
  return { ...board, tickets }
}

/** The one ticket on the board that a loop agent's description names, when it names exactly one. */
export function ticketOfText(board: Board, text: string): string | undefined {
  const keys = new Set([...text.matchAll(new RegExp(TICKET_KEY.source, 'g'))].map(m => m[0]).filter(k => board.tickets[k]))
  if (keys.size === 1) return [...keys][0]
  if (keys.size > 1) return undefined
  const pr = text.match(PR_REF)?.[1]
  return pr ? board.prs[pr]?.key : undefined
}

/** The one ticket a tool call names (a key in its arguments, or the PR a `gh pr` command names). */
export function ticketOfCall(board: Board, tool: string, args: Record<string, unknown>): string | undefined {
  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  const text = JSON.stringify(args)
  const keys = new Set([...text.matchAll(new RegExp(TICKET_KEY.source, 'g'))].map(m => m[0]).filter(k => board.tickets[k]))
  if (keys.size === 1) return [...keys][0]
  if (keys.size > 1 || !/^\s*(cd\s+\S+\s*&&\s*)?gh\s+pr\b/.test(command)) return undefined
  const n = command.match(/\bgh\s+pr\s+\w+\s+(?:-\S+\s+)*#?(\d+)/)?.[1]
  return n ? board.prs[n]?.key : undefined
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
export function summaryOf(rows: Row[], spent: number): Summary {
  const tickets = rows.reduce((n, r) => n + r.cost.usd, 0)
  const merged = rows.filter(r => r.merged)
  const lined = merged.filter(r => r.lines)
  const lines = lined.reduce((n, r) => n + r.lines!, 0)
  return {
    tickets,
    overhead: Math.max(0, spent - tickets),
    ...(merged.length && { median: median(merged.map(r => r.cost.usd)) }),
    ...(lines && { perLine: lined.reduce((n, r) => n + r.cost.usd, 0) / lines }),
    merged: merged.length,
    mergedUsd: merged.reduce((n, r) => n + r.cost.usd, 0),
    drift: spent > 1 && tickets > spent * 1.1,
  }
}
