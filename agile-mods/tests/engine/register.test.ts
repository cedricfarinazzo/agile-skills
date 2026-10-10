// Engine tests for hooks/register.tsx: the plugin loads in the engine itself (`claude plugin test`),
// and the hooks below stand for the machine beneath it: gh and git (`process.run`), the Atlassian
// MCP server (`tool.list`, `tool.check`, `mcp.call`), the repo files, the store and the UI.
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'
import type { Board } from '../../hooks/state/board.ts'
import type { On } from 'claude-code'

const SHA = 'd'.repeat(40)
const OTHER = 'e'.repeat(40)
const CLOUD = '1a2b3c4d-1111-2222-3333-444455556666'

type World = {
  /** Answers by argv joined with spaces; the first key the command starts with wins. */
  gh?: Record<string, { exitCode?: number; stdout: string }>
  jiraAllowed?: boolean
  jira?: unknown
  agents?: { id: string; type: string }[]
  files?: Record<string, string>
  /** The session's cost so far, as the engine's ledger reports it. */
  usd?: { now: number }
}

/** Stubs the machine; returns what the plugin ran, called and showed. */
function world(on: On, w: World = {}) {
  const ran: string[] = []
  const mcp: Record<string, unknown>[] = []
  const tools: string[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  const clock = mock.clock(on)
  // the plugin store, kept here so a test can read what the plugin saved
  const stored = new Map<string, unknown>()
  on('store.get', async (_$, e) => ({ value: stored.get(e.key) }) as never)
  on('store.set', async (_$, e) => (stored.set(e.key, e.value), { value: undefined }) as never)
  on('store.delete', async (_$, e) => (stored.delete(e.key), { value: undefined }) as never)
  on('process.run', async (_$, e) => {
    const line = e.argv.join(' ')
    ran.push(line)
    const key = Object.keys(w.gh ?? {}).find(k => line.startsWith(k))
    const answer = key ? w.gh![key]! : { exitCode: 1, stdout: '' }
    return { value: { exitCode: answer.exitCode ?? 0, stdout: answer.stdout, stderr: answer.exitCode ? 'gh: failed' : '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.read', async (_$, e) => {
    const text = w.files?.[e.path.split('/').at(-1)!]
    return text === undefined ? { deny: `ENOENT ${e.path}` } : { value: text }
  })
  on('agent.list', async () => ({ value: w.agents ?? [] }) as never)
  on('tool.list', async () => ({ value: [{ name: 'mcp__atlassian__searchJiraIssuesUsingJql', description: 'search', mcp: true }] }) as never)
  on('tool.check', async () => ({ decision: w.jiraAllowed ? 'allow' : 'ask' }) as never)
  on('mcp.call', async (_$, e) => {
    mcp.push({ ...e.args, tool: e.tool })
    return { value: { content: [{ type: 'text', text: JSON.stringify(w.jira ?? { issues: { nodes: [] } }) }], isError: false } }
  })
  // the tools themselves: a call that reaches the bottom ran (the UI events are left unanswered: the engine drops them)
  on('tool.call', async (_$, e) => {
    tools.push(e.tool === 'Bash' ? String((e as { command?: unknown }).command) : e.tool)
    return { result: 'ok', text: 'ok' } as never
  })
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('session.usage', async () => ({ value: { startedAt: 0, context: {}, rateLimits: [], ...(w.usd && { cost: { usd: w.usd.now } }) } }) as never)
  // the bottom of a slash command: nothing beneath the plugin's own answer
  on('command.run', async () => ({ text: '' }) as never)
  // the model: every request answers with the same usage
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: { input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, model: 'm' } }
  })
  return { ran, mcp, tools, clock, stored }
}

/** What the model reads from a call: a guard's refusal or the tool's text. */
const said = (r: unknown) => { const x = r as { deny?: string; text?: string }; return x.deny ?? x.text ?? '' }

const start = ($: Engine) => $.session.start({ cwd: '/repo', surface: null, isInteractive: false })

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
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never))).toContain('the loop spent $6.00 of its $5.00 budget')
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never))).toBe('ok')
  })

  test('no budget set: nothing is refused for spend', async ($, on) => {
    const usd = { now: 1 }
    world(on, { usd })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-sprint-drain' } as never)
    usd.now = 500
    expect(said(await $.tool.call({ tool: 'Skill', skill: 'agile-10-implement' } as never))).toBe('ok')
  })

  test('a fourth fix round on a PR is refused, counted from the heads gh reports', async ($, on) => {
    const view = { stdout: '' }
    const w = world(on, { gh: { 'gh pr view 7': view } })
    await start($)
    await $.tool.call({ tool: 'Skill', skill: 'agile-11-merge-train' } as never)
    const fix = { tool: 'Agent', subagent_type: 'agile-merge-review:fix-until-satisfied', description: 'fix PR #7', prompt: 'PR #7' } as never
    for (const head of ['1', '2', '3']) {
      view.stdout = JSON.stringify({ headRefOid: head.repeat(40), state: 'OPEN' })
      expect(said(await $.tool.call(fix))).toBe('ok')
    }
    view.stdout = JSON.stringify({ headRefOid: '4'.repeat(40), state: 'OPEN' })
    expect(said(await $.tool.call(fix))).toContain('3 fix rounds already')
    expect(w.tools.filter(t => t === 'Agent')).toHaveLength(3)
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
