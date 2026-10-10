// Pure flow metrics over the board: spend rate, prompt-cache hit rate by stage, aging work in
// progress, the "done by" forecast and the PR overlap map. Each reads what gh, Jira or the engine
// reported (merge times, ticket status dates, PR files, the cost ledger, request usage), never the
// model's answers.

import type { Board, Pass, Stage, Tokens } from './board.ts'

const HOUR = 3_600_000
const DAY = 86_400_000

/** A request's usage, in the API's spelling, as `turn.step` reports it. */
export type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

export const addTokens = (t: Tokens | undefined, u: Usage): Tokens => ({
  input: (t?.input ?? 0) + u.input_tokens,
  read: (t?.read ?? 0) + u.cache_read_input_tokens,
  write: (t?.write ?? 0) + u.cache_creation_input_tokens,
  output: (t?.output ?? 0) + u.output_tokens,
})

const promptOf = (t: Tokens) => t.input + t.read + t.write

/** The share of prompt tokens the cache served; undefined before any request. */
export const hitRate = (t: Tokens | undefined): number | undefined => (t && promptOf(t) ? t.read / promptOf(t) : undefined)

/** Adds one model request to its stage, for the loop and for the drain pass running now. */
export function withTokens(board: Board, stage: Stage, u: Usage): Board {
  const tokens = { ...board.tokens, [stage]: addTokens(board.tokens?.[stage], u) }
  const pass = board.drain?.outcome === 'running' ? board.passes?.at(-1) : undefined
  if (!pass) return { ...board, tokens }
  const next: Pass = { ...pass, tokens: { ...pass.tokens, [stage]: addTokens(pass.tokens?.[stage], u) } }
  return { ...board, tokens, passes: [...board.passes!.slice(0, -1), next] }
}

/** Below this many prompt tokens a stage's hit rate is noise. */
const CACHE_MIN = 200_000
/** A drop of this much under the stage's usual rate is flagged. */
const CACHE_DROP = 0.15

/** A stage whose hit rate in the running pass fell well under its rate in earlier passes. */
export function cacheFlags(board: Board): string[] {
  const passes = board.passes ?? []
  const now = board.drain?.outcome === 'running' ? passes.at(-1) : undefined
  if (!now) return []
  return (['build', 'merge'] as const).flatMap(stage => {
    const t = now.tokens?.[stage]
    if (!t || promptOf(t) < CACHE_MIN) return []
    const earlier = passes.slice(0, -1).map(p => p.tokens?.[stage]).filter((x): x is Tokens => !!x && promptOf(x) >= CACHE_MIN)
    if (!earlier.length) return []
    const usual = earlier.reduce((s, x) => s + hitRate(x)!, 0) / earlier.length
    const rate = hitRate(t)!
    return rate < usual - CACHE_DROP ? [`${stage} cache ${pct(rate)} (usual ${pct(usual)})`] : []
  })
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

/** Counts the ledger up to `usd` while a loop runs; a lower reading is a new session, counted from 0. */
export function withSpend(board: Board, usd: number): Board {
  if (!board.loop) return board
  const spend = board.spend ?? { usd: 0 }
  if (spend.last === undefined) return { ...board, spend: { usd: spend.usd, last: usd } }
  const delta = usd >= spend.last ? usd - spend.last : usd
  return delta === 0 && usd === spend.last ? board : { ...board, spend: { usd: spend.usd + delta, last: usd } }
}

/** After a reload the ledger restarts with the session: the next reading is a new baseline. */
export const withoutLedger = (board: Board): Board => (board.spend?.last === undefined ? board : { ...board, spend: { usd: board.spend.usd } })

/** What the loop spent, per hour since it started and per PR merged since. */
export function rateOf(board: Board, now: number): { spent: number; perHour?: number; perPr?: number; merged: number } {
  const spent = board.spend?.usd ?? 0
  const since = board.since
  const merged = since === undefined ? 0 : board.prOrder.filter(n => (board.prs[n]!.mergedAt ?? -1) >= since).length
  const hours = since === undefined ? 0 : (now - since) / HOUR
  return { spent, merged, ...(hours >= 0.1 && spent > 0 && { perHour: spent / hours }), ...(merged && spent > 0 && { perPr: spent / merged }) }
}

/** The value at fraction `p` of the sorted samples (nearest rank). */
export function percentile(xs: number[], p: number): number | undefined {
  if (!xs.length) return undefined
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]
}

/** A length of time in one unit: minutes, hours, or days. */
export function span(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.round(ms / HOUR)
  return h < 48 ? `${h}h` : `${Math.round(ms / DAY)}d`
}

export type AgingItem = { id: string; kind: 'pr' | 'ticket'; where: string; age: number }

/** Below this many merged PRs the percentile lines are not drawn. */
export const MIN_CYCLES = 5

/**
 * Work in progress by age: each open PR on the board since gh says it opened, each in-progress
 * ticket without an open PR since Jira says it entered that category. The lines are the 50th and
 * 85th percentile of how long the repo's merged PRs stayed open.
 */
