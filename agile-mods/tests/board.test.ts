import { describe, expect, test } from 'bun:test'
import { EMPTY, buildLines, burnLine, drainLine, laneRows, loadBoard, mergeLines, observeAnswer, observeStart, observeTool, parkedOf, passRows, runOf, sampled, stallsOf, type Board } from '../hooks/state/board.ts'

const comment = (key: string, phase: string) => ({ issueIdOrKey: key, commentBody: `🤖 <!-- agile:phase=${phase} --> **Plan**` })
const skill = (b: Board, name: string, args = '') => observeStart(b, 'Skill', { skill: name, args })
const bash = (b: Board, command: string, text: string) => observeTool(observeStart(b, 'Bash', { command }), 'Bash', { command }, text)
const LIST = 'gh pr list --state open --json number,title,headRefName,mergeable --limit 50'

describe('build queue', () => {
  test('a Jira marker comment sets the ticket phase, the latest wins', () => {
    let b = observeTool(EMPTY, 'mcp__atlassian__addCommentToJiraIssue', comment('VC-1', 'plan'), 'ok')
    b = observeTool(b, 'mcp__atlassian__addCommentToJiraIssue', comment('VC-1', 'implement'), 'ok')
    expect(b.order).toEqual(['VC-1'])
    expect(b.tickets['VC-1']?.phase).toBe('implement')
  })

  test('a failed comment call changes nothing', () => {
    expect(observeTool(EMPTY, 'mcp__atlassian__addCommentToJiraIssue', comment('VC-1', 'plan'), undefined)).toBe(EMPTY)
  })

  test('a PR created by gh or MCP lands on its ticket and in the merge queue', () => {
    let b = bash(EMPTY, 'gh pr create --title "VC-7: login" --head vc-7', 'https://github.com/o/r/pull/42\n')
    b = observeTool(b, 'mcp__github__create_pull_request', { head: 'feat/VC-9-x', title: 'x' }, '{"html_url":"https://github.com/o/r/pull/5"}')
    expect(b.tickets['VC-7']?.pr).toBe(42)
    expect(b.prs[5]).toEqual({ number: 5, key: 'VC-9' })
  })

  test('ticket lines keep the newest rows and drop merged tickets', () => {
    let b = EMPTY
    for (const k of ['AB-1', 'AB-2', 'AB-3']) b = observeTool(b, 'mcp__atlassian__addCommentToJiraIssue', comment(k, 'pr'), 'ok')
    expect(buildLines(b, 2).map(l => l.split(' ')[0])).toEqual(['AB-2', 'AB-3'])
    expect(buildLines(b, 0)).toEqual([])
    expect(mergeLines(b, 0)).toEqual([])
    b = observeTool(b, 'mcp__github__create_pull_request', { head: 'AB-3', title: '' }, '/pull/9')
    b = observeTool(b, 'mcp__github__merge_pull_request', { pullNumber: 9 }, 'merged')
    expect(buildLines(b, 5).map(l => l.split(' ')[0])).toEqual(['AB-1', 'AB-2'])
  })
})

