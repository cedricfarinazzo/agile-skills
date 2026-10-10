// Engine tests for hooks/register.tsx: the plugin loads in the engine itself (`claude plugin test`),
// and the hooks below stand for the machine beneath it: gh and git (`process.run`), the Atlassian
// MCP server (`tool.list`, `tool.check`, `mcp.call`), the repo files, the store and the UI.
import { describe, expect, mock, test, type Engine } from 'claude-code/testing'
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
}

/** Stubs the machine; returns what the plugin ran, called and showed. */
function world(on: On, w: World = {}) {
  const ran: string[] = []
  const mcp: Record<string, unknown>[] = []
  const tools: string[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  const clock = mock.clock(on)
  mock.store(on)
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
  // the bottom of a slash command: nothing beneath the plugin's own answer
  on('command.run', async () => ({ text: '' }) as never)
  return { ran, mcp, tools, clock }
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
