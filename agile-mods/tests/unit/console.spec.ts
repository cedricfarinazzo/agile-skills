import { describe, expect, test } from 'bun:test'
import { EMPTY, passCost, stampCosts, type Board } from '../../hooks/state/board.ts'
import { alertRow, chartCells, chartGlyphs, consoleRows, fmtAgo, fmtDur, rasterCells, statusText, tabOf, type Ctx, type Row } from '../../hooks/state/console.ts'
import { keepRefusal, MAX_REFUSALS, ruleOf } from '../../hooks/state/guards.ts'

const SHA = 'a'.repeat(40)
const ctx = (over: Partial<Ctx> = {}): Ctx => ({ now: 600_000, usd: 4, refusals: [], allowed: 12, receipts: [], ...over })
const plain = (rows: Row[]) =>
  rows.map(r => (r.kind === 'line' ? r.segs.map(s => s.t).join('') : r.kind === 'tiles' ? r.tiles.map(t => `${t.label}:${t.value}:${t.sub}`).join('|') : r.kind === 'link' ? `${r.label} ${r.href}` : `chart ${r.chart.cols}x${r.chart.rows}`)).join('\n')

/** A drain in its second pass: three tickets, one parked, PR 42 looping at 3b, PR 40 merged. */
function sample(over: Partial<Board> = {}): Board {
  return {
    ...EMPTY,
    loop: 'drain',
    stage: 'merge',
    drain: { pass: 2, outcome: 'running' },
    order: ['VC-3', 'VC-7', 'VC-9'],
    tickets: { 'VC-3': { key: 'VC-3', phase: 'pr', pr: 40, points: 3 }, 'VC-7': { key: 'VC-7', phase: 'review', pr: 42, points: 5 }, 'VC-9': { key: 'VC-9', phase: 'plan', parked: 'needs-info', points: 2 } },
    prOrder: [40, 42],
    prs: {
      40: { number: 40, key: 'VC-3', state: 'MERGED', merged: true, step: '4 postmortem', createdAt: 60_000, mergedAt: 200_000 },
      42: { number: 42, key: 'VC-7', state: 'OPEN', step: '3b review', seen: { '3a update': 1, '3b review': 3 }, head: SHA, createdAt: 100_000 },
    },
    burn: [{ at: 0, left: 10, total: 10 }, { at: 120_000, left: 7, total: 10 }, { at: 300_000, left: 2, total: 10 }],
    burnUnit: 'points',
    passes: [{ start: 0, merge: 120_000, end: 300_000, cost0: 0, cost1: 1.5 }, { start: 300_000, cost0: 1.5 }],
    gh: { at: 590_000 },
    jira: { at: 540_000 },
    ...over,
  }
}

