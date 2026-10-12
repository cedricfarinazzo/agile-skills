import { describe, expect, test } from 'bun:test'
import { EMPTY, applyJira } from '../../hooks/state/board.ts'
import { dotsDone, liveOf, phaseOf, STALE_MS } from '../../hooks/state/phase.ts'

const NOW = 10_000_000
const t = (over: Record<string, unknown> = {}) => ({ key: 'VC-1', ...over }) as never

describe('phaseOf', () => {
  test('a marker is the phase just finished: the ticket is in the one after it', () => {
    const next = (phase?: string, over = {}) => phaseOf(t({ phase, markedAt: NOW, ...over }), undefined, NOW).now
    expect(next(undefined)).toBe('validate')
    expect(next('validate')).toBe('plan')
    expect(next('plan')).toBe('implement')
    expect(next('implement')).toBe('pr')
    expect(next('pr')).toBe('review')
    expect(next('review')).toBe('handoff')
    expect(next('status_change')).toBe('monitor')
    expect(next('rework')).toBe('monitor')
    expect(next('post_merge')).toBe('done')
  })

  test('a marker this version does not know is shown as it is, with no dot running', () => {
    const p = phaseOf(t({ phase: 'archive', category: 'indeterminate', markedAt: NOW }), undefined, NOW)
    expect(p).toMatchObject({ now: 'unknown', done: 'archive' })
    expect(dotsDone(p)).toBe(-1)
  })

  test('a ticket not started has no phase yet', () => {
    const p = phaseOf(t({ category: 'new' }), undefined, NOW)
    expect(p.now).toBe('queued')
    expect(dotsDone(p)).toBe(-1)
    expect(phaseOf(t({ category: 'indeterminate' }), undefined, NOW).now).toBe('validate')
  })

  test('the fix pass: implement after a PR exists is re-reviewed, and changes requested sends review back', () => {
    expect(phaseOf(t({ phase: 'implement', marks: ['validate', 'plan', 'pr', 'review', 'implement'], markedAt: NOW }), undefined, NOW).now).toBe('review')
    expect(phaseOf(t({ phase: 'review', review: 'changes', markedAt: NOW }), undefined, NOW).now).toBe('implement')
    expect(phaseOf(t({ phase: 'review', review: 'approved', markedAt: NOW }), undefined, NOW).now).toBe('handoff')
  })

  test('a running agent outranks the marker; an old marker with no agent is marked stale', () => {
    const p = phaseOf(t({ phase: 'plan', markAt: NOW - 2 * STALE_MS }), 'implement', NOW)
    expect(p).toMatchObject({ now: 'implement', done: 'plan', source: 'agent', stale: false })
    expect(phaseOf(t({ phase: 'plan', markAt: NOW - 2 * STALE_MS }), undefined, NOW).stale).toBe(true)
    expect(phaseOf(t({ phase: 'plan', markAt: NOW - 1000 }), undefined, NOW).stale).toBe(false)
    // read just now, posted long ago: the comment's own age counts, not the poll's
    expect(phaseOf(t({ phase: 'plan', markedAt: NOW, markAt: NOW - 2 * STALE_MS }), undefined, NOW).stale).toBe(true)
    // no comment time known: not flagged
    expect(phaseOf(t({ phase: 'plan', markedAt: NOW - 5 * STALE_MS }), undefined, NOW).stale).toBe(false)
  })

  test('dots: the running phase is the first unfinished one', () => {
    expect(dotsDone(phaseOf(t({ phase: 'plan', markedAt: NOW }), undefined, NOW))).toBe(2)
    expect(dotsDone(phaseOf(t({}), undefined, NOW))).toBe(0)
    expect(dotsDone(phaseOf(t({ phase: 'review', markedAt: NOW }), undefined, NOW))).toBe(5)
  })
})

describe('liveOf', () => {
  const board = { ...EMPTY, prs: { 42: { number: 42, key: 'VC-7' } } } as never
  test('running build agents by the ticket their description names, or the PR it names; ended and merge-side agents are left out', () => {
    expect(
      liveOf(
        [
          { type: 'agile-execution:build-implementer', status: 'running', description: 'VC-3 implement' },
          { type: 'agile-execution:self-reviewer', description: 'review PR #42' },
          { type: 'agile-execution:ticket-planner', status: 'completed', description: 'VC-9 plan' },
          { type: 'agile-merge-review:pr-reviewer', status: 'running', description: 'VC-5' },
          { type: 'agile-sprint-drain:build-session', status: 'running', description: 'VC-1, VC-2' },
        ],
        board,
      ),
    ).toEqual({ 'VC-3': 'implement', 'VC-7': 'review' })
  })
})

describe('markers and the review label', () => {
  const FIELD = 'customfield_10016'
  const issue = (labels?: string[], phases: string[] = ['plan', 'pr', 'review']) => ({
    key: 'VC-1',
    fields: { status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } }, ...(labels && { labels }), comment: { comments: phases.map(p => ({ body: `🤖 <!-- agile:phase=${p} --> x` })) } },
  })
  test('marks are kept once each; the review label is read when labels are, and cleared when they carry none', () => {
    // the marker's own time is the comment's `created`
    const dated = { key: 'VC-1', fields: { status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } }, comment: { comments: [{ created: '2026-10-12T10:00:00.000+0000', body: 'noted' }, { created: '2026-10-12T11:00:00.000+0000', body: '🤖 <!-- agile:phase=plan --> x' }] } } }
    expect(applyJira(EMPTY, { issues: [dated] }, FIELD, 5).tickets['VC-1']).toMatchObject({ phase: 'plan', markedAt: 5, markAt: Date.parse('2026-10-12T11:00:00.000+0000') })
    let b = applyJira(EMPTY, { issues: [issue(['dev-review-changes-requested'], ['plan', 'pr', 'review', 'implement', 'review'])] }, FIELD, 1)
    expect(b.tickets['VC-1']).toMatchObject({ phase: 'review', marks: ['plan', 'pr', 'review', 'implement'], review: 'changes' })
    // a comment-only search has no labels: the verdict stays
    b = applyJira(b, { issues: [{ key: 'VC-1', fields: { comment: { comments: [] } } }] }, FIELD, 2)
    expect(b.tickets['VC-1']!.review).toBe('changes')
    b = applyJira(b, { issues: [issue([])] }, FIELD, 3)
    expect(b.tickets['VC-1']!.review).toBeUndefined()
  })
})
