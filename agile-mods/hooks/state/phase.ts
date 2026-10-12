// Pure: which build phase a ticket is in now. A `🤖 agile:phase=<x>` marker is posted when phase
// `x` finishes, so the latest marker is the phase just done and the ticket is in the one after it,
// unless a loop agent the engine lists says what is running.

import { TICKET_KEY, type Board, type Ticket } from './board.ts'

/** The build phases in the order agile-10-implement runs them. */
export const BUILD_PHASES = ['validate', 'plan', 'implement', 'pr', 'review'] as const
/** After `review` the ticket is handed off, then monitored until the train merges it. */
export type Phase = (typeof BUILD_PHASES)[number] | 'handoff' | 'monitor'

/** A marker is stale past this with no agent running: the phase shown is a guess. */
export const STALE_MS = 10 * 60_000

const AGENT_PHASE: [RegExp, Phase][] = [
  [/(^|:)ticket-validator$/, 'validate'],
  [/(^|:)ticket-planner$/, 'plan'],
  [/(^|:)build-implementer$/, 'implement'],
  [/(^|:)pr-publisher$/, 'pr'],
  [/(^|:)(self-reviewer|review-lens)$/, 'review'],
  [/(^|:)build-monitor$/, 'monitor'],
]

/** The phase a loop agent type runs; undefined for the merge side and for session agents, which run them all. */
export const phaseOfAgent = (type: string): Phase | undefined => AGENT_PHASE.find(([re]) => re.test(type))?.[1]

const ENDED = new Set(['completed', 'failed', 'stopped', 'killed', 'cancelled', 'error'])

/** Each ticket a running build agent works, with its phase: from the ticket key in its description, or the PR it names. */
export function liveOf(agents: { type: string; status?: string; description?: string }[], board: Board): Record<string, Phase> {
  const live: Record<string, Phase> = {}
  for (const a of agents) {
    const phase = phaseOfAgent(a.type)
    if (!phase || (a.status && ENDED.has(a.status))) continue
    const text = a.description ?? ''
    const pr = text.match(/(?:\/pull\/|#|\bPR\s*#?)(\d+)/i)?.[1]
    const key = text.match(TICKET_KEY)?.[0] ?? (pr ? board.prs[pr]?.key : undefined)
    if (key) live[key] = phase
  }
  return live
}

/** The phase after the marker `last`, given the markers seen and the review verdict label. */
function after(t: Pick<Ticket, 'marks' | 'review'>, last: string): Phase | 'done' | undefined {
  switch (last) {
    case 'validate': return 'plan'
    case 'plan': return 'implement'
    case 'implement': return t.marks?.includes('pr') ? 'review' : 'pr'
    case 'pr': return 'review'
    case 'review': return t.review === 'changes' ? 'implement' : 'handoff'
    case 'status_change':
    case 'rework': return 'monitor'
    case 'post_merge': return 'done'
    default: return undefined
  }
}

export type PhaseNow = {
  /** The phase running or next; `done` once merged, `queued` for a ticket not started (no marker, not in progress), `unknown` for a marker this version does not know. */
  now: Phase | 'done' | 'queued' | 'unknown'
  /** The marker just finished, when one was posted. */
  done?: string
  /** `agent`: an engine-listed agent is on it. `marker`: the step after the last marker. */
  source: 'agent' | 'marker'
  /** Only a marker, and an old one: the ticket may have moved on. */
  stale: boolean
}

export function phaseOf(t: Ticket, live: Phase | undefined, now: number): PhaseNow {
  const done = t.phase
  if (live) return { now: live, ...(done && { done }), source: 'agent', stale: false }
  if (!done && t.category !== undefined && t.category !== 'indeterminate') return { now: 'queued', source: 'marker', stale: false }
  const next = done ? after(t, done) : 'validate'
  if (done && next === undefined) return { now: 'unknown', done, source: 'marker', stale: false }
  // the age of the marker comment, not of the last poll that read it
  const stale = t.markAt !== undefined && now - t.markAt > STALE_MS && next !== 'done'
  return { now: next!, ...(done && { done }), source: 'marker', stale }
}

/** How many of the five build dots are finished: the dot at this index is running, five is all done, -1 none started or unknown. */
export const dotsDone = (p: PhaseNow): number => (p.now === 'queued' || p.now === 'unknown' ? -1 : p.now === 'done' || p.now === 'handoff' || p.now === 'monitor' ? BUILD_PHASES.length : Math.max(0, BUILD_PHASES.indexOf(p.now as (typeof BUILD_PHASES)[number])))
