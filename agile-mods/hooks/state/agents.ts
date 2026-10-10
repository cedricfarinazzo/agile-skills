// Pure state behind the agents lane: what each of the loop's agents did, as the engine saw it. Its
// type and status come from `$.agent.list()`, its calls from `tool.call`, its tokens from
// `turn.step`; none of it is read from what the agent wrote.

import { PR_REF, TICKET_KEY, type Tokens } from './board.ts'
import { addTokens, hitRate, type Usage } from './flow.ts'

export type AgentStat = {
  firstAt: number
  lastAt: number
  /** Its last call: the tool, or a Bash command's first words. */
  last?: string
  /** What it waits on, from its last call: a CI run it watches. */
  wait?: string
  tokens?: Tokens
}

export type Stats = Record<string, AgentStat>

const MAX_AGENTS = 50

const touch = (stats: Stats, id: string, now: number, patch: Partial<AgentStat>): Stats => {
  const known = stats[id]
  const next = { ...stats, [id]: { ...known, ...patch, firstAt: known?.firstAt ?? now, lastAt: now } }
  const ids = Object.keys(next)
  return ids.length > MAX_AGENTS ? Object.fromEntries(ids.slice(-MAX_AGENTS).map(k => [k, next[k]!])) : next
}

/** Folds the start of an agent's tool call. */
export function noteCall(stats: Stats, id: string, tool: string, args: Record<string, unknown>, now: number): Stats {
  const command = tool === 'Bash' && typeof args.command === 'string' ? args.command : ''
  const run = command.match(/\bgh\s+run\s+watch\s+(\d+)/)?.[1]
  return touch(stats, id, now, { last: command ? command.trim().split(/\s+/).slice(0, 3).join(' ') : tool, wait: run ? `run ${run}` : undefined })
}

/** Folds one model request the agent made. */
export const noteTokens = (stats: Stats, id: string, u: Usage, now: number): Stats => touch(stats, id, now, { tokens: addTokens(stats[id]?.tokens, u) })

export type Lane = { id: string; name: string; work: string; status: string; age: number; idle: number; tokens: number; hit?: number; wait?: string }

const LOOP_AGENT = /^agile-(execution|merge-review|sprint-drain):/

/** One row per loop agent the engine lists, most recently active first. */
export function laneOf(agents: { id: string; type: string; status: string; description?: string }[], stats: Stats, now: number, max = 8): Lane[] {
  return agents
    .filter(a => LOOP_AGENT.test(a.type))
    .map(a => {
      const s = stats[a.id]
      const text = a.description ?? ''
      const work = text.match(TICKET_KEY)?.[0] ?? (text.match(PR_REF)?.[1] ? `PR #${text.match(PR_REF)![1]}` : '')
      const t = s?.tokens
      return {
        id: a.id,
        name: a.type.split(':').at(-1)!,
        work,
        status: a.status,
        age: s ? now - s.firstAt : 0,
        idle: s ? now - s.lastAt : 0,
        tokens: t ? t.input + t.read + t.write + t.output : 0,
        ...(hitRate(t) !== undefined && { hit: hitRate(t) }),
        ...(s?.wait && a.status !== 'completed' && { wait: s.wait }),
      }
    })
    .sort((x, y) => (stats[y.id]?.lastAt ?? 0) - (stats[x.id]?.lastAt ?? 0))
    .slice(0, max)
}
