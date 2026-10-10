// Pure views behind the agile console pane, the alert band and the status line: every function takes
// the board (and a little context) and returns rows of styled text, so tests need no engine and
// register.tsx only maps rows onto elements.

import type { Lane } from './agents.ts'
import { laneRows, leftOf, linksOf, movesOf, parkedOf, passCost, stallsOf, type Board, type Cell, type Pass, type Sync } from './board.ts'
import { MIN_CYCLES, agingFlags, agingOf, cacheFlags, dayName, forecastOf, hitRate, overlapOf, pct, rateOf, span, type Forecast } from './flow.ts'
import type { Refusal } from './guards.ts'
import type { Receipt } from './receipts.ts'

export type Tab = 'board' | 'flow' | 'wip' | 'drain' | 'guards' | 'links'

export const TABS: { id: Tab; label: string; hotkey: string }[] = [
  { id: 'board', label: 'Board', hotkey: '1' },
  { id: 'flow', label: 'Flow', hotkey: '2' },
  { id: 'wip', label: 'WIP', hotkey: '3' },
  { id: 'drain', label: 'Drain', hotkey: '4' },
  { id: 'guards', label: 'Guards', hotkey: '5' },
  { id: 'links', label: 'Links', hotkey: '6' },
]

export const tabOf = (name: string): Tab | undefined => TABS.find(t => t.id === name)?.id

/**
 * A piece of text and its style tags, space separated: `d` dim, `b` bold, `u` underline, a colour
 * (`c` cyan, `m` magenta, `g` green, `y` yellow, `r` red, `bl` blue) or a badge (`bgr`, `bgg`).
 */
export type Seg = { t: string; c?: string }

export type Tile = { label: string; value: string; sub: string; tone: string }

/**
 * The burnup as pixel columns, `rows * 2` pixels high: in column `c`, `done[c]` pixels from the
 * bottom are work done, and the pixels up to `scope[c]` are work left.
 */
export type Chart = { cols: number; rows: number; done: number[]; scope: number[]; tone: string }

export type Row =
  | { kind: 'line'; segs: Seg[] }
  | { kind: 'tiles'; tiles: Tile[] }
  | { kind: 'chart'; chart: Chart }
  | { kind: 'link'; label: string; href: string }

export type Ctx = {
  now: number
  /** The session's cost so far in USD, when the host reports one. */
  usd?: number
  refusals: Refusal[]
  allowed: number
  receipts: Receipt[]
  /** The loop's agents as the engine lists them, for the Drain tab. */
  lanes?: Lane[]
  /** The `budgetUsd` option; 0 or absent is no budget. */
  budget?: number
}

const rep = (ch: string, n: number) => ch.repeat(Math.max(0, Math.round(n)))
const seg = (t: string, c?: string): Seg => ({ t, ...(c && { c }) })
const text = (...parts: (string | [string, string])[]): Seg[] => parts.map(p => (typeof p === 'string' ? seg(p) : seg(p[0], p[1])))
const line = (...parts: (string | [string, string])[]): Row => ({ kind: 'line', segs: text(...parts) })
const blank: Row = { kind: 'line', segs: [seg(' ')] }
const width = (segs: Seg[]) => segs.reduce((n, s) => n + s.t.length, 0)

/** One row with `left` at the start and `right` at the end of `w` columns. */
function spread(left: Seg[], right: Seg[], w: number): Row {
  const gap = Math.max(1, w - width(left) - width(right))
  return { kind: 'line', segs: [...left, seg(rep(' ', gap)), ...right] }
}