describe('console rows', () => {
  test('board tab: header, gauge, tiles, chart, flags', () => {
    const out = plain(consoleRows('board', sample(), ctx(), 48))
    expect(out).toContain('DRAIN pass 2 · merge')
    expect(out).toContain('10m 00s')
    expect(out).toContain('5 / 10 pts left')
    expect(out).toContain('built:2:of 3')
    expect(out).toContain('merged:1:of 2 PRs')
    expect(out).toContain('parked:1:1 looping')
    expect(out).toContain('chart 46x5')
    expect(out).toContain('VC-9 Needs Info')
    expect(out).toContain('PR #42 3b review ×3')
  })

  test('an idle board says so, and the chart waits for two samples', () => {
    expect(plain(consoleRows('board', EMPTY, ctx(), 48))).toContain('idle')
    expect(plain(consoleRows('board', sample({ burn: [] }), ctx(), 48))).toContain('appears after the second change')
  })

  test('STUCK and DRAINED headers', () => {
    expect(plain(consoleRows('board', sample({ drain: { pass: 2, outcome: 'STUCK' } }), ctx(), 48))).toContain('STUCK')
    const drained = plain(consoleRows('board', sample({ drain: { pass: 2, outcome: 'DRAINED' } }), ctx(), 48))
    expect(drained).toContain('DRAINED')
  })

  test('flow tab: ticket dots by phase, PR lanes', () => {
    const out = plain(consoleRows('flow', sample(), ctx(), 48))
    expect(out).toMatch(/VC-7\s+●●●◐○\s+review\s+PR #42/)
    expect(out).toMatch(/VC-9\s+○○○○○\s+needs info/)
    expect(out.split('MERGE')[0]).not.toContain('VC-3')
    expect(out).toContain('3a 3b 3c 3e 3f 4')
    expect(out).toMatch(/#42\s+VC-7/)
  })

  test('drain tab: a row per pass, cost from the stamped boundaries, live cost for the running pass', () => {
    const out = plain(consoleRows('drain', sample(), ctx({ usd: 4 }), 48))
    expect(out).toContain('p1')
    expect(out).toContain('$1.50')
    expect(out).toContain('$2.50')
    expect(out).toContain('build 2 → merge 1')
    expect(out).toContain('$4.00')
    expect(out).toContain('per merged PR')
  })

  test('the sources row says when gh and Jira last answered, or why they failed', () => {
    expect(plain(consoleRows('board', sample(), ctx(), 48))).toContain('synced  gh 10s ago  ·  jira 1m ago')
    const failed = plain(consoleRows('board', sample({ jira: { at: 1, error: 'no Atlassian MCP server connected' } }), ctx(), 80))
    expect(failed).toContain('jira ✖ no Atlassian MCP server connected')
    expect(plain(consoleRows('board', EMPTY, ctx(), 48))).toContain('gh not read yet')
  })

  test('a clock behind the pass start draws a zero-length bar, not an error', () => {
    expect(() => consoleRows('drain', sample(), ctx({ now: 0 }), 48)).not.toThrow()
    expect(() => consoleRows('board', sample(), ctx({ now: 0 }), 4)).not.toThrow()
  })

  test('drain tab without costs shows no money', () => {
    const b = sample({ passes: [{ start: 0, end: 60_000 }] })
    expect(plain(consoleRows('drain', b, ctx({ usd: undefined }), 48))).not.toContain('$')
    expect(plain(consoleRows('drain', EMPTY, ctx(), 48))).toContain('no drain passes')
  })

  test('guards tab: refusals newest first, receipts with flags', () => {
    const refusals = [
      { at: 590_000, rule: '3f' as const, text: 'agile-mods: PR #42: CI run read green once.', agent: 'merge-session' },
      { at: 599_000, rule: 'push' as const, text: 'agile-mods: the loop never pushes to main' },
    ]
    const receipts = [{ agent: 'agile-merge-review:pr-reviewer', at: 1, pr: 42, issues: ['no reviewed sha'] }, { agent: 'agile-execution:ticket-validator', at: 2, issues: [] }]
    const out = plain(consoleRows('guards', sample(), ctx({ refusals, receipts }), 60))
    expect(out.indexOf('never pushes to main')).toBeLessThan(out.indexOf('CI run read green once'))
    expect(out).toContain('by merge-session')
    expect(out).toContain('2 refused')
    expect(out).toContain('✖ pr-reviewer')
    expect(out).toContain('✔ ticket-validator')
  })

  test('links tab', () => {
    expect(plain(consoleRows('links', sample(), ctx(), 48))).toContain('no links yet')
    expect(plain(consoleRows('links', sample({ site: 'https://x.atlassian.net' }), ctx(), 48))).toContain('https://x.atlassian.net/browse/VC-3')
  })

  test('every line fits the width it was drawn to', () => {
    for (const tab of ['board', 'flow', 'wip', 'drain', 'guards', 'links'] as const) {
      for (const row of consoleRows(tab, sample(), ctx(), 48)) {
        if (row.kind === 'line') { const t = row.segs.map(s => s.t).join(''); expect(`${tab}|${t}|${t.length}`).toSatisfy(() => t.length <= 48) }
      }
    }
  })

  test('tab names', () => {
    expect(tabOf('flow')).toBe('flow')
    expect(tabOf('prs')).toBeUndefined()
  })
})

describe('wip and drain tabs', () => {
  test('wip: aging bars with percentile lines, and the overlap map', () => {
    const b = sample({
      history: { merges: [], cycles: [1, 2, 3, 4, 5, 6].map(m => m * 60_000) },
      prOrder: [40, 42, 43],
      prs: {
        ...sample().prs,
        42: { ...sample().prs[42]!, files: ['src/a.ts', 'src/b.ts'], filesHead: SHA },
        43: { number: 43, key: 'VC-8', state: 'OPEN', head: 'b'.repeat(40), createdAt: 500_000, files: ['src/a.ts'], filesHead: 'b'.repeat(40) },
      },
    })
    const out = plain(consoleRows('wip', b, ctx(), 80))
    expect(out).toContain('p50 3m')
    expect(out).toContain('p85 6m (6 merged PRs)')
    expect(out).toMatch(/#42 VC-7 +3b review .*8m/)
    expect(out).toMatch(/#43 VC-8 +open .*2m/)
    expect(out).toContain('#42 × #43')
    expect(out).toContain('src/a.ts')
    expect(out).toMatch(/src\/ +#42 #43/)
  })

  test('wip: no history yet, nothing in progress', () => {
    const out = plain(consoleRows('wip', EMPTY, ctx(), 60))
    expect(out).toContain('lines after 5 merged PRs, 0 so far')
    expect(out).toContain('nothing in progress')
    expect(out).toContain('no two open PRs share a file')
  })

  test('drain: cache by stage per pass, spend rate, and the agents lane', () => {
    const passes = [{ start: 0, merge: 120_000, end: 300_000, cost0: 0, cost1: 1.5, tokens: { build: { input: 10, read: 900, write: 90, output: 5 } } }, { start: 300_000, cost0: 1.5 }]
    const lanes = [{ id: 'a', name: 'merge-session', work: 'PR #42', status: 'running', age: 300_000, idle: 10_000, tokens: 1_500_000, hit: 0.92, wait: 'run 77' }]
    const out = plain(consoleRows('drain', sample({ spend: { usd: 2, since: 0 }, passes }), ctx({ lanes, budget: 10 }), 120))
    expect(out).toContain('cache build 90%')
    expect(out).toContain('$12.00/h')
    expect(out).toContain('$2.00 of $10.00')
    expect(out).toMatch(/merge-session +PR #42 +running +5m 00s +1\.5M tok +cache 92% +⏳ run 77/)
    expect(plain(consoleRows('drain', sample(), ctx(), 60))).toContain('none in this session')
  })
})

describe('chart', () => {
  // 4 pixels high: done fills from the bottom, work left is shaded up to the scope
  const chart = { cols: 4, rows: 2, done: [4, 2, 1, 0], scope: [4, 4, 3, 2], tone: 'c' }

  test('glyph rows: done in eighths, work left shaded', () => {
    expect(chartGlyphs(chart).map(r => r.map(s => s.t).join(''))).toEqual(['█░░ ', '██▄░'])
  })

  test('raster cells: half blocks, the background carrying the second colour', () => {
    const cells = chartCells(chart)
    expect(cells.map(r => r.map(c => c[0]).join(''))).toEqual(['██▄ ', '██▀█'])
    // bottom row, column 2: done on the lower pixel, work left above it
    expect(cells[1]![2]).toEqual(['▀', 0x4a4a4a, 0x56c8d8])
    expect(cells[0]![3]).toEqual([' ', 0x01000000, 0x01000000])
  })

  test('raster cells pack to little-endian u32 triplets in base64', () => {
    const packed = rasterCells([[['█', 0x56c8d8]]])
    const bytes = Uint8Array.from(atob(packed), c => c.charCodeAt(0))
    expect(Array.from(new Uint32Array(bytes.buffer))).toEqual(['█'.codePointAt(0)!, 0x56c8d8, 0x01000000])
    expect(rasterCells([[['█', 1], [' ', 2]]])).toBe(Buffer.from(new Uint8Array(new Uint32Array([0x2588, 1, 0x01000000, 0x20, 2, 0x01000000]).buffer)).toString('base64'))
  })
})

describe('alert row and status', () => {
  test('quiet while the loop is healthy', () => {
    expect(alertRow(sample({ tickets: {}, prs: {}, order: [], prOrder: [] }), ctx(), 60)).toBeUndefined()
  })

  test('parked and looping work needs you; the end of a drain says so', () => {
    const text = (row: Row | undefined) => (row?.kind === 'line' ? row.segs.map(s => s.t).join('') : '')
    expect(text(alertRow(sample(), ctx(), 70))).toContain('2 need you')
    expect(text(alertRow(sample({ drain: { pass: 2, outcome: 'STUCK' } }), ctx(), 70))).toContain('STUCK')
    expect(text(alertRow(sample({ drain: { pass: 2, outcome: 'DRAINED' } }), ctx(), 70))).toContain('1 merged')
  })

  test('status line, cleared when idle', () => {
    expect(statusText(EMPTY, 600_000)).toBeUndefined()
    expect(statusText(sample(), 600_000)).toBe('agile ▸ drain p2 merge · 5/10 pts · 1 merged')
    expect(statusText(sample({ drain: { pass: 2, outcome: 'DRAINED' } }), 600_000)).toContain('drain DRAINED')
  })

  test('status line: spend per hour and per merged PR, the budget, and the 85% date', () => {
    const HOUR = 3_600_000
    const now = 2 * HOUR
    const merges = Array.from({ length: 20 }, (_, d) => now - d * 86_400_000 - 1_000)
    const b = sample({ spend: { usd: 6, since: 0 }, history: { merges, cycles: [] }, prs: { ...sample().prs, 40: { ...sample().prs[40]!, mergedAt: HOUR } } })
    // 1 ticket left (VC-3 merged, VC-9 parked), one merge a day: 1 day in every trial
    expect(statusText(b, now)).toBe('agile ▸ drain p2 merge · 5/10 pts · 1 merged · $3.00/h $6.00/PR · 85% by ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(now + 86_400_000).getDay()])
    expect(statusText(b, now, 20)).toContain('$6.00/$20')
  })

  test('a spent budget and a PR past the 85th percentile need you', () => {
    const text = (row: Row | undefined) => (row?.kind === 'line' ? row.segs.map(s => s.t).join('') : '')
    const b = sample({ spend: { usd: 21, since: 0 }, history: { merges: [], cycles: [1, 1, 1, 1, 1].map(x => x * 60_000) } })
    const row = text(alertRow(b, ctx({ budget: 20 }), 200))
    expect(row).toContain('4 need you')
    expect(row).toContain('VC-9 Needs Info · PR #42 3b review ×3')
    const board = plain(consoleRows('board', b, ctx({ budget: 20 }), 80))
    expect(board).toContain('budget spent $21.00 of $20.00')
    expect(board).toContain('PR #42 open 8m (p85 1m)')
  })

  test('durations and ages', () => {
    expect(fmtDur(45_000)).toBe('45s')
    expect(fmtDur(760_000)).toBe('12m 40s')
    expect(fmtDur(3_900_000)).toBe('1h 05m')
    expect(fmtAgo(3_000)).toBe('just now')
    expect(fmtAgo(125_000)).toBe('2m ago')
  })
})

describe('pass costs', () => {
  test('stamps each boundary once, and a finished pass keeps its cost', () => {
    const b = stampCosts({ ...EMPTY, passes: [{ start: 0, built: 0, merged: 0 }] }, 2)
    expect(b.passes![0]).toMatchObject({ cost0: 2 })
    expect(stampCosts(b, 5)).toBe(b)
    const ended = stampCosts({ ...b, passes: [{ ...b.passes![0]!, end: 10 }] }, 5)
    expect(passCost(ended.passes![0]!)).toBe(3)
    expect(stampCosts(ended, 9)).toBe(ended)
  })

  test('a running pass reads the live cost, an unstamped one has none', () => {
    expect(passCost({ start: 0, built: 0, merged: 0, cost0: 1 }, 4)).toBe(3)
    expect(passCost({ start: 0, built: 0, merged: 0 }, 4)).toBeUndefined()
    expect(passCost({ start: 0, end: 5, built: 0, merged: 0, cost0: 1 }, 4)).toBeUndefined()
  })
})

describe('refusals', () => {
  test('rules are told apart by their text', () => {
    expect(ruleOf('agile-mods: the loop never pushes to main: work lands through a PR')).toBe('push')
    expect(ruleOf('agile-mods: the loop never force-pushes without a lease')).toBe('push')
    expect(ruleOf('agile-mods: pin the reviewed head: gh pr merge 4 --match-head-commit')).toBe('3f')
    expect(ruleOf('agile-mods: PR #4: CI run 9 read green once')).toBe('3f')
    expect(ruleOf('agile-mods: pr-reviewer reviews and never edits files')).toBe('grant')
  })

  test('the log keeps the newest', () => {
    let list: ReturnType<typeof keepRefusal> = []
    for (let i = 0; i < MAX_REFUSALS + 5; i++) list = keepRefusal(list, { at: i, rule: 'grant', text: 'x' })
    expect(list.length).toBe(MAX_REFUSALS)
    expect(list.at(-1)!.at).toBe(MAX_REFUSALS + 4)
  })
})
