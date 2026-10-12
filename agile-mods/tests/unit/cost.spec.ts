import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { EMPTY, type Board } from '../../hooks/state/board.ts'
import { AGENT_MODEL, GAP, PRICES, isSession, median, modelOf, modelOfId, movedCost, rowsOf, summaryOf, ticketOfCall, ticketOfText, usdOf, withCost, withoutCosts } from '../../hooks/state/cost.ts'
import { withRun } from '../../hooks/state/flow.ts'

const ROOT = `${import.meta.dir}/../../..`
const u = (input: number, read = 0, write = 0, output = 0) => ({ input_tokens: input, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: output })
const board = (over: Partial<Board> = {}): Board => ({
  ...EMPTY,
  tickets: { 'VC-1': { key: 'VC-1' }, 'VC-2': { key: 'VC-2', pr: 7 } },
  order: ['VC-1', 'VC-2'],
  prs: { 7: { number: 7, key: 'VC-2' } },
  prOrder: [7],
  ...over,
})

describe('request dollars', () => {
  test('tokens at the model price; cache reads a tenth of input, cache writes 1.25 times', () => {
    expect(usdOf(u(1_000_000), 'opus')).toBeCloseTo(5)
    expect(usdOf(u(0, 0, 0, 1_000_000), 'sonnet')).toBeCloseTo(15)
    expect(usdOf(u(0, 1_000_000), 'opus')).toBeCloseTo(0.5)
    expect(usdOf(u(0, 0, 1_000_000), 'opus')).toBeCloseTo(6.25)
  })

  test('the model a request reports wins; an unknown id falls back to the agent file\'s', () => {
    expect(modelOfId('claude-opus-5-5')).toBe('opus')
    expect(modelOfId('claude-haiku-5-5')).toBe('haiku')
    expect(modelOfId('m')).toBeUndefined()
    expect(modelOf('agile-execution:build-implementer')).toBe('opus')
    expect(modelOf('general-purpose')).toBeUndefined()
    expect(isSession('agile-sprint-drain:build-session')).toBe(true)
    expect(isSession('agile-execution:build-implementer')).toBe(false)
  })

  test('the tables match the agent files and session-audit', async () => {
    const found: Record<string, string> = {}
    for await (const file of new Glob('*/agents/*.md').scan(ROOT)) {
      const head = (await Bun.file(`${ROOT}/${file}`).text()).split('---')[1]!
      found[head.match(/^name:\s*(\S+)/m)![1]!] = head.match(/^model:\s*(\S+)/m)![1]!
    }
    expect(AGENT_MODEL).toEqual(found as never)
    const py = await Bun.file(`${ROOT}/session-audit/skills/session-audit/scripts/session_usage.py`).text()
    const prices = [...py.match(/DEFAULT_PRICES = \{([^}]*)\}/)![1]!.matchAll(/"(\w+)": \(([\d.]+), ([\d.]+)\)/g)].map(m => [m[1], [Number(m[2]), Number(m[3])]])
    expect(PRICES).toEqual(Object.fromEntries(prices))
  })
})

describe('ticket cost', () => {
  test('adds to the ticket by stage, with working time, a wait over the gap left out', () => {
    let b = withCost(board(), 'VC-1', 0.5, 'build', 0, 100)
    b = withCost(b, 'VC-1', 0.25, 'merge', 60_000, 200)
    b = withCost(b, 'VC-1', 0.25, 'build', 3 * GAP, 300)
    expect(b.tickets['VC-1']!.cost).toEqual({ usd: 1, build: 0.75, merge: 0.25, ms: 60_000 + GAP, firstAt: 100 })
    // a ticket the board does not know is not invented
    expect(withCost(board(), 'VC-9', 1, 'build', 0, 0).tickets['VC-9']).toBeUndefined()
  })

  test('a request moves to the ticket its call named, and a new run starts every cost again', () => {
    let b = withCost(board(), 'VC-1', 1, 'build', 0, 0)
    b = movedCost(b, 'VC-1', 'VC-2', 0.4, 'build')
    expect(b.tickets['VC-1']!.cost!.usd).toBeCloseTo(0.6)
    expect(b.tickets['VC-2']!.cost!.usd).toBeCloseTo(0.4)
    expect(withRun(b, 5).tickets['VC-2']!.cost).toBeUndefined()
    expect(withoutCosts(board())).toEqual(board())
  })
})

describe('which ticket', () => {
  const b = board()
  test('a description or a call that names exactly one ticket the board knows', () => {
    expect(ticketOfText(b, 'implement VC-1')).toBe('VC-1')
    expect(ticketOfText(b, 'review PR #7')).toBe('VC-2')
    expect(ticketOfText(b, 'build VC-1 and VC-2')).toBeUndefined()
    expect(ticketOfText(b, 'UTF-8 OTHER-4')).toBeUndefined()
    expect(ticketOfCall(b, 'mcp__atlassian__getJiraIssue', { issueIdOrKey: 'VC-2' })).toBe('VC-2')
    expect(ticketOfCall(b, 'Bash', { command: 'gh pr view 7 --json state' })).toBe('VC-2')
    expect(ticketOfCall(b, 'Bash', { command: 'git log' })).toBeUndefined()
    expect(ticketOfCall(b, 'mcp__atlassian__searchJiraIssuesUsingJql', { jql: 'key in (VC-1, VC-2)' })).toBeUndefined()
  })
})

describe('the tab\'s numbers', () => {
  test('rows dearest first; median and cost per line over merged tickets; overhead is the ledger beyond them', () => {
    let b = board({ tickets: { 'VC-1': { key: 'VC-1', pr: 8, category: 'done' }, 'VC-2': { key: 'VC-2', pr: 7, since: 0 }, 'VC-3': { key: 'VC-3', pr: 9, category: 'done' } }, order: ['VC-1', 'VC-2', 'VC-3'], prs: { 7: { number: 7, key: 'VC-2', state: 'OPEN' }, 8: { number: 8, key: 'VC-1', merged: true, mergedAt: 4000, additions: 80, deletions: 20 }, 9: { number: 9, key: 'VC-3', merged: true, mergedAt: 6000, additions: 150, deletions: 50 } }, prOrder: [7, 8, 9] })
    b = withCost(b, 'VC-1', 2, 'build', 0, 1000)
    b = withCost(b, 'VC-2', 5, 'build', 0, 1000)
    b = withCost(b, 'VC-3', 6, 'merge', 0, 2000)
    const rows = rowsOf(b, 10_000)
    expect(rows.map(r => r.key)).toEqual(['VC-3', 'VC-2', 'VC-1'])
    expect(rows.find(r => r.key === 'VC-1')).toMatchObject({ lines: 100, merged: true, elapsed: 3000 })
    const s = summaryOf(rows, 15)
    expect(s).toMatchObject({ tickets: 13, overhead: 2, median: 4, merged: 2, mergedUsd: 8, drift: false })
    expect(s.perLine).toBeCloseTo(8 / 300)
    expect(summaryOf(rows, 12).drift).toBe(false)
    expect(summaryOf(rows, 10).drift).toBe(true)
    expect(median([])).toBeUndefined()
    expect(median([3, 1, 2])).toBe(2)
  })
})