export function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`
}

const usd = (n: number) => `$${n.toFixed(2)}`
const unitName = (u: 'points' | 'tickets') => (u === 'points' ? 'pts' : 'tickets')

/** A bar `w` columns wide, filled to `frac` in eighths of a column. */
export function barSegs(frac: number, w: number, tone: string): Seg[] {
  const eighths = Math.round(Math.max(0, Math.min(1, frac)) * w * 8)
  const full = Math.floor(eighths / 8)
  const rest = eighths % 8
  return [seg(rep('█', full), tone), ...(rest ? [seg(' ▏▎▍▌▋▊▉'[rest]!, tone)] : []), seg(rep('░', w - full - (rest ? 1 : 0)), 'd')]
}

const mergedPrs = (board: Board) => board.prOrder.filter(n => board.prs[n]?.merged).length

/** The budget, once the loop's spend reached it. */
const budgetFlag = (board: Board, budget = 0) => (budget > 0 && (board.spend?.usd ?? 0) >= budget ? [`budget spent ${usd(board.spend!.usd)} of ${usd(budget)}`] : [])

/** Everything that wants a person: parked and looping work, aging PRs, a cache drop, a spent budget. */
const attention = (board: Board, now: number, budget?: number) => [...parkedOf(board), ...stallsOf(board), ...budgetFlag(board, budget), ...agingFlags(board, now), ...cacheFlags(board)]

let memo: { key: string; value: Forecast } | undefined

/** The forecast, made again only when its inputs or the hour change. */
function forecast(board: Board, now: number): Forecast {
  const key = `${board.order.length}:${board.prOrder.length}:${leftOf(board).left}:${board.history?.merges.length}:${Math.floor(now / 3_600_000)}`
  if (memo?.key !== key) memo = { key, value: forecastOf(board, now) }
  return memo.value
}

/** Time since the loop began: the first pass for a drain, to its last end once it finished. */
function elapsed(board: Board, now: number): number | undefined {
  const passes = board.passes ?? []
  if (!passes.length) return undefined
  const finished = board.drain && board.drain.outcome !== 'running'
  return (finished ? (passes.at(-1)!.end ?? now) : now) - passes[0]!.start
}

function headerRow(board: Board, ctx: Ctx, w: number): Row {
  const time = elapsed(board, ctx.now)
  const right = time === undefined ? [] : text([fmtDur(time), 'd'])
  const needs = attention(board, ctx.now, ctx.budget).length
  if (board.drain?.outcome === 'STUCK') return spread(text([' STUCK ', 'bgr b'], [` ${needs} item${needs === 1 ? '' : 's'} need a human`, 'r']), right, w)
  if (board.drain?.outcome === 'DRAINED') return spread(text([' DRAINED ', 'bgg b'], [' nothing left to build or merge', 'g']), right, w)
  if (board.drain) return spread(text(['● ', 'g b'], ['DRAIN', 'b'], [` pass ${board.drain.pass}${board.stage ? ` · ${board.stage}` : ''}`, 'd']), right, w)
  if (board.loop) return spread(text(['● ', 'g b'], [board.loop.toUpperCase(), 'b'], [board.stage ? ` · ${board.stage}` : '', 'd']), right, w)
  return line(['idle', 'd'], [' · the loop has not run in this session', 'd'])
}

/** The burnup from the board's samples: work done and total scope over the span they cover. */
function chartOf(board: Board, ctx: Ctx, cols: number): { chart: Chart; max: number; span: number } | undefined {
  const samples = board.burn ?? []
  if (samples.length < 2) return undefined
  const rows = 5
  const pixels = rows * 2
  const max = Math.max(...samples.map(s => s.total))
  const t0 = samples[0]!.at
  const running = !board.drain || board.drain.outcome === 'running'
  const t1 = Math.max(samples.at(-1)!.at, running ? ctx.now : 0, t0 + 1)
  const at = (c: number) => {
    const t = t0 + ((c + 0.5) / cols) * (t1 - t0)
    return [...samples].reverse().find(s => s.at <= t) ?? samples[0]!
  }
  const px = (v: number) => (v > 0 ? Math.max(1, Math.round((v / max) * pixels)) : 0)
  // a sample from before `done` was kept counts parked work as done
  const done = Array.from({ length: cols }, (_, c) => px(at(c).done ?? at(c).total - at(c).left))
  const scope = Array.from({ length: cols }, (_, c) => px(at(c).total))
  return { chart: { cols, rows, done, scope, tone: board.drain?.outcome === 'DRAINED' ? 'g' : 'c' }, max, span: t1 - t0 }
}

const GLYPHS = ' ▁▂▃▄▅▆▇█'
const TONE_RGB: Record<string, number> = { c: 0x56c8d8, g: 0x7bd88f }
const LEFT_RGB = 0x4a4a4a

/** The chart as text rows, for a surface that cannot draw a Raster: done in eighths, work left shaded. */
export function chartGlyphs(chart: Chart): Seg[][] {
  const eighths = (pixels: number, r: number) => Math.max(0, Math.min(8, Math.round((pixels / (chart.rows * 2)) * chart.rows * 8) - (chart.rows - 1 - r) * 8))
  return Array.from({ length: chart.rows }, (_, r) => {
    const out: Seg[] = []
    for (let c = 0; c < chart.cols; c++) {
      const d = eighths(chart.done[c]!, r)
      const [ch, tone] = d ? [GLYPHS[d]!, chart.tone] : eighths(chart.scope[c]!, r) ? ['░', 'd'] : [' ', undefined]
      const last = out.at(-1)
      if (last && last.c === tone) last.t += ch
      else out.push(seg(ch, tone))
    }
    return out
  })
}

/** The chart as Raster cells, `[character, colour, background]`: half blocks give each cell two pixels. */
export function chartCells(chart: Chart): [string, number, number][][] {
  const pixels = chart.rows * 2
  const rgb = TONE_RGB[chart.tone] ?? 0x56c8d8
  const colour = (c: number, p: number) => (p < chart.done[c]! ? rgb : p < chart.scope[c]! ? LEFT_RGB : undefined)
  return Array.from({ length: chart.rows }, (_, r) =>
    Array.from({ length: chart.cols }, (_, c): [string, number, number] => {
      const top = colour(c, pixels - 1 - r * 2)
      const bottom = colour(c, pixels - 2 - r * 2)
      if (top === undefined && bottom === undefined) return [' ', DEFAULT_COLOR, DEFAULT_COLOR]
      if (top === undefined) return ['▄', bottom!, DEFAULT_COLOR]
      if (bottom === undefined) return ['▀', top, DEFAULT_COLOR]
      return top === bottom ? ['█', top, DEFAULT_COLOR] : ['▀', top, bottom]
    }))
}

/** The forecast as rows: the two dates, and a histogram of the trials by day. */
function forecastRows(f: Forecast, now: number, w: number): Row[] {
  if (!f.days || !f.hist) return [line(['forecast', 'b'], [` ${f.reason}`, 'd'])]
  const head = line(['forecast', 'b'], [`  50% by ${dayName(now, f.days.p50)}`, 'c'], ['  ·  ', 'd'], [`85% by ${dayName(now, f.days.p85)}`, 'c b'], [`  ${f.left} tickets left, ${f.samples} days of merges`, 'd'])
  const cols = Math.min(f.hist.length, Math.max(10, w - 2))
  const per = Math.ceil(f.hist.length / cols)
  const buckets = Array.from({ length: Math.ceil(f.hist.length / per) }, (_, i) => f.hist!.slice(i * per, (i + 1) * per).reduce((a, b) => a + b, 0))
  const top = Math.max(...buckets)
  const segs = buckets.map((n, i) => seg(GLYPHS[n ? Math.max(1, Math.round((n / top) * 8)) : 0]!, i * per <= f.days!.p85 ? 'c' : 'd'))
  return [head, { kind: 'line', segs }]
}

/** When gh and Jira last answered the board's own queries, or why the last query failed. */
export function sourcesRow(board: Board, now: number): Row {
  const one = (name: string, s: Sync | undefined): [string, string][] =>
    !s ? [[`${name} not read yet`, 'd']] : s.error ? [[`${name} ✖ ${s.error.slice(0, 60)}`, 'r']] : [[`${name} ${fmtAgo(now - (s.at ?? now))}`, 'd']]
  return line(['synced  ', 'd'], ...one('gh', board.gh), ['  ·  ', 'd'], ...one('jira', board.jira))
}

function boardRows(board: Board, ctx: Ctx, w: number): Row[] {
  const rows: Row[] = [headerRow(board, ctx, w), sourcesRow(board, ctx.now), blank]
  const { left, done, total, unit } = leftOf(board)
  if (total) {
    rows.push(spread(text([String(left), 'b'], [` / ${total} ${unitName(unit)} left`, 'd']), text([`${Math.round((done / total) * 100)}% done`, left ? 'd' : 'g']), w))
    rows.push({ kind: 'line', segs: barSegs(done / total, Math.max(8, w), left ? 'c' : 'g') })
  } else {
    rows.push(line(['no tickets seen yet', 'd']))
  }
  rows.push(blank)
  const built = board.order.filter(k => board.tickets[k]?.pr).length
  const stuck = board.drain?.outcome === 'STUCK'
  const parked = parkedOf(board).length
  const looping = stallsOf(board).length
  rows.push({
    kind: 'tiles',
    tiles: [
      { label: 'built', value: String(built), sub: `of ${board.order.length}`, tone: 'c' },
      { label: 'merged', value: String(mergedPrs(board)), sub: `of ${board.prOrder.length} PRs`, tone: 'm' },
      { label: stuck ? 'blocked' : 'parked', value: String(parked), sub: looping ? `${looping} looping` : parked ? 'needs you' : 'none', tone: parked || looping ? (stuck ? 'r' : 'y') : 'd' },
    ],
  })
  rows.push(blank)
  const burn = chartOf(board, ctx, Math.max(10, w - 2))
  if (burn) {
    const samples = board.burn!
    const grew = samples.at(-1)!.total - samples[0]!.total
    rows.push(spread(text(['burnup', 'b'], [` · ${unitName(unit)} done of scope ${burn.max}`, 'd'], [grew ? ` · scope ${grew > 0 ? '+' : ''}${grew}` : '', grew > 0 ? 'y' : 'd']), text([fmtDur(burn.span), 'd']), w))
    rows.push({ kind: 'chart', chart: burn.chart })
  } else {
    rows.push(line(['burnup', 'b'], [' appears after the second change to the board', 'd']))
  }
  rows.push(blank)
  rows.push(...forecastRows(forecast(board, ctx.now), ctx.now, w))
  const flags = attention(board, ctx.now, ctx.budget)
  if (flags.length) rows.push(blank)
  for (const f of parkedOf(board)) rows.push(line(['⏸ ', 'y'], [f, 'y']))
  for (const f of stallsOf(board)) rows.push(line(['⟳ ', 'y'], [f, 'y']))
  for (const f of budgetFlag(board, ctx.budget)) rows.push(line(['$ ', 'r'], [f, 'r']))
  for (const f of agingFlags(board, ctx.now)) rows.push(line(['⌛ ', 'y'], [f, 'y']))
  for (const f of cacheFlags(board)) rows.push(line(['◔ ', 'y'], [f, 'y']))
  return rows
}

const PHASES = ['plan', 'implement', 'validate', 'review', 'pr']

function phaseIndex(phase: string | undefined): number {
  if (!phase) return -1
  if (phase === 'rework') return 1
  if (phase === 'post_merge' || phase === 'status_change') return PHASES.length
  return PHASES.indexOf(phase)
}

const CELL: Record<Cell, [string, string]> = { done: ['✔', 'g'], now: ['●', 'y b'], todo: ['·', 'd'], fail: ['✖', 'r b'] }
const MAX_BUILD_ROWS = 12

function flowRows(board: Board): Row[] {
  const rows: Row[] = []
  const open = board.order.filter(k => {
    const t = board.tickets[k]!
    return t.category !== 'done' && !(t.pr && board.prs[t.pr]?.merged)
  })
  rows.push(line(['BUILD', 'c b'], ['  open tickets, phase from Jira', 'd']))
  if (!open.length) rows.push(line(['none yet', 'd']))
  for (const key of open.slice(-MAX_BUILD_ROWS)) {
    const t = board.tickets[key]!
    const at = phaseIndex(t.phase)
    const dots = PHASES.map((_, i) => (t.parked ? seg('○', 'd') : i < at ? seg('●', 'g') : i === at ? seg('◐', 'y b') : seg('○', 'd')))
    const label = t.parked ? 'needs info' : (t.phase ?? t.status ?? '—')
    rows.push({ kind: 'line', segs: [seg(key.padEnd(10), t.parked ? 'y' : 'b'), ...dots, seg(`  ${label.padEnd(11)}`, t.parked ? 'y' : 'd'), seg(t.pr ? `PR #${t.pr}` : '', 'd')] })
  }
  if (open.length > MAX_BUILD_ROWS) rows.push(line([`… ${open.length - MAX_BUILD_ROWS} earlier`, 'd']))
  rows.push(blank)
  rows.push(line(['MERGE', 'm b'], ['  one lane per train step', 'd']))
  const lanes = laneRows(board)
  if (!lanes.length) rows.push(line(['no PRs seen yet', 'd']))
  else rows.push(line([`${'PR'.padEnd(6)}${'ticket'.padEnd(8)}3a 3b 3c 3e 3f 4   ci`, 'd']))
  for (const l of lanes) {
    const cells = l.cells.map(c => seg(`${CELL[c][0]}  `, CELL[c][1]))
    rows.push({ kind: 'line', segs: [seg(`#${l.pr}`.padEnd(6), 'b'), seg(l.key.padEnd(8)), ...cells, seg(` ${l.ci || 'no run'}`, 'd')] })
  }
  return rows
}

