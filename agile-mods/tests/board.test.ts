import { describe, expect, test } from 'bun:test'
import { EMPTY, actionableOf, applyJira, markerTargets, nextPageOf, applyPrs, applyRuns, ciOf, cloudIdOf, jqlOf, judged, keysOf, laneRows, leftOf, loadBoard, movesOf, observeStart, parkedOf, pointsFieldOf, projectsOf, runsOf, sampled, stallsOf, stampCosts, withKeys, type Board } from '../hooks/state/board.ts'

const SHA = 'c'.repeat(40)
const T0 = Date.parse('2026-10-01T10:00:00Z')
const at = (min: number) => new Date(T0 + min * 60_000).toISOString()
const skill = (b: Board, name: string, now = T0, args = '') => observeStart(b, 'Skill', { skill: name, args }, now)
const FIELD = 'customfield_10016'
const issue = (key: string, over: { status?: string; category?: string; labels?: string[]; points?: number; phases?: string[] } = {}) => ({
  key,
  webUrl: `https://acme.atlassian.net/browse/${key}`,
  fields: {
    summary: `${key} work`,
    status: { name: over.status ?? 'To Do', statusCategory: { key: over.category ?? 'new' } },
    labels: over.labels ?? [],
    ...(over.points !== undefined && { [FIELD]: over.points }),
    comment: { comments: (over.phases ?? []).map(p => ({ body: `🤖 <!-- agile:phase=${p} --> x` })) },
  },
})

describe('dispatch facts', () => {
  test('orchestrator skills set the loop, stage and drain passes', () => {
    let b = skill(EMPTY, 'agile-sprint-drain:agile-sprint-drain')
    expect(b.drain).toEqual({ pass: 0, outcome: 'running' })
    b = skill(b, 'agile-execution:agile-10-implement', T0 + 1)
    b = skill(b, 'agile-merge-review:agile-11-merge-train', T0 + 2)
    b = skill(b, 'agile-execution:agile-10-implement', T0 + 3)
    expect(b.drain?.pass).toBe(2)
    expect(b.passes).toEqual([{ start: T0 + 1, merge: T0 + 2, end: T0 + 3 }, { start: T0 + 3 }])
    expect(b.since).toBe(T0)
  })

  test('a train step dispatched three times for one PR is a stall', () => {
    let b = EMPTY
    for (let i = 0; i < 3; i++) b = observeStart(b, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'review PR #42' })
    expect(b.prs[42]?.step).toBe('3b review')
    expect(stallsOf(b)).toEqual(['PR #42 3b review ×3'])
  })

  test('a merge command marks the step, by gh or any MCP server name', () => {
    expect(observeStart(EMPTY, 'Bash', { command: 'gh pr merge 9 --squash' }).prs[9]?.step).toBe('3f merge')
    expect(observeStart(EMPTY, 'mcp__gh__merge_pull_request', { pullNumber: 9 }).prs[9]?.step).toBe('3f merge')
  })

  test('Jira calls name the ticket keys the next sync reads', () => {
    expect(keysOf('mcp__atlassian__getJiraIssue', { issueIdOrKey: 'VC-4' })).toEqual(['VC-4'])
    expect(keysOf('mcp__x__searchJiraIssuesUsingJql', { jql: 'project = VC' })).toEqual([])
    expect(withKeys(EMPTY, ['VC-4']).order).toEqual(['VC-4'])
  })
})

