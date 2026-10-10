import { describe, expect, test } from 'bun:test'
import { laneOf, noteCall, noteTokens } from '../../hooks/state/agents.ts'
import { applyJira, applyPrs, EMPTY, type Board } from '../../hooks/state/board.ts'
import { agingFlags, agingOf, cacheFlags, dayName, filesTargets, forecastOf, hitRate, overlapOf, percentile, rateOf, span, withFiles, withRun, withSpend, withTokens, withoutLedger } from '../../hooks/state/flow.ts'

const HOUR = 3_600_000
const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 10, 12)
const iso = (t: number) => new Date(t).toISOString()
const usage = (input: number, read: number, write: number) => ({ input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: 10 })

/** gh pr list rows: one merged PR a day for `days` days, each open `hours` hours. */
const mergedRows = (days: number, hours = 6, title = (d: number) => `VC-${d} fix`) =>
  Array.from({ length: days }, (_, d) => ({ number: 100 + d, title: title(d), state: 'MERGED', createdAt: iso(NOW - d * DAY - 1_000 - hours * HOUR), mergedAt: iso(NOW - d * DAY - 1_000) }))

describe('history from gh', () => {
  test('applyPrs keeps every merged PR of the list as history, on the board or not', () => {
    const b = applyPrs(EMPTY, [...mergedRows(3, 4), { number: 9, state: 'OPEN', createdAt: iso(NOW) }], NOW)
    expect(b.history!.merges).toHaveLength(3)
    expect(b.history!.cycles).toEqual([4 * HOUR, 4 * HOUR, 4 * HOUR])
    expect(b.prOrder).toEqual([9])
  })

  test('only PRs that name a ticket count as merges for the forecast; every one counts for aging', () => {
    const b = applyPrs(EMPTY, mergedRows(4, 2, d => (d % 2 ? `chore: bump deps ${d}` : `VC-${d} fix`)), NOW)
    expect(b.history!.merges).toHaveLength(2)
    expect(b.history!.cycles).toHaveLength(4)
  })

  test('applyJira keeps when a ticket entered its status category', () => {
    const answer = { issues: { nodes: [{ key: 'VC-1', fields: { status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } }, statuscategorychangedate: '2026-10-09T12:00:00.000+0000' } }] } }
    expect(applyJira(EMPTY, answer, 'customfield_10016', NOW).tickets['VC-1']!.since).toBe(NOW - DAY)
  })
})

describe('spend', () => {
  const run = withRun({ ...EMPTY, loop: 'drain' }, NOW - 2 * HOUR)

  test('counts the ledger only inside a run, from the first reading', () => {
    expect(withSpend(EMPTY, 5)).toBe(EMPTY)
    let b = withSpend(run, 5)
    expect(b.spend).toEqual({ usd: 0, since: NOW - 2 * HOUR, last: 5 })
    b = withSpend(b, 7.5)
    expect(b.spend!.usd).toBe(2.5)
    expect(withSpend(b, 7.5)).toBe(b)
  })

  test('a lower reading is a new session; a reload starts a new baseline; a new run starts from 0', () => {
    let b = withSpend(withSpend(run, 5), 6)
    b = withSpend(b, 0.5)
    expect(b.spend!.usd).toBe(1.5)
    b = withSpend(withoutLedger(b), 3)
    expect(b.spend).toEqual({ usd: 1.5, since: NOW - 2 * HOUR, last: 3 })
    expect(withRun(b, NOW).spend).toEqual({ usd: 0, since: NOW })
  })

  test('rate per hour since the run began, and per PR merged since', () => {
    const b: Board = { ...run, spend: { usd: 8, since: NOW - 2 * HOUR }, prOrder: [1, 2], prs: { 1: { number: 1, merged: true, mergedAt: NOW - HOUR }, 2: { number: 2, merged: true, mergedAt: NOW - 3 * HOUR } } }
    expect(rateOf(b, NOW)).toEqual({ spent: 8, merged: 1, perHour: 4, perPr: 8 })
    expect(rateOf({ ...b, spend: { usd: 8, since: NOW - 60_000 } }, NOW).perHour).toBeUndefined()
  })
})