const MAX_AGING_ROWS = 12

function wipRows(board: Board, ctx: Ctx, w: number): Row[] {
  const { items, p50, p85 } = agingOf(board, ctx.now)
  const n = board.history?.cycles.length ?? 0
  const rows: Row[] = [
    p50 !== undefined && p85 !== undefined
      ? line(['AGING', 'c b'], ['  by age · ', 'd'], ['┊', 'y'], [` p50 ${span(p50)}  `, 'd'], ['│', 'r'], [` p85 ${span(p85)} (${n} merged PRs)`, 'd'])
      : line(['AGING', 'c b'], [`  by age · lines after ${MIN_CYCLES} merged PRs, ${n} so far`, 'd']),
  ]
  if (!items.length) rows.push(line(['nothing in progress', 'd']))
  const bw = Math.max(8, Math.min(30, w - 36))
  const scale = Math.max(1, ...items.map(i => i.age), (p85 ?? 0) * 1.25)
  const mark = (x: number | undefined) => (x === undefined ? -1 : Math.min(bw - 1, Math.round((x / scale) * bw)))
  for (const i of items.slice(0, MAX_AGING_ROWS)) {
    const tone = p85 !== undefined && i.age > p85 ? 'r' : p50 !== undefined && i.age > p50 ? 'y' : 'g'
    const fill = Math.max(1, Math.round((i.age / scale) * bw))
    const bar = Array.from({ length: bw }, (_, x) => (x === mark(p85) ? seg('│', 'r') : x === mark(p50) ? seg('┊', 'y') : x < fill ? seg('▇', tone) : seg(' ')))
    rows.push({ kind: 'line', segs: [seg(i.id.padEnd(14), 'b'), seg(i.where.slice(0, 11).padEnd(12), 'd'), ...bar, seg(` ${span(i.age)}`, tone)] })
  }
  if (items.length > MAX_AGING_ROWS) rows.push(line([`… ${items.length - MAX_AGING_ROWS} more`, 'd']))
  rows.push(blank)
  const { pairs, dirs } = overlapOf(board)
  const unread = board.prOrder.filter(k => board.prs[k]!.state === 'OPEN' && board.prs[k]!.head && board.prs[k]!.filesHead !== board.prs[k]!.head).length
  rows.push(line(['OVERLAP', 'm b'], ['  PRs sharing files merge in turn', 'd']))
  if (!pairs.length) rows.push(line([unread ? 'no shared file among the PRs read so far' : 'no two open PRs share a file', 'd']))
  for (const p of pairs.slice(0, 8)) {
    const shown = p.files.slice(0, 2).join(', ') + (p.files.length > 2 ? ` +${p.files.length - 2}` : '')
    rows.push(line([`#${p.a} × #${p.b}`.padEnd(14), 'y b'], [shown.slice(0, Math.max(10, w - 16)), 'y']))
  }
  for (const d of dirs.slice(0, 6)) rows.push(line([d.dir.padEnd(14), 'd'], d.prs.map(n => `#${n}`).join(' ')))
  if (unread) rows.push(line([`files not read yet for ${unread} open PR(s)`, 'd']))
  return rows
}

