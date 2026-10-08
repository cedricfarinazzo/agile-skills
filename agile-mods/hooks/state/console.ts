// Pure views behind the agile console pane, the alert band and the status line: every function takes
// the board (and a little context) and returns rows of styled text, so tests need no engine and
// register.tsx only maps rows onto elements.

import { laneRows, leftOf, linksOf, parkedOf, passCost, stallsOf, type Board, type Cell, type Pass } from './board.ts'
import type { Refusal } from './guards.ts'
import type { Receipt } from './receipts.ts'

export type Tab = 'board' | 'flow' | 'drain' | 'guards' | 'links'

export const TABS: { id: Tab; label: string; hotkey: string }[] = [
  { id: 'board', label: 'Board', hotkey: '1' },
  { id: 'flow', label: 'Flow', hotkey: '2' },
  { id: 'drain', label: 'Drain', hotkey: '3' },
  { id: 'guards', label: 'Guards', hotkey: '4' },
  { id: 'links', label: 'Links', hotkey: '5' },
]

export const tabOf = (name: string): Tab | undefined => TABS.find(t => t.id === name)?.id

/**
 * A piece of text and its style tags, space separated: `d` dim, `b` bold, `u` underline, a colour
 * (`c` cyan, `m` magenta, `g` green, `y` yellow, `r` red, `bl` blue) or a badge (`bgr`, `bgg`).
 */
export type Seg = { t: string; c?: string }

export type Tile = { label: string; value: string; sub: string; tone: string }

/** The burndown as pixel rows: `level[c]` of `rows * 2` pixels are filled in column `c`, from the bottom. */
export type Chart = { cols: number; rows: number; level: number[]; tone: string }

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
const attention = (board: Board) => [...parkedOf(board), ...stallsOf(board)]

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
  const needs = attention(board).length
  if (board.drain?.outcome === 'STUCK') return spread(text([' STUCK ', 'bgr b'], [` ${needs} item${needs === 1 ? '' : 's'} need a human`, 'r']), right, w)
  if (board.drain?.outcome === 'DRAINED') return spread(text([' DRAINED ', 'bgg b'], [' nothing left to build or merge', 'g']), right, w)
  if (board.drain) return spread(text(['● ', 'g b'], ['DRAIN', 'b'], [` pass ${board.drain.pass}${board.stage ? ` · ${board.stage}` : ''}`, 'd']), right, w)
  if (board.loop) return spread(text(['● ', 'g b'], [board.loop.toUpperCase(), 'b'], [board.stage ? ` · ${board.stage}` : '', 'd']), right, w)
  return line(['idle', 'd'], [' · the loop has not run in this session', 'd'])
}

/** The burndown from the board's samples: work left over the span they cover. */
function chartOf(board: Board, ctx: Ctx, cols: number): { chart: Chart; max: number; span: number } | undefined {
  const samples = board.burn ?? []
  if (samples.length < 2) return undefined
  const rows = 5
  const max = Math.max(...samples.map(s => s.total))
  const t0 = samples[0]!.at
  const running = !board.drain || board.drain.outcome === 'running'
  const t1 = Math.max(samples.at(-1)!.at, running ? ctx.now : 0, t0 + 1)
  const level = Array.from({ length: cols }, (_, c) => {
    const t = t0 + ((c + 0.5) / cols) * (t1 - t0)
    const left = [...samples].reverse().find(s => s.at <= t)?.left ?? samples[0]!.left
    return left > 0 ? Math.max(1, Math.round((left / max) * rows * 2)) : 0
  })
  return { chart: { cols, rows, level, tone: board.drain?.outcome === 'DRAINED' ? 'g' : 'c' }, max, span: t1 - t0 }
}

const GLYPHS = ' ▁▂▃▄▅▆▇█'
const TONE_RGB: Record<string, number> = { c: 0x56c8d8, g: 0x7bd88f }

/** The chart as text rows, for a surface that cannot draw a Raster. */
export function chartGlyphs(chart: Chart): Seg[][] {
  return Array.from({ length: chart.rows }, (_, r) => {
    const out: Seg[] = []
    for (let c = 0; c < chart.cols; c++) {
      const eighths = Math.max(0, Math.min(8, Math.round((chart.level[c]! / (chart.rows * 2)) * chart.rows * 8) - (chart.rows - 1 - r) * 8))
      const ch = GLYPHS[eighths]!
      const last = out.at(-1)
      if (last && last.c === (eighths ? chart.tone : undefined)) last.t += ch
      else out.push(seg(ch, eighths ? chart.tone : undefined))
    }
    return out
  })
}

/** The chart as Raster cells, `[character, colour]`: half blocks give each cell two pixel rows. */
export function chartCells(chart: Chart): [string, number][][] {
  const pixels = chart.rows * 2
  const rgb = TONE_RGB[chart.tone] ?? 0x56c8d8
  return Array.from({ length: chart.rows }, (_, r) =>
    Array.from({ length: chart.cols }, (_, c): [string, number] => {
      const top = pixels - chart.level[c]! <= r * 2
      const bottom = pixels - chart.level[c]! <= r * 2 + 1
      return [top ? '█' : bottom ? '▄' : ' ', rgb]
    }))
}

