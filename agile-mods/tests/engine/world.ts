// The machine beneath the plugin in engine tests: gh and git (`process.run`), the Atlassian MCP
// server (`tool.list`, `tool.check`, `mcp.call`), the repo files, the store, the clock, the model and
// the UI. Each test file builds one world per test.
import { mock, type Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

export const SHA = 'd'.repeat(40)
export const OTHER = 'e'.repeat(40)
export const CLOUD = '1a2b3c4d-1111-2222-3333-444455556666'

export type World = {
  /** Answers by argv joined with spaces; the first key the command starts with wins. */
  gh?: Record<string, { exitCode?: number; stdout: string }>
  jiraAllowed?: boolean
  jira?: unknown
  agents?: { id: string; type: string }[]
  files?: Record<string, string>
  /** The session's cost so far, as the engine's ledger reports it. */
  usd?: { now: number }
  /** What the plugin store holds at the start, by full key (`/repo:board`). */
  stored?: Record<string, unknown>
}

/** Stubs the machine; returns what the plugin ran, called and showed. */
export function world(on: On, w: World = {}) {
  const ran: string[] = []
  const mcp: Record<string, unknown>[] = []
  const tools: string[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  const clock = mock.clock(on)
  // the plugin store, kept here so a test can read what the plugin saved
  const stored = new Map<string, unknown>(Object.entries(w.stored ?? {}))
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
  // the engine's own drawing beneath the plugins: the prompt, for the band above it
  on('ui.render', async () => ({ type: 'Text', children: ['> the prompt'] }) as never)
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
export const said = (r: unknown) => { const x = r as { deny?: string; text?: string }; return x.deny ?? x.text ?? '' }

export const start = ($: Engine) => $.session.start({ cwd: '/repo', surface: null, isInteractive: false })