function passSpan(p: Pass, now: number) {
  const end = Math.max(p.start, p.end ?? now)
  const buildMs = Math.max(0, (p.merge ?? end) - p.start)
  return { buildMs, mergeMs: p.merge ? Math.max(0, end - p.merge) : 0, total: end - p.start }
}

function drainRows(board: Board, ctx: Ctx, w: number): Row[] {
  const passes = board.passes ?? []
  if (!passes.length) return [line(['no drain passes recorded yet', 'd'])]
  const bar = Math.max(6, Math.min(24, w - 24))
  const longest = Math.max(1, ...passes.map(p => passSpan(p, ctx.now).total))
  const rows: Row[] = [line(['pass  ', 'd'], ['■ build ', 'c'], ['■ merge', 'm'])]
  let spent = 0
  let known = true
  let total = 0
  passes.forEach((p, i) => {
    const s = passSpan(p, ctx.now)
    const running = p.end === undefined && board.drain?.outcome === 'running'
    const cost = passCost(p, ctx.usd)
    if (cost === undefined) known = false
    else spent += cost
    total += s.total
    const buildW = Math.round((s.buildMs / longest) * bar)
    const mergeW = Math.round((s.mergeMs / longest) * bar)
    rows.push({
      kind: 'line',
      segs: [
        seg(`p${i + 1}`.padEnd(5), 'b'),
        seg(rep('█', buildW), 'c'),
        seg(rep('█', mergeW), 'm'),
        seg(running ? '▌' : '', 'y'),
        seg(`  ${fmtDur(s.total)}`, ''),
        seg(cost === undefined ? '' : `  ${usd(cost)}`, 'd'),
      ],
    })
    const m = movesOf(board, p, ctx.now)
    const hits = (['build', 'merge'] as const).flatMap(st => (hitRate(p.tokens?.[st]) === undefined ? [] : [`${st} ${pct(hitRate(p.tokens![st])!)}`]))
    rows.push(line('     ', [m.built || m.merged ? `build ${m.built} → merge ${m.merged}${running ? ' so far' : ''}` : running ? 'running' : 'nothing moved', 'd'], [hits.length ? `  · cache ${hits.join(' ')}` : '', 'd']))
  })
  const merged = passes.reduce((n, p) => n + movesOf(board, p, ctx.now).merged, 0)
  rows.push(blank)
  rows.push(spread(text(['total ', 'd'], [`${passes.length} pass${passes.length === 1 ? '' : 'es'} · ${fmtDur(total)}`, 'b']), known ? text([usd(spent), 'b']) : [], w))
  if (known && merged > 0) rows.push(spread(text(['per merged PR', 'd']), text([usd(spent / merged), 'b']), w))
  const rate = rateOf(board, ctx.now)
  if (rate.perHour !== undefined) rows.push(spread(text(['spend rate', 'd']), text([`${usd(rate.perHour)}/h`, 'b'], [ctx.budget ? `  ·  ${usd(rate.spent)} of ${usd(ctx.budget)}` : '', rate.spent >= (ctx.budget || Infinity) ? 'r b' : 'd']), w))
  rows.push(blank)
  rows.push(line(['cost = session spend between pass boundaries', 'd']))
  rows.push(line(['cache = prompt tokens read from the cache', 'd']))
  rows.push(blank)
  rows.push(...agentRows(ctx, w))
  return rows
}