describe('prompt cache', () => {
  const drain: Board = { ...EMPTY, loop: 'drain', drain: { pass: 2, outcome: 'running' }, passes: [{ start: 0, end: 1 }, { start: 1 }] }

  test('requests add up by stage, for the loop and the running pass', () => {
    const b = withTokens(withTokens(drain, 'build', usage(100, 800, 100)), 'build', usage(0, 1000, 0))
    expect(b.tokens!.build).toEqual({ input: 100, read: 1800, write: 100, output: 20 })
    expect(b.passes![1]!.tokens!.build!.read).toBe(1800)
    expect(b.passes![0]!.tokens).toBeUndefined()
    expect(hitRate(b.tokens!.build)).toBe(0.9)
  })

  test('a stage well under its rate in earlier passes is flagged; small counts are not', () => {
    const passes = [{ start: 0, end: 1, tokens: { build: { input: 0, read: 900_000, write: 100_000, output: 0 } } }, { start: 1, tokens: { build: { input: 0, read: 300_000, write: 200_000, output: 0 } } }]
    expect(cacheFlags({ ...drain, passes })).toEqual(['build cache 60% (usual 90%)'])
    const small = [passes[0]!, { start: 1, tokens: { build: { input: 0, read: 30, write: 20, output: 0 } } }]
    expect(cacheFlags({ ...drain, passes: small })).toEqual([])
  })
})

describe('aging', () => {
  const board = (cycles: number[]): Board => ({
    ...EMPTY,
    history: { merges: [], cycles },
    order: ['VC-1', 'VC-2', 'VC-3'],
    tickets: {
      'VC-1': { key: 'VC-1', category: 'indeterminate', since: NOW - 3 * HOUR, phase: 'implement' },
      'VC-2': { key: 'VC-2', category: 'indeterminate', since: NOW - HOUR, pr: 7 },
      'VC-3': { key: 'VC-3', category: 'indeterminate', since: NOW - HOUR, parked: 'needs-info' },
    },
    prOrder: [7],
    prs: { 7: { number: 7, key: 'VC-2', state: 'OPEN', createdAt: NOW - 30 * HOUR, step: '3b review' } },
  })

  test('open PRs and in-progress tickets without one, oldest first; parked work is left out', () => {
    const { items, p50 } = agingOf(board([]), NOW)
    expect(items.map(i => `${i.id} ${i.where} ${span(i.age)}`)).toEqual(['#7 VC-2 3b review 30h', 'VC-1 implement 3h'])
    expect(p50).toBeUndefined()
  })

  test('percentile lines from the repo history, and PRs past the 85th flagged', () => {
    const { p50, p85 } = agingOf(board([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(h => h * HOUR)), NOW)
    expect([p50, p85]).toEqual([5 * HOUR, 9 * HOUR])
    expect(agingFlags(board([1, 2, 3, 4, 5].map(h => h * HOUR)), NOW)).toEqual(['PR #7 open 30h (p85 5h)'])
    expect(percentile([], 0.5)).toBeUndefined()
  })
})

describe('forecast', () => {
  const board = (left: number, merges: number[]): Board => ({
    ...EMPTY,
    history: { merges, cycles: [] },
    order: Array.from({ length: left }, (_, i) => `VC-${i + 1}`),
    tickets: Object.fromEntries(Array.from({ length: left }, (_, i) => [`VC-${i + 1}`, { key: `VC-${i + 1}` }])),
  })
  const daily = (days: number, perDay: number) => Array.from({ length: days * perDay }, (_, i) => NOW - Math.floor(i / perDay) * DAY - 1_000)

  test('waits for ten days of merges', () => {
    expect(forecastOf(board(3, daily(5, 1)), NOW).reason).toBe('5 day(s) of merges, needs 10')
    expect(forecastOf(board(0, daily(20, 1)), NOW).reason).toBe('nothing left')
  })

  test('two merges a day, every day: six tickets take three days in every trial', () => {
    const f = forecastOf(board(6, daily(20, 2)), NOW)
    expect(f.days).toEqual({ p50: 3, p85: 3 })
    expect(f.hist![3]).toBe(1000)
  })

  test('the same board gives the same forecast', () => {
    const merges = [...daily(3, 1), NOW - 12 * DAY]
    const b = board(4, merges)
    expect(forecastOf(b, NOW)).toEqual(forecastOf(b, NOW))
    expect(forecastOf(b, NOW).days!.p85).toBeGreaterThanOrEqual(forecastOf(b, NOW).days!.p50)
  })

  test('day names', () => {
    expect(dayName(NOW, 0)).toBe('today')
    expect(dayName(Date.UTC(2026, 9, 10, 12), 2)).toBe(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(2026, 9, 12, 12)).getDay()]!)
    expect(dayName(NOW, 14)).toMatch(/^Oct 2\d$/)
  })
})

