// Engine tests for hooks/register.tsx: the plugin loads in the engine itself (`claude plugin test`)
// over the stubbed machine in world.ts.
import { describe, expect, test } from 'claude-code/testing'
import type { Board } from '../../hooks/state/board.ts'
import { CLOUD, OTHER, SHA, said, start, world } from './world.ts'

const PANE = { title: 'agile console', isFocused: true, bodyColumns: 120, placement: 'dock' } as never

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
        // git's own text of the file, which the reviewer's read must have printed (the stub tool prints "ok")
        [`git -C /repo show ${SHA}:src/a.ts`]: { stdout: 'ok\n' },
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

  test('a stored board from a past sprint: tickets the open sprints no longer return leave it', async ($, on) => {
    const old = { key: 'OLD-1', status: 'Done', category: 'done' }
    const w = world(on, {
      files: { 'AGENTS.md': `cloudId: ${CLOUD}` },
      jiraAllowed: true,
      stored: { '/repo:board': { tickets: { 'OLD-1': old }, order: ['OLD-1'], prs: {}, prOrder: [] } },
      jira: { issues: { nodes: [{ key: 'VC-1', fields: { summary: 's', status: { name: 'To Do', statusCategory: { key: 'new' } } } }], pageInfo: { hasNextPage: false } } },
      gh: { 'gh pr list': { stdout: '[]' }, 'gh run list --limit': { stdout: '[]' } },
    })
    await start($)
    await $.command.run({ command: 'agile-board', args: 'board' } as never)
    const order = () => (w.stored.get('/repo:board') as { order?: string[] } | undefined)?.order
    for (let i = 0; i < 50 && order()?.includes('OLD-1'); i++) await new Promise(r => setTimeout(r, 10))
    expect(String(w.mcp[0]!.jql)).not.toContain('OLD-1')
    expect(order()).toEqual(['VC-1'])
  })

  test('/agile-board reset run by anything but a person (the model, a plugin, a relay) clears nothing', async ($, on) => {
    const w = world(on, {
      stored: {
        '/repo:board': { tickets: { 'VC-1': { key: 'VC-1' } }, order: ['VC-1'], prs: {}, prOrder: [] },
        '/repo:receipts': [{ agent: 'agile-merge-review:pr-reviewer', at: 1, issues: ['preamble'] }],
      },
    })
    await start($)
    // the test kit's command carries no person's origin, as the model's or a plugin's would not
    expect(said(await $.command.run({ command: 'agile-board', args: 'reset' } as never))).toContain('run only by a person')
    expect((w.stored.get('/repo:board') as { order: string[] }).order).toEqual(['VC-1'])
    expect(said(await $.command.run({ command: 'receipts', args: 'all' } as never))).toContain('pr-reviewer')
  })

  test('a Jira page past the output limit is asked again at half the size', async ($, on) => {
    const ok = JSON.stringify({ issues: { nodes: [{ key: 'VC-1', fields: { summary: 's', status: { name: 'To Do', statusCategory: { key: 'new' } } } }], pageInfo: { hasNextPage: false } } })
    const w = world(on, {
      files: { 'AGENTS.md': `cloudId: ${CLOUD}` },
      jiraAllowed: true,
      jira: (args: Record<string, unknown>) => (Number(args.maxResults) > 12 ? 'Output too large for the tool result.' : ok),
      gh: { 'gh pr list': { stdout: '[]' }, 'gh run list --limit': { stdout: '[]' } },
    })
    await start($)
    await $.tool.call({ tool: 'mcp__atlassian__getJiraIssue', issueIdOrKey: 'VC-1', cloudId: CLOUD } as never)
    await $.command.run({ command: 'agile-board', args: 'board' } as never)
    for (let i = 0; i < 50 && w.mcp.length < 3; i++) await new Promise(r => setTimeout(r, 10))
    expect(w.mcp.slice(0, 3).map(c => c.maxResults)).toEqual([50, 25, 12])
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

  test('a fourth fix round pushing to a PR is refused: the PR from the branch, a round per reviewed head', async ($, on) => {
    const pr = { stdout: '' }
    const fixers = [1, 2, 3, 4].map(n => ({ id: `f${n}`, type: 'agile-merge-review:fix-until-satisfied' }))
    const w = world(on, { agents: [...fixers, { id: 'r1', type: 'agile-merge-review:pr-reviewer' }], gh: { 'gh pr list --head VC-7': pr, 'git -C /repo show': { stdout: 'ok\n' } } })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    const push = (agentId: string) => $.tool.call({ tool: 'Bash', command: 'git push origin VC-7', agentId } as never)
    const review = (head: string) => $.tool.call({ tool: 'Bash', command: `git show ${head}:src/a.ts`, agentId: 'r1' } as never)
    for (const n of [1, 2, 3]) {
      await review(String(n).repeat(40))
      pr.stdout = JSON.stringify([{ number: 7, headRefOid: String(n).repeat(40), baseRefName: 'main' }])
      expect(said(await push(`f${n}`))).toBe('ok')
    }
    // a push onto a head no review read continues the round
    pr.stdout = JSON.stringify([{ number: 7, headRefOid: '9'.repeat(40), baseRefName: 'main' }])
    expect(said(await push('f4'))).toBe('ok')
    await review('4'.repeat(40))
    pr.stdout = JSON.stringify([{ number: 7, headRefOid: '4'.repeat(40), baseRefName: 'main' }])
    expect(said(await push('f4'))).toContain('3 fix rounds already pushed')
    expect(w.ran).toContain('gh pr list --head VC-7 --state open --json number,headRefOid,baseRefName')
    expect(w.tools.filter(t => t.startsWith('git push'))).toHaveLength(4)
    // what a push adds is read against the PR head, less what the base already has
    expect(w.ran).toContain(`git -C /repo rev-list --no-merges ${'1'.repeat(40)}..VC-7 ^origin/main`)
    // a person allows one more round from the Guards tab
    const ui = await $.ui.mount({ plugin: 'agile-mods', surface: 'terminal', component: 'Pane', props: PANE, requestId: 'agile-console' })
    await ui.press({ key: 'tab-guards' })
    await ui.press({ key: (await ui.find({ type: 'Button', text: /Allow once/ }))!.key! })
    expect(said(await push('f4'))).toBe('ok')
  })

  test('a reviewer read that does not count is told at once, and a refused merge can be allowed once', async ($, on) => {
    const w = world(on, {
      agents: [{ id: 'r1', type: 'agile-merge-review:pr-reviewer' }],
      gh: { 'gh pr view 7': { stdout: JSON.stringify({ headRefOid: SHA, state: 'OPEN' }) } },
    })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    const r = await $.tool.call({ tool: 'Bash', command: `git show ${SHA.slice(0, 8)}:src/a.ts`, agentId: 'r1' } as never) as { context?: string[] }
    expect(r.context?.join('\n')).toContain('is not a commit in this repository')
    expect(w.ran).toContain(`git -C /repo rev-parse --verify --quiet ${SHA.slice(0, 8)}^{commit}`)
    const merge = () => $.tool.call({ tool: 'Bash', command: `gh pr merge 7 --squash --match-head-commit ${SHA}` } as never)
    expect(said(await merge())).toContain('A person can allow this once')
    expect(w.tools.filter(t => t.startsWith('gh pr merge'))).toHaveLength(0)
    // a command run by anything but the person (here a plugin) grants nothing, and resets nothing
    const byPlugin = await $.command.run({ command: 'agile-board', args: 'allow 1' } as never) as { text?: string }
    expect(byPlugin.text).toContain('run only by a person')
    const reset = await $.command.run({ command: 'agile-board', args: 'reset' } as never) as { text?: string }
    expect(reset.text).toContain('run only by a person')
    expect(said(await merge())).toContain('A person can allow this once')
    const ui = await $.ui.mount({ plugin: 'agile-mods', surface: 'terminal', component: 'Pane', props: PANE, requestId: 'agile-console' })
    await ui.press({ key: 'tab-guards' })
    expect(await ui.find({ text: /merge PR #7 at dddddd/ })).toBeDefined()
    await ui.press({ key: (await ui.find({ type: 'Button', text: /Allow once/ }))!.key! })
    expect(said(await merge())).toBe('ok')
    expect(said(await merge())).toContain('could not read CI')
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

describe('ticket cost through the engine', () => {
  test('a phase agent counts against the ticket its description names; a session agent follows the ticket its calls name', async ($, on) => {
    // 100 input, 900 cache read, 5 output at the opus price
    const one = (100 * 5 + 900 * 0.5 + 5 * 25) / 1e6
    const w = world(on, {
      agents: [
        { id: 'b1', type: 'agile-execution:build-implementer', description: 'implement VC-3' },
        { id: 's1', type: 'agile-sprint-drain:build-session', description: 'build VC-3 VC-4' },
      ],
      stored: { '/repo:board': { tickets: { 'VC-3': { key: 'VC-3' }, 'VC-4': { key: 'VC-4' } }, order: ['VC-3', 'VC-4'], prs: {}, prOrder: [] } },
    })
    await start($)
    // a drain would start a fresh board
    await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never)
    const step = async (agentId: string) => {
      const s = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, agentId })
      let n = await s.next()
      while (!n.done) n = await s.next()
    }
    await step('b1')
    // the session agent's first request names no ticket yet; the call it makes names VC-4
    await step('s1')
    await $.tool.call({ tool: 'mcp__atlassian__getJiraIssue', issueIdOrKey: 'VC-4', agentId: 's1' } as never)
    await step('s1')
    // the next request's call names VC-3: that request is VC-3's
    await $.tool.call({ tool: 'mcp__atlassian__getJiraIssue', issueIdOrKey: 'VC-3', agentId: 's1' } as never)
    await w.clock.advance(10_000)
    const b = w.stored.get('/repo:board') as Board
    const near = (x: number, y: number) => Math.abs(x - y) < 1e-9
    expect(near(b.tickets['VC-4']!.cost!.usd, one)).toBe(true)
    expect(near(b.tickets['VC-3']!.cost!.usd, 2 * one)).toBe(true)
    expect(near(b.tickets['VC-3']!.cost!.build, 2 * one)).toBe(true)
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