function agentRows(ctx: Ctx, w: number): Row[] {
  const rows: Row[] = [line(['AGENTS', 'b'], ['  the loop\'s agents, from the engine', 'd'])]
  if (!ctx.lanes?.length) return [...rows, line(['none in this session', 'd'])]
  for (const l of ctx.lanes) {
    const tone = l.status === 'running' ? 'g' : l.status === 'failed' || l.status === 'killed' ? 'r' : 'd'
    const tok = l.tokens >= 1e6 ? `${(l.tokens / 1e6).toFixed(1)}M` : `${Math.round(l.tokens / 1e3)}k`
    rows.push({
      kind: 'line',
      segs: [
        seg('● ', tone), seg(l.name.slice(0, 18).padEnd(19), 'b'), seg(l.work.padEnd(9)), seg(l.status.padEnd(10), tone),
        seg(fmtDur(l.age).padEnd(9), 'd'), seg(`${tok} tok`.padEnd(10), 'd'), seg(l.hit === undefined ? '' : `cache ${pct(l.hit)}  `, 'd'),
        seg(l.wait ? `⏳ ${l.wait}` : l.status === 'running' && l.idle > 120_000 ? `quiet ${fmtDur(l.idle)}` : '', 'y'),
      ].slice(0, w >= 90 ? 8 : w >= 60 ? 5 : 4),
    })
  }
  return rows
}