function boardRows(board: Board, ctx: Ctx, w: number): Row[] {
  const rows: Row[] = [headerRow(board, ctx, w), blank]
  const { left, total, unit } = leftOf(board)
  if (total) {
    const done = total - left
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
      { label: 'built', value: String(built), sub: `of ${board.order.length} tickets`, tone: 'c' },
      { label: 'merged', value: String(mergedPrs(board)), sub: `of ${board.prOrder.length} PRs`, tone: 'm' },
      { label: stuck ? 'blocked' : 'parked', value: String(parked), sub: looping ? `${looping} looping` : parked ? 'needs you' : 'none', tone: parked || looping ? (stuck ? 'r' : 'y') : 'd' },
    ],
  })
  rows.push(blank)
  const burn = chartOf(board, ctx, Math.max(10, w - 2))
  if (burn) {
    rows.push(spread(text(['burndown', 'b'], [` · ${unitName(unit)}, top = ${burn.max}`, 'd']), text([fmtDur(burn.span), 'd']), w))
    rows.push({ kind: 'chart', chart: burn.chart })
  } else {
    rows.push(line(['burndown', 'b'], [' appears after the second change to the board', 'd']))
  }
  const flags = attention(board)
  if (flags.length) rows.push(blank)
  for (const f of parkedOf(board)) rows.push(line(['⏸ ', 'y'], [f, 'y']))
  for (const f of stallsOf(board)) rows.push(line(['⟳ ', 'y'], [f, 'y']))
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
    const pr = board.tickets[k]?.pr
    return !(pr && board.prs[pr]?.merged)
  })
  rows.push(line(['BUILD', 'c b'], ['  tickets without a merged PR', 'd']))
  if (!open.length) rows.push(line(['none yet', 'd']))
  for (const key of open.slice(-MAX_BUILD_ROWS)) {
    const t = board.tickets[key]!
    const at = phaseIndex(t.phase)
    const dots = PHASES.map((_, i) => (t.parked ? seg('○', 'd') : i < at ? seg('●', 'g') : i === at ? seg('◐', 'y b') : seg('○', 'd')))
    const label = t.parked ? (t.parked === 'needs-info' ? 'needs info' : 'parked') : (t.phase ?? '—')
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
    rows.push({ kind: 'line', segs: [seg(`#${l.pr}`.padEnd(6), 'b'), seg(l.key.padEnd(8)), ...cells, seg(` ${l.ci || 'no run'}${l.reviewed ? `  ${l.reviewed}` : ''}`, 'd')] })
  }
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
    rows.push(line('     ', [p.built || p.merged ? `build ${p.built} → merge ${p.merged}${running ? ' so far' : ''}` : running ? 'running' : 'nothing moved', 'd']))
  })
  const merged = board.drain?.outcome === 'DRAINED' || passes.some(p => p.merged) ? passes.reduce((n, p) => n + p.merged, 0) : mergedPrs(board)
  rows.push(blank)
  rows.push(spread(text(['total ', 'd'], [`${passes.length} pass${passes.length === 1 ? '' : 'es'} · ${fmtDur(total)}`, 'b']), known ? text([usd(spent), 'b']) : [], w))
  if (known && merged > 0) rows.push(spread(text(['per merged PR', 'd']), text([usd(spent / merged), 'b']), w))
  rows.push(blank)
  rows.push(line(['cost = session spend between pass boundaries', 'd']))
  return rows
}

const RULE_LABEL: Record<Refusal['rule'], string> = { grant: 'grant', '3f': '3f', push: 'push' }

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
  if (!links.length) return [line(['no links yet · they appear as the loop reads', 'd'])]
  return links.map(l => ({ kind: 'link', label: l.label, href: l.href }))
}

/** The rows of one tab, drawn to `w` columns. */
export function consoleRows(tab: Tab, board: Board, ctx: Ctx, w: number): Row[] {
  if (tab === 'flow') return flowRows(board)
  if (tab === 'drain') return drainRows(board, ctx, w)
  if (tab === 'guards') return guardRows(ctx, w)
  if (tab === 'links') return linkRows(board)
  return boardRows(board, ctx, w)
}

/** The single alert row above the prompt: what needs a person or just ended; undefined when nothing does. */
export function alertRow(board: Board, ctx: Ctx, w: number): Row | undefined {
  const flags = attention(board)
  const hint = text(['/agile-board', 'd'])
  if (board.drain?.outcome === 'STUCK') return spread(text([' STUCK ', 'bgr b'], [` ${flags.slice(0, 2).join(' · ') || 'no actionable work'}`, 'r']), hint, w)
  if (board.drain?.outcome === 'DRAINED') {
    const time = elapsed(board, ctx.now)
    return spread(text([' DRAINED ', 'bgg b'], [` ${mergedPrs(board)} merged${time === undefined ? '' : ` · ${fmtDur(time)}`}`, 'g']), hint, w)
  }
  if (!flags.length) return undefined
  return spread(text(['⚠ ', 'y b'], [`${flags.length} need${flags.length === 1 ? 's' : ''} you`, 'y b'], [` · ${flags.slice(0, 2).join(' · ')}`, 'y']), hint, w)
}

/** The status-line entry; undefined clears it when the loop is idle. */
export function statusText(board: Board): string | undefined {
  if (!board.loop && !board.order.length && !board.prOrder.length) return undefined
  const { left, total, unit } = leftOf(board)
  const where = board.drain
    ? board.drain.outcome === 'running' ? `drain p${board.drain.pass}${board.stage ? ` ${board.stage}` : ''}` : `drain ${board.drain.outcome}`
    : (board.loop ?? 'idle')
  return `agile ▸ ${where}${total ? ` · ${left}/${total} ${unitName(unit)}` : ''} · ${mergedPrs(board)} merged`
}

const DEFAULT_COLOR = 0x01000000
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** The base64 string a Raster takes: little-endian u32 triplets of code point, colour, background. */
export function rasterCells(cells: [string, number][][]): string {
  const bytes: number[] = []
  for (const [ch, color] of cells.flat()) {
    for (const n of [ch.codePointAt(0)!, color, DEFAULT_COLOR]) bytes.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255)
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? B64[n & 63]! : '=')
  }
  return out
}