describe('gh sync', () => {
  const rows = [
    { number: 1, title: 'old', state: 'MERGED', createdAt: at(-600), mergedAt: at(-500), url: 'https://github.com/o/r/pull/1' },
    { number: 5, title: 'VC-3: login', headRefName: 'feature/VC-3-login', headRefOid: SHA, state: 'OPEN', createdAt: at(5), url: 'https://github.com/o/r/pull/5' },
    { number: 6, title: 'VC-4 x', state: 'MERGED', createdAt: at(10), mergedAt: at(20), url: 'https://github.com/o/r/pull/6' },
  ]

  test('open PRs and PRs since the loop started land on their tickets; older history does not', () => {
    const b = applyPrs(skill(EMPTY, 'agile-10-implement'), rows, T0 + 1)
    expect(b.prOrder).toEqual([5, 6])
    expect(b.tickets['VC-3']?.pr).toBe(5)
    expect(b.prs[6]).toMatchObject({ merged: true, step: 'merged', mergedAt: T0 + 20 * 60_000 })
    expect(b.repo).toBe('https://github.com/o/r')
    expect(b.gh).toEqual({ at: T0 + 1 })
  })

  test('runs: the latest per workflow on each sha decides CI', () => {
    const b = applyRuns(EMPTY, [
      { databaseId: 1, headSha: SHA, status: 'completed', conclusion: 'failure', workflowName: 'ci', createdAt: at(1) },
      { databaseId: 2, headSha: SHA, status: 'completed', conclusion: 'success', workflowName: 'ci', createdAt: at(2) },
      { databaseId: 3, headSha: SHA, status: 'in_progress', workflowName: 'e2e', createdAt: at(2) },
      { databaseId: 4, headSha: 'short', status: 'completed' },
    ], 0)
    expect(runsOf(b, SHA.slice(0, 8))?.map(r => r.id)).toEqual([2, 3])
    expect(ciOf(runsOf(b, SHA))).toEqual({ state: 'pending', detail: 'e2e in_progress' })
    expect(ciOf([{ workflow: 'ci', status: 'completed', conclusion: 'skipped' }])).toEqual({ state: 'green' })
    expect(ciOf([{ workflow: 'ci', status: 'completed', conclusion: 'cancelled' }]).state).toBe('red')
    expect(ciOf(undefined).state).toBe('none')
  })

  test('PR lanes show the dispatched steps and CI on the head', () => {
    let b = applyPrs(EMPTY, rows.slice(1, 2), 0)
    b = observeStart(b, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'PR #5' })
    b = applyRuns(b, [{ databaseId: 9, headSha: SHA, status: 'completed', conclusion: 'failure', workflowName: 'ci' }], 0)
    expect(laneRows(b)).toEqual([{ pr: 5, key: 'VC-3', cells: ['todo', 'now', 'todo', 'fail', 'todo', 'todo'], ci: 'CI ✖ ci failure' }])
  })
})

describe('Jira sync', () => {
  test('status, points, phase markers, reworks and the needs-info park', () => {
    const answer = { issues: { nodes: [
      issue('VC-3', { status: 'In Progress', category: 'indeterminate', points: 3, phases: ['plan', 'rework', 'implement', 'rework'] }),
      issue('VC-9', { labels: ['needs-info'], points: 2 }),
    ] } }
    const b = applyJira(EMPTY, answer, FIELD, 7)
    expect(b.tickets['VC-3']).toMatchObject({ status: 'In Progress', category: 'indeterminate', phase: 'rework', reworks: 2, points: 3 })
    expect(parkedOf(b)).toEqual(['VC-9 Needs Info'])
    expect(b.site).toBe('https://acme.atlassian.net')
    expect(b.jira).toEqual({ at: 7 })
  })

  test('a sprint search without comments keeps the markers; comment reads rotate over the working tickets', () => {
    const noComment = (key: string, category: string) => ({ key, fields: { status: { name: 'S', statusCategory: { key: category } } } })
    let b = applyJira(EMPTY, { issues: [issue('VC-3', { category: 'indeterminate', phases: ['plan'] })] }, FIELD, 5)
    b = applyJira(b, { issues: [noComment('VC-3', 'indeterminate'), noComment('VC-4', 'new'), noComment('VC-5', 'done'), noComment('VC-6', 'indeterminate')] }, FIELD, 6)
    expect(b.tickets['VC-3']).toMatchObject({ phase: 'plan', reworks: 0, markedAt: 5, status: 'S' })
    b = withKeys(b, ['VC-4'])
    expect(markerTargets(b, 4)).toEqual(['VC-4', 'VC-6', 'VC-3'])
    expect(markerTargets(b, 1)).toEqual(['VC-4'])
  })

  test('the next page token, in either answer shape', () => {
    expect(nextPageOf({ issues: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'c1' } } })).toBe('c1')
    expect(nextPageOf({ issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: 'c1' } } })).toBeUndefined()
    expect(nextPageOf({ issues: [], nextPageToken: 't2' })).toBe('t2')
    expect(nextPageOf({ issues: [], nextPageToken: 't2', isLast: true })).toBeUndefined()
  })

  test('a key that is not only a key never reaches the JQL', () => {
    expect(keysOf('mcp__atlassian__getJiraIssue', { issueIdOrKey: 'VC-1) OR project = X' })).toEqual([])
  })

  test('the JQL covers the known projects open sprints and every known key', () => {
    expect(jqlOf(EMPTY)).toBeUndefined()
    const b = applyPrs(withKeys(EMPTY, ['VC-3']), [{ number: 2, title: 'OPS-1 fix', state: 'OPEN' }], 0)
    expect(projectsOf(b)).toEqual(['VC', 'OPS'])
    expect(jqlOf(b)).toBe('(project in (VC, OPS) AND sprint in openSprints()) OR key in (VC-3, OPS-1)')
  })

  test('config: the points field and cloudId from AGENTS.md text', () => {
    const config = '## Skill configuration\n- **`cloudId`**: `1a2b3c4d-1111-2222-3333-444455556666`\n- story-points-field: `customfield_10028`'
    expect(cloudIdOf(config)).toBe('1a2b3c4d-1111-2222-3333-444455556666')
    expect(cloudIdOf('cloudId: https://acme.atlassian.net')).toBe('https://acme.atlassian.net')
    expect(pointsFieldOf(config)).toBe('customfield_10028')
  })
})

