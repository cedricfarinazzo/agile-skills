// Engine tests for hooks/register.tsx: the plugin loads in the engine itself (`claude plugin test`)
// over the stubbed machine in world.ts.
import { describe, expect, test } from 'claude-code/testing'
import type { Board } from '../../hooks/state/board.ts'
import { CLOUD, OTHER, SHA, said, start, world } from './world.ts'

describe('merge guard through the engine', () => {
  test('a train merge with a wrong pin is refused from the live head, and never reaches the tool', async ($, on) => {
    const w = world(on, { gh: { 'gh pr view 7': { stdout: JSON.stringify({ headRefOid: SHA, state: 'OPEN' }) } } })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-merge-review:agile-11-merge-train' } as never)
    const r = await $.tool.call({ tool: 'Bash', command: `gh pr merge 7 --squash --match-head-commit ${OTHER}` } as never)
    expect(said(r)).toContain('is not the PR head')
    expect(w.ran).toContain('gh pr view 7 --json headRefOid,state')
    expect(w.tools.some(t => t.startsWith('gh pr merge'))).toBe(false)
  })

  test('a merge passes once CI is green and the reviewer read every file at the head', async ($, on) => {
    const w = world(on, {
      agents: [{ id: 'r1', type: 'agile-merge-review:pr-reviewer' }],
      gh: {
        'gh pr view 7': { stdout: JSON.stringify({ headRefOid: SHA, state: 'OPEN' }) },
        [`gh run list --commit ${SHA}`]: { stdout: JSON.stringify([{ databaseId: 3, headSha: SHA, status: 'completed', conclusion: 'success', workflowName: 'ci' }]) },
        'gh api --paginate repos/{owner}/{repo}/pulls/7/files': { stdout: 'src/a.ts\n' },
      },
    })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    const merge = { tool: 'Bash', command: `gh pr merge 7 --squash --match-head-commit ${SHA}` } as never
    expect(said(await $.tool.call(merge))).toContain('no review read 1 file(s)')
    await $.tool.call({ tool: 'Bash', command: `git show ${SHA}:src/a.ts`, agentId: 'r1' } as never)
    const r = await $.tool.call(merge)
    expect(said(r)).toBe('ok')
    expect(w.tools.filter(t => t.startsWith('gh pr merge'))).toHaveLength(1)
  })

  test('when gh fails, the merge is refused', async ($, on) => {
    world(on)
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    const r = await $.tool.call({ tool: 'Bash', command: `gh pr merge 7 --squash --match-head-commit ${SHA}` } as never)
    expect(said(r)).toContain('could not read the PR')
  })

  test('a push to main from a checkout of it is refused inside a loop', async ($, on) => {
    const w = world(on, { gh: { 'git -C /repo rev-parse': { stdout: 'main\n' } } })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never)
    const r = await $.tool.call({ tool: 'Bash', command: 'git push' } as never)
    expect(said(r)).toContain('never pushes to main')
    expect(w.ran).toContain('git -C /repo rev-parse --abbrev-ref HEAD')
  })
})

describe('board sources through the engine', () => {
  test('the Jira search is not made while the session has not allowed it', async ($, on) => {
    const w = world(on, { files: { 'AGENTS.md': `cloudId: ${CLOUD}` }, jiraAllowed: false })
    await start($)
    await $.tool.call({ tool: 'mcp__atlassian__getJiraIssue', issueIdOrKey: 'VC-1', cloudId: CLOUD } as never)
    await $.command.run({ command: 'agile-board', args: 'board' } as never)
    expect(w.mcp).toHaveLength(0)
  })

  test('/agile-board reads gh and, when allowed, the sprint from Jira with the configured cloudId', async ($, on) => {
    const w = world(on, {
      files: { 'AGENTS.md': `## Skill configuration\n- cloudId: ${CLOUD}` },
      jiraAllowed: true,
      jira: { issues: { nodes: [{ key: 'VC-1', fields: { summary: 's', status: { name: 'To Do', statusCategory: { key: 'new' } } } }], pageInfo: { hasNextPage: false } } },
      gh: { 'gh pr list': { stdout: '[]' }, 'gh run list --limit': { stdout: '[]' } },
    })
    await start($)
    await $.tool.call({ tool: 'mcp__atlassian__getJiraIssue', issueIdOrKey: 'VC-1', cloudId: CLOUD } as never)
    await $.command.run({ command: 'agile-board', args: 'board' } as never)
    // the command starts the refresh without waiting for it; the clock moves only when the test advances it
    for (let i = 0; i < 50 && !w.mcp.length; i++) await new Promise(r => setTimeout(r, 10))
    expect(w.ran.some(l => l.startsWith('gh pr list --state all'))).toBe(true)
    expect(w.mcp[0]).toMatchObject({ tool: 'searchJiraIssuesUsingJql', cloudId: CLOUD, maxResults: 50 })
    expect(String(w.mcp[0]!.jql)).toContain('key in (VC-1)')
  })
})