export function agingOf(board: Board, now: number): { items: AgingItem[]; p50?: number; p85?: number } {
  const open = board.prOrder.map(n => board.prs[n]!).filter(p => p.state === 'OPEN' && p.createdAt !== undefined)
  const withPr = new Set(open.map(p => p.key).filter(Boolean))
  const prs: AgingItem[] = open.map(p => ({ id: `#${p.number}${p.key ? ` ${p.key}` : ''}`, kind: 'pr', where: p.step ?? 'open', age: now - p.createdAt! }))
  const tickets: AgingItem[] = board.order
    .map(k => board.tickets[k]!)
    .filter(t => t.category === 'indeterminate' && t.since !== undefined && !t.parked && !withPr.has(t.key))
    .map(t => ({ id: t.key, kind: 'ticket', where: t.phase ?? t.status ?? 'in progress', age: now - t.since! }))
  const cycles = board.history?.cycles ?? []
  const lines = cycles.length >= MIN_CYCLES ? { p50: percentile(cycles, 0.5), p85: percentile(cycles, 0.85) } : {}
  return { items: [...prs, ...tickets].sort((a, b) => b.age - a.age), ...lines }
}

/** Open PRs older than the repo's 85th percentile: the alert row's aging items. */
export function agingFlags(board: Board, now: number): string[] {
  const { items, p85 } = agingOf(board, now)
  return p85 === undefined ? [] : items.filter(i => i.kind === 'pr' && i.age > p85).map(i => `PR ${i.id.split(' ')[0]} open ${span(i.age)} (p85 ${span(p85)})`)
}

/** Below this many days of merge history the forecast is not made. */
export const MIN_DAYS = 10
const WINDOW_DAYS = 30
const TRIALS = 1000
const HORIZON = 365

/** A small seeded generator, so one board always gives one forecast. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Forecast = { left: number; days?: { p50: number; p85: number }; hist?: number[]; samples: number; reason?: string }

/** Tickets the board still expects to merge: not done, not merged, not parked. */
const ticketsLeft = (board: Board) =>
  board.order.filter(k => {
    const t = board.tickets[k]!
    return !t.parked && t.category !== 'done' && !(t.pr && board.prs[t.pr]?.merged)
  }).length

/**
 * Monte Carlo: each trial draws a day at random from the repo's last 30 days of merges (as gh lists
 * them) until the tickets left are merged; the answer is how many days 50% and 85% of trials took.
 */
export function forecastOf(board: Board, now: number): Forecast {
  const left = ticketsLeft(board)
  const merges = (board.history?.merges ?? []).filter(t => t <= now && t > now - WINDOW_DAYS * DAY)
  const first = merges.length ? Math.min(...merges) : now
  const samples = merges.length ? Math.floor((now - first) / DAY) + 1 : 0
  if (!left) return { left, samples, reason: 'nothing left' }
  if (samples < MIN_DAYS) return { left, samples, reason: `${samples} day(s) of merges, needs ${MIN_DAYS}` }
  const perDay = Array.from({ length: samples }, (_, d) => merges.filter(t => Math.floor((now - t) / DAY) === d).length)
  const draw = rng(left * 7919 + samples * 31 + merges.length)
  const results: number[] = []
  for (let i = 0; i < TRIALS; i++) {
    let days = 0
    let done = 0
    while (done < left && days < HORIZON) {
      done += perDay[Math.floor(draw() * perDay.length)]!
      days++
    }
    results.push(days)
  }
  const p50 = percentile(results, 0.5)!
  const p85 = percentile(results, 0.85)!
  if (p85 >= HORIZON) return { left, samples, reason: 'too few merges to forecast' }
  const hist = Array.from({ length: Math.max(...results) + 1 }, (_, d) => results.filter(r => r === d).length)
  return { left, samples, days: { p50, p85 }, hist }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The day `days` from now: a weekday within the week, else month and day. */
export function dayName(now: number, days: number): string {
  if (days <= 0) return 'today'
  const d = new Date(now + days * DAY)
  return days < 7 ? WEEKDAYS[d.getDay()]! : `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** Open PRs whose files are unknown at their current head, oldest first: what the next refresh reads. */
export const filesTargets = (board: Board, n: number): { pr: number; head: string }[] =>
  board.prOrder
    .map(k => board.prs[k]!)
    .filter(p => p.state === 'OPEN' && p.head && p.head !== p.filesHead)
    .slice(0, n)
    .map(p => ({ pr: p.number, head: p.head! }))

export const withFiles = (board: Board, pr: number, head: string, files: string[]): Board =>
  board.prs[pr] ? { ...board, prs: { ...board.prs, [pr]: { ...board.prs[pr]!, files, filesHead: head } } } : board

const topOf = (path: string) => (path.includes('/') ? `${path.split('/')[0]}/` : '(root)')

/**
 * Open PRs that touch the same files, and the top directories more than one open PR touches. Two
 * PRs on the same file merge one after the other, and the second will likely need a rebase.
 */
export function overlapOf(board: Board): { pairs: { a: number; b: number; files: string[] }[]; dirs: { dir: string; prs: number[] }[] } {
  const open = board.prOrder.map(n => board.prs[n]!).filter(p => p.state === 'OPEN' && p.files && p.filesHead === p.head)
  const pairs = open.flatMap((a, i) =>
    open.slice(i + 1).flatMap(b => {
      const shared = a.files!.filter(f => b.files!.includes(f))
      return shared.length ? [{ a: a.number, b: b.number, files: shared }] : []
    }))
  const byDir = new Map<string, Set<number>>()
  for (const p of open) for (const f of p.files!) byDir.set(topOf(f), (byDir.get(topOf(f)) ?? new Set()).add(p.number))
  const dirs = [...byDir].filter(([, s]) => s.size > 1).map(([dir, s]) => ({ dir, prs: [...s].sort((x, y) => x - y) })).sort((x, y) => y.prs.length - x.prs.length)
  return { pairs, dirs }
}