const RULE_LABEL: Record<Refusal['rule'], string> = { grant: 'grant', '3f': '3f', push: 'push', fix: 'fix', budget: 'budget', side: 'side' }

function guardRows(ctx: Ctx, w: number): Row[] {
  const rows: Row[] = [
    spread(text(['GUARDS', 'b'], ['  this session', 'd']), text([String(ctx.refusals.length), ctx.refusals.length ? 'r b' : 'g b'], [' refused  ', 'd'], [String(ctx.allowed), 'g b'], [' allowed', 'd']), w),
    blank,
  ]
  if (!ctx.refusals.length) rows.push(line(['no call refused', 'd']))
  for (const r of [...ctx.refusals].reverse().slice(0, 6)) {
    rows.push(line([fmtAgo(ctx.now - r.at).padEnd(9), 'd'], ['✖ ', 'r'], [RULE_LABEL[r.rule].padEnd(6), 'y'], r.text.replace(/^agile-mods:\s*/, '').slice(0, Math.max(10, w - 18))))
    if (r.agent) rows.push(line('          ', [`by ${r.agent}`, 'd']))
  }
  rows.push(blank)
  rows.push(line(['RECEIPTS', 'b'], ['  checked against the contract', 'd']))
  if (!ctx.receipts.length) rows.push(line(['none yet', 'd']))
  for (const r of [...ctx.receipts].reverse().slice(0, 6)) {
    const name = r.agent.split(':').at(-1)!
    rows.push(r.issues.length
      ? line(['✖ ', 'r'], name.padEnd(18), [`${r.pr ? `#${r.pr} ` : ''}${r.issues.join('; ')}`.slice(0, Math.max(10, w - 24)), 'r'])
      : line(['✔ ', 'g'], name.padEnd(18), [r.pr ? `#${r.pr}` : '', 'd']))
  }
  return rows
}

function linkRows(board: Board): Row[] {
  const links = linksOf(board)
  if (!links.length) return [line(['no links yet · they come from gh and Jira', 'd'])]
  return links.map(l => ({ kind: 'link', label: l.label, href: l.href }))
}

/** A line cut to `w` columns; other rows as they are. */
function clip(row: Row, w: number): Row {
  if (row.kind !== 'line' || width(row.segs) <= w) return row
  const segs: Seg[] = []
  let room = w
  for (const s of row.segs) {
    if (room <= 0) break
    segs.push(s.t.length <= room ? s : { ...s, t: s.t.slice(0, Math.max(0, room - 1)) + '…' })
    room -= s.t.length
  }
  return { kind: 'line', segs }
}

function tabRows(tab: Tab, board: Board, ctx: Ctx, w: number): Row[] {
  if (tab === 'flow') return flowRows(board)
  if (tab === 'wip') return wipRows(board, ctx, w)
  if (tab === 'drain') return drainRows(board, ctx, w)
  if (tab === 'guards') return guardRows(ctx, w)
  if (tab === 'links') return linkRows(board)
  return boardRows(board, ctx, w)
}

/** The rows of one tab, drawn to `w` columns. */
export const consoleRows = (tab: Tab, board: Board, ctx: Ctx, w: number): Row[] => tabRows(tab, board, ctx, w).map(r => clip(r, w))

/** The single alert row above the prompt: what needs a person or just ended; undefined when nothing does. */
export function alertRow(board: Board, ctx: Ctx, w: number): Row | undefined {
  const flags = attention(board, ctx.now, ctx.budget)
  const hint = text(['/agile-board', 'd'])
  if (board.drain?.outcome === 'STUCK') return spread(text([' STUCK ', 'bgr b'], [` ${flags.slice(0, 2).join(' · ') || 'no actionable work'}`, 'r']), hint, w)
  if (board.drain?.outcome === 'DRAINED') {
    const time = elapsed(board, ctx.now)
    return spread(text([' DRAINED ', 'bgg b'], [` ${mergedPrs(board)} merged${time === undefined ? '' : ` · ${fmtDur(time)}`}`, 'g']), hint, w)
  }
  if (!flags.length) return undefined
  return spread(text(['⚠ ', 'y b'], [`${flags.length} need${flags.length === 1 ? 's' : ''} you`, 'y b'], [` · ${flags.slice(0, 2).join(' · ')}`, 'y']), hint, w)
}

/** The status-line entry: where the loop is, work left, merges, spend rate, and the 85% date; undefined when idle. */
export function statusText(board: Board, now: number, budget = 0): string | undefined {
  if (!board.loop && !board.order.length && !board.prOrder.length) return undefined
  const { left, total, unit } = leftOf(board)
  const where = board.drain
    ? board.drain.outcome === 'running' ? `drain p${board.drain.pass}${board.stage ? ` ${board.stage}` : ''}` : `drain ${board.drain.outcome}`
    : (board.loop ?? 'idle')
  const rate = rateOf(board, now)
  const money = [
    rate.perHour !== undefined ? `$${rate.perHour.toFixed(2)}/h` : '',
    rate.perPr !== undefined ? `$${rate.perPr.toFixed(2)}/PR` : '',
    budget > 0 ? `$${rate.spent.toFixed(2)}/$${budget.toFixed(0)}` : '',
  ].filter(Boolean).join(' ')
  const f = left ? forecast(board, now) : undefined
  return `agile ▸ ${where}${total ? ` · ${left}/${total} ${unitName(unit)}` : ''} · ${mergedPrs(board)} merged${money ? ` · ${money}` : ''}${f?.days ? ` · 85% by ${dayName(now, f.days.p85)}` : ''}`
}

const DEFAULT_COLOR = 0x01000000
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The base64 string a Raster takes: little-endian u32 triplets of code point, colour, background. */
export function rasterCells(cells: [string, number, number?][][]): string {
  const bytes: number[] = []
  for (const [ch, color, bg] of cells.flat()) {
    for (const n of [ch.codePointAt(0)!, color, bg ?? DEFAULT_COLOR]) bytes.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255)
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? B64[n & 63]! : '=')
  }
  return out
}