describe('loop limits through the engine', () => {
  test('past budgetUsd, a new implement run is refused and the merge train goes on', { options: { budgetUsd: 5 } }, async ($, on) => {
    const usd = { now: 1 }
    world(on, { usd })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    // the first reading is the baseline
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never))).toBe('ok')
    usd.now = 7
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never))).toMatch(/^agile-mods: budget: the loop spent \$6\.00 of its \$5\.00 budget/)
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never))).toBe('ok')
  })

  test('inside a running drain, re-invoking a skill never resets the budget; a session agent is refused too', { options: { budgetUsd: 5 } }, async ($, on) => {
    const usd = { now: 1 }
    world(on, { usd })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    usd.now = 7
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never))).toContain('budget')
    expect(said(await $.tool.call({ tool: 'Agent', subagent_type: 'agile-sprint-drain:build-session', description: 'build' } as never))).toContain('budget')
  })

  test('no budget set: nothing is refused for spend', async ($, on) => {
    const usd = { now: 1 }
    world(on, { usd })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    usd.now = 500
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never))).toBe('ok')
  })

  test('a fourth fix round pushing to a PR is refused: the PR from the branch, the round from the agent', async ($, on) => {
    const pr = { stdout: '' }
    const fixers = [1, 2, 3, 4].map(n => ({ id: `f${n}`, type: 'agile-merge-review:fix-until-satisfied' }))
    const w = world(on, { agents: fixers, gh: { 'gh pr list --head VC-7': pr } })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    const push = (agentId: string) => $.tool.call({ tool: 'Bash', command: 'git push origin VC-7', agentId } as never)
    for (const n of [1, 2, 3]) {
      pr.stdout = JSON.stringify([{ number: 7, headRefOid: String(n).repeat(40), baseRefName: 'main' }])
      expect(said(await push(`f${n}`))).toBe('ok')
    }
    pr.stdout = JSON.stringify([{ number: 7, headRefOid: '4'.repeat(40), baseRefName: 'main' }])
    expect(said(await push('f4'))).toContain('3 fix rounds already pushed')
    expect(w.ran).toContain('gh pr list --head VC-7 --state open --json number,headRefOid,baseRefName')
    expect(w.tools.filter(t => t.startsWith('git push'))).toHaveLength(3)
    // what a push adds is read against the PR head, less what the base already has
    expect(w.ran).toContain(`git -C /repo rev-list --no-merges ${'1'.repeat(40)}..VC-7 ^origin/main`)
  })

  test('/agile-board reads the files of each open PR once per head, for the overlap map', async ($, on) => {
    const w = world(on, {
      gh: {
        'gh pr list': { stdout: JSON.stringify([{ number: 7, title: 'VC-1 x', headRefName: 'VC-1', headRefOid: SHA, state: 'OPEN', createdAt: '2026-10-01T00:00:00Z', url: 'https://github.com/o/r/pull/7' }]) },
        'gh run list --limit': { stdout: '[]' },
        'gh api --paginate repos/{owner}/{repo}/pulls/7/files': { stdout: 'src/a.ts\n' },
      },
    })
    await start($)
    await $.command.run({ command: 'agile-board', args: 'wip' } as never)
    const files = () => w.ran.filter(l => l.includes('pulls/7/files')).length
    for (let i = 0; i < 50 && !files(); i++) await new Promise(r => setTimeout(r, 10))
    expect(files()).toBe(1)
    await $.command.run({ command: 'agile-board', args: 'wip' } as never)
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 10))
    expect(files()).toBe(1)
  })
})

describe('usage through the engine', () => {
  test('each model request in a drain counts toward its stage: the main loop by the board, an agent by its type', async ($, on) => {
    const w = world(on, { agents: [{ id: 'm1', type: 'agile-merge-review:pr-reviewer' }] })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never)
    const step = async (agentId?: string) => {
      const s = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, ...(agentId && { agentId }) })
      // the stream's return value is the step's result
      let n = await s.next()
      while (!n.done) n = await s.next()
      return n.value
    }
    expect((await step()).usage?.input_tokens).toBe(100)
    await step('m1')
    await step('m1')
    // counted in memory, written within 10 s
    await w.clock.advance(10_000)
    const board = w.stored.get('/repo:board') as Board
    expect(board.tokens).toEqual({ build: { input: 100, read: 900, write: 0, output: 5 }, merge: { input: 200, read: 1800, write: 0, output: 10 } })
    expect(board.passes!.at(-1)!.tokens!.merge!.read).toBe(1800)
  })
})

describe('refresh through the engine', () => {
  test('the loop\'s own calls refresh the board 3 s later, at most every 10 s, and the timer waits 5 minutes', async ($, on) => {
    const w = world(on, { gh: { 'gh pr list': { stdout: '[]' }, 'gh run list --limit': { stdout: '[]' } } })
    const lists = () => w.ran.filter(l => l.startsWith('gh pr list')).length
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    expect(lists()).toBe(0)
    await w.clock.advance(3_000)
    expect(lists()).toBe(1)
    // a dispatch 3 s later lands inside the gap
    await $.tool.call({ tool: 'Agent', subagent_type: 'agile-execution:ticket-validator', description: 'VC-1' } as never)
    await w.clock.advance(3_000)
    expect(lists()).toBe(1)
    await w.clock.advance(5_000)
    await $.tool.call({ tool: 'Agent', subagent_type: 'agile-execution:ticket-planner', description: 'VC-1' } as never)
    await w.clock.advance(3_000)
    expect(lists()).toBe(2)
    // no event: only the 5-minute fallback reads gh again
    await w.clock.advance(240_000)
    expect(lists()).toBe(2)
    await w.clock.advance(75_000)
    expect(lists()).toBe(3)
  })
})