describe('merge queue', () => {
  test('the train listing fills the queue with keys from branch or title', () => {
    const b = bash(EMPTY, LIST, JSON.stringify([
      { number: 11, title: 'Login form', headRefName: 'feat/VC-3-login' },
      { number: 12, title: 'VC-4 fix header', headRefName: 'fix-header' },
      { number: 13, title: 'chore', headRefName: 'chore' },
    ]))
    expect(mergeLines(b, 5)).toEqual(['#11     VC-3       queued', '#12     VC-4       queued', '#13                queued'])
  })

  test('step dispatches label the PR, by agent or by inline sub-skill', () => {
    let b = bash(EMPTY, LIST, '[{"number":11,"title":"","headRefName":"VC-3"}]')
    b = observeStart(b, 'Agent', { subagent_type: 'agile-merge-review:pr-updater', description: 'update PR #11', prompt: '' })
    expect(b.prs[11]?.step).toBe('3a update')
    b = skill(b, 'agile-merge-review:merge-review-pr', 'PR 11')
    expect(b.prs[11]?.step).toBe('3b review')
    b = observeStart(b, 'Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied', description: 'fix', prompt: 'https://github.com/o/r/pull/11' })
    expect(b.prs[11]?.step).toBe('3c fix')
  })

  test('gh pr merge alone is not a merge: only a view with mergedAt is', () => {
    let b = bash(EMPTY, LIST, '[{"number":11,"title":"","headRefName":"VC-3"}]')
    b = bash(b, 'gh pr merge 11 --squash', '')
    expect(b.prs[11]).toEqual({ number: 11, key: 'VC-3', step: '3f merge' })
    b = bash(b, 'gh pr view 11 --json state,mergedAt', '{"state":"OPEN","mergedAt":null}')
    expect(b.prs[11]?.merged).toBeUndefined()
    b = bash(b, 'gh pr view 11 --json state,mergedAt', '{"state":"MERGED","mergedAt":"2026-09-14T10:00:00Z"}')
    expect(mergeLines(b, 5)).toEqual(['#11     VC-3       merged'])
  })

  test('a merged listing closes known PRs and adds no history', () => {
    let b = bash(EMPTY, LIST, '[{"number":11,"title":"","headRefName":"VC-3"}]')
    b = bash(b, 'gh pr list --state merged --limit 50 --json number,headRefName', '[{"number":11},{"number":2}]')
    expect(b.prOrder).toEqual([11])
    expect(b.prs[11]?.merged).toBe(true)
  })

  test('open PRs sort before merged ones', () => {
    let b = bash(EMPTY, LIST, '[{"number":1},{"number":2}]')
    b = observeTool(b, 'mcp__github__merge_pull_request', { pullNumber: 1 }, 'ok')
    expect(mergeLines(b, 5).map(l => l.split(' ')[0])).toEqual(['#2', '#1'])
  })
})

describe('drain', () => {
  test('counts a pass per implement run, shows the stage, ends on its banner', () => {
    let b = skill(EMPTY, 'agile-sprint-drain:agile-sprint-drain')
    b = skill(b, 'agile-execution:agile-10-implement')
    expect(drainLine(b)).toBe('drain · pass 1 · build · running')
    b = skill(b, 'agile-merge-review:agile-11-merge-train')
    expect(drainLine(b)).toBe('drain · pass 1 · merge · running')
    b = skill(b, 'agile-execution:agile-10-implement')
    expect(b.loop).toBe('drain')
    expect(drainLine(b)).toBe('drain · pass 2 · build · running')
    b = observeAnswer(b, '══ STUCK ══  2 remaining')
    expect(drainLine(b)).toBe('drain · pass 2 · STUCK')
  })

  test('outside a drain the orchestrators set their own loop and no banner applies', () => {
    const b = skill(EMPTY, 'agile-merge-review:agile-11-merge-train')
    expect([b.loop, b.stage]).toEqual(['merge-train', 'merge'])
    expect(observeAnswer(b, '══ DRAINED ══')).toBe(b)
  })

  test('a board stored before the merge queue existed still loads', () => {
    expect(loadBoard({ tickets: {}, order: [] })).toEqual(EMPTY)
    expect(loadBoard(null)).toBeUndefined()
  })
})

const SHA = 'c'.repeat(40)

describe('reviewed sha and CI', () => {
  test('a pr-reviewer receipt and an inline review answer record the reviewed sha', () => {
    let b = observeTool(EMPTY, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'review PR #4' }, `Reviewed sha: ${SHA}`)
    expect(b.prs[4]?.reviewed).toBe(SHA)
    b = observeAnswer(EMPTY, `## PR #5 Review\n\nReviewed sha: ${SHA}`, 0, 5)
    expect(b.prs[5]?.reviewed).toBe(SHA)
  })

  test('gh run view with headSha records the run; two agreeing reads count', () => {
    const view = `gh run view 7 --json status,conclusion,headSha`
    let b = bash(EMPTY, view, JSON.stringify({ status: 'completed', conclusion: 'success', headSha: SHA }))
    expect(runOf(b, SHA)).toEqual({ status: 'completed', conclusion: 'success', reads: 1 })
    b = bash(b, view, JSON.stringify({ status: 'completed', conclusion: 'success', headSha: SHA }))
    expect(runOf(b, SHA.slice(0, 7))?.reads).toBe(2)
    b = bash(b, 'gh run view 7 --json status,conclusion', '{"status":"completed","conclusion":"success"}')
    expect(runOf(b, SHA)?.reads).toBe(2)
  })
})