describe('burndown and drain outcome', () => {
  const sprint = (left: string[], done: string[] = []) =>
    applyJira(EMPTY, { issues: [...left.map(k => issue(k, { points: 2 })), ...done.map(k => issue(k, { points: 3, status: 'Done', category: 'done' }))] }, FIELD, T0)

  test('work left counts Jira done and merged PRs as done, in points when every ticket has them', () => {
    let b = sprint(['VC-1', 'VC-2'], ['VC-3'])
    expect(leftOf(b)).toEqual({ left: 4, total: 7, unit: 'points' })
    b = applyPrs(b, [{ number: 8, title: 'VC-1', state: 'MERGED', mergedAt: at(1) }], T0)
    expect(leftOf(b).left).toBe(2)
    b = sampled(sampled(b, 1), 2)
    expect(b.burn).toEqual([{ at: 1, left: 2, total: 7 }])
  })

  test('DRAINED once Jira answered and nothing is actionable; never from answer text', () => {
    let b = skill(skill(sprint([], ['VC-3']), 'agile-sprint-drain'), 'agile-10-implement', T0)
    b = judged(b, T0 + 5, false)
    expect(b.drain?.outcome).toBe('DRAINED')
    expect(b.passes?.at(-1)?.end).toBe(T0 + 5)
    const open = applyPrs(skill(skill(sprint([], ['VC-3']), 'agile-sprint-drain'), 'agile-10-implement', T0), [{ number: 4, title: 'VC-3', state: 'OPEN' }], T0)
    expect(actionableOf(open)).toBe(1)
    expect(judged(open, T0 + 5, false).drain?.outcome).toBe('running')
  })

  test('STUCK when the session goes idle with work left and a pass that moved nothing; acting again resumes', () => {
    let b = skill(skill(sprint(['VC-1']), 'agile-sprint-drain'), 'agile-10-implement', T0)
    expect(judged(b, T0 + 9, false).drain?.outcome).toBe('running')
    b = judged(b, T0 + 9, true)
    expect(b.drain?.outcome).toBe('STUCK')
    expect(observeStart(b, 'Bash', { command: 'ls' }).drain?.outcome).toBe('running')
    const waiting = applyRuns(applyPrs(skill(skill(sprint(['VC-1']), 'agile-sprint-drain'), 'agile-10-implement', T0), [{ number: 3, title: 'VC-1', state: 'OPEN', headRefOid: SHA, createdAt: at(-5) }], T0), [{ databaseId: 1, headSha: SHA, status: 'in_progress', workflowName: 'ci' }], T0)
    expect(judged(waiting, T0 + 9, true).drain?.outcome).toBe('running')
    const moved = applyPrs(skill(skill(sprint(['VC-1']), 'agile-sprint-drain'), 'agile-10-implement', T0), [{ number: 3, title: 'VC-1', state: 'OPEN', createdAt: at(1) }], T0)
    expect(judged(moved, T0 + 120_000, true).drain?.outcome).toBe('running')
    expect(movesOf(moved, moved.passes!.at(-1)!, T0 + 120_000)).toEqual({ built: 1, merged: 0 })
  })

  test('costs are stamped once per pass boundary', () => {
    let b: Board = { ...EMPTY, passes: [{ start: 0, end: 5 }, { start: 5 }] }
    b = stampCosts(b, 2)
    expect(b.passes).toEqual([{ start: 0, end: 5, cost0: 2, cost1: 2 }, { start: 5, cost0: 2 }])
    expect(stampCosts(b, 3)).toBe(b)
  })

  test('a stored board from an older version loads', () => {
    expect(loadBoard({ order: ['VC-1'], tickets: { 'VC-1': { key: 'VC-1' } } })?.prs).toEqual({})
    expect(loadBoard({ nope: 1 })).toBeUndefined()
  })
})