describe('overlap', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const C = 'c'.repeat(40)
  const open: Board = {
    ...EMPTY,
    prOrder: [1, 2, 3, 4],
    prs: {
      1: { number: 1, state: 'OPEN', head: A },
      2: { number: 2, state: 'OPEN', head: B },
      3: { number: 3, state: 'OPEN', head: C },
      4: { number: 4, state: 'MERGED', head: C },
    },
  }

  test('reads files for open PRs whose head changed since the last read', () => {
    expect(filesTargets(open, 5)).toEqual([{ pr: 1, head: A }, { pr: 2, head: B }, { pr: 3, head: C }])
    const read = withFiles(open, 1, A, ['x'])
    expect(filesTargets(read, 5).map(t => t.pr)).toEqual([2, 3])
    expect(filesTargets({ ...read, prs: { ...read.prs, 1: { ...read.prs[1]!, head: B } } }, 5).map(t => t.pr)).toEqual([1, 2, 3])
  })

  test('pairs on a shared file, and directories more than one PR touches', () => {
    let b = withFiles(open, 1, A, ['src/auth.ts', 'src/api.ts', 'README.md'])
    b = withFiles(b, 2, B, ['src/auth.ts', 'docs/a.md'])
    b = withFiles(b, 3, C, ['docs/b.md', 'README.md'])
    const { pairs, dirs } = overlapOf(b)
    expect(pairs).toEqual([{ a: 1, b: 2, files: ['src/auth.ts'] }, { a: 1, b: 3, files: ['README.md'] }])
    expect(dirs).toEqual([{ dir: 'src/', prs: [1, 2] }, { dir: '(root)', prs: [1, 3] }, { dir: 'docs/', prs: [2, 3] }])
  })

  test('files read at an older head are not compared', () => {
    const b = withFiles(withFiles(open, 1, A, ['x']), 2, A, ['x'])
    expect(overlapOf(b).pairs).toEqual([])
  })
})

describe('agents lane', () => {
  test('one row per loop agent from the engine list, with its calls and tokens', () => {
    let s = noteCall({}, 'a1', 'Bash', { command: 'gh run watch 4242 --exit-status' }, 1_000)
    s = noteTokens(s, 'a1', usage(100, 900, 0), 61_000)
    s = noteCall(s, 'x', 'Read', {}, 2_000)
    const lanes = laneOf([
      { id: 'a1', type: 'agile-sprint-drain:merge-session', status: 'running', description: 'merge PR #42' },
      { id: 'x', type: 'Explore', status: 'running' },
      { id: 'b1', type: 'agile-execution:build-implementer', status: 'completed', description: 'implement VC-7' },
    ], s, 181_000)
    expect(lanes.map(l => [l.name, l.work, l.status, l.age, l.idle, l.tokens, l.hit, l.wait])).toEqual([
      ['merge-session', 'PR #42', 'running', 180_000, 120_000, 1010, 0.9, 'run 4242'],
      ['build-implementer', 'VC-7', 'completed', 0, 0, 0, undefined, undefined],
    ])
  })

  test('a later call that is not a watch clears the wait', () => {
    const s = noteCall(noteCall({}, 'a1', 'Bash', { command: 'gh run watch 1' }, 0), 'a1', 'Read', {}, 1)
    expect(s.a1!.wait).toBeUndefined()
    expect(s.a1!.firstAt).toBe(0)
  })
})