describe('parked and stalls', () => {
  test('a validator verdict parks the ticket', () => {
    let b = observeTool(EMPTY, 'Agent', { subagent_type: 'agile-execution:ticket-validator', prompt: 'validate VC-2' }, 'verdict: rejected')
    b = observeTool(b, 'Agent', { subagent_type: 'agile-execution:ticket-validator', prompt: 'validate VC-3' }, 'verdict: critical-park')
    expect(parkedOf(b)).toEqual(['VC-2 Needs Info', 'VC-3 awaiting decision'])
    expect(buildLines(b, 5)[0]).toContain('needs info')
  })

  test('a step started three times for one PR is a stall', () => {
    let b = EMPTY
    for (let i = 0; i < 3; i++) b = skill(b, 'agile-merge-review:merge-review-pr', 'PR 9')
    expect(stallsOf(b)).toEqual(['PR #9 3b review ×3'])
    expect(mergeLines(b, 5)[0]).toContain('⟳3b×3')
  })
})

describe('burndown, swimlanes, drain timeline', () => {
  test('samples tickets left only on change, draws a sparkline', () => {
    let b = EMPTY
    for (const k of ['AB-1', 'AB-2']) b = sampled(observeTool(b, 'mcp__atlassian__addCommentToJiraIssue', comment(k, 'pr'), 'ok'), 1)
    b = sampled(b, 2)
    expect(b.burn?.length).toBe(2)
    b = observeTool(b, 'mcp__github__create_pull_request', { head: 'AB-1', title: '' }, '/pull/3')
    b = sampled(observeTool(b, 'mcp__github__merge_pull_request', { pullNumber: 3 }, 'ok'), 3)
    expect(burnLine(b)).toMatch(/^burn \S{3}  1\/2 tickets left$/)
  })

  test('a swimlane row marks reached steps and the CI state of the head', () => {
    let b = skill(EMPTY, 'agile-merge-review:merge-update-pr', 'PR 4')
    b = skill(b, 'agile-merge-review:merge-review-pr', 'PR 4')
    b = bash(b, 'gh pr view 4 --json headRefOid', JSON.stringify({ headRefOid: SHA }))
    b = bash(b, 'gh run list --branch x -L1 --json databaseId,status,conclusion,headSha', JSON.stringify([{ databaseId: 1, status: 'completed', conclusion: 'failure', headSha: SHA }]))
    const [row] = laneRows(b)
    expect(row?.cells).toEqual(['done', 'now', 'todo', 'fail', 'todo', 'todo'])
    expect(row?.ci).toBe('CI ✖ failure')
  })

  test('each drain pass records build and merge time and what it moved', () => {
    let b = observeStart(EMPTY, 'Skill', { skill: 'agile-sprint-drain' }, 0)
    b = observeStart(b, 'Skill', { skill: 'agile-10-implement' }, 0)
    b = observeTool(b, 'mcp__github__create_pull_request', { head: 'AB-1', title: '' }, '/pull/3')
    b = observeStart(b, 'Skill', { skill: 'agile-11-merge-train' }, 60_000)
    b = observeTool(b, 'mcp__github__merge_pull_request', { pullNumber: 3 }, 'ok')
    b = observeStart(b, 'Skill', { skill: 'agile-10-implement' }, 120_000)
    b = observeAnswer(b, '══ DRAINED ══', 180_000)
    const rows = passRows(b, 180_000, 10)
    expect(rows.map(r => [r.build, r.merge, r.text])).toEqual([[5, 5, 'build 1 → merge 1 · 2 min'], [5, 0, 'nothing moved · 1 min']])
  })
})
