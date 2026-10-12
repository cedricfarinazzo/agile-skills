// Pure one-time bypasses: what a person allowed from the Guards tab after a refusal. Only a person
// grants one (a pane button or /agile-board allow, never a tool call), each covers exactly the facts
// refused, and none leaves the machine.

/** What a refusal can be allowed for: one merge of a PR at a head, one more fix round, or a ticket past its cap. */
export type Offer =
  | { rule: '3f'; pr: number; head: string }
  | { rule: 'fix'; pr: number }
  | { rule: 'ticketBudget'; ticket: string }

/** An offer a person allowed: a merge or fix bypass expires, a ticket-cap one ends with its ticket. */
export type Allowance = Offer & { at: number; until?: number }

export const BYPASS_MS = 30 * 60_000

export const offerText = (o: Offer) =>
  o.rule === '3f' ? `merge PR #${o.pr} at ${o.head.slice(0, 7)}` : o.rule === 'fix' ? `one more fix round on PR #${o.pr}` : `build ${o.ticket} past its cost cap`

/** Adds an allowance. */
export function allow(list: Allowance[], offer: Offer, now: number): Allowance[] {
  const same = (a: Allowance) => JSON.stringify({ ...a, at: 0, until: 0 }) === JSON.stringify({ ...offer, at: 0, until: 0 })
  const kept = list.filter(a => !same(a))
  return [...kept, offer.rule === 'ticketBudget' ? { ...offer, at: now } : { ...offer, at: now, until: now + BYPASS_MS }]
}

/** The allowances still open: merge and fix ones within their time, ticket-cap ones whose ticket is not done or parked. */
export function openOf(list: Allowance[], now: number, ended: (ticket: string) => boolean): Allowance[] {
  const next = list.filter(a => (a.until === undefined || a.until > now) && !(a.rule === 'ticketBudget' && ended(a.ticket)))
  return next.length === list.length ? list : next
}

/** Takes the merge allowance for a PR at one of `heads` (the pin and the live head); undefined when none is open. */
export function take3f(list: Allowance[], pr: number, heads: string[], now: number): Allowance[] | undefined {
  const i = list.findIndex(a => a.rule === '3f' && a.pr === pr && (a.until ?? Infinity) > now && !!a.head && heads.some(h => h.length >= 7 && (h.startsWith(a.head) || a.head.startsWith(h))))
  return i < 0 ? undefined : list.filter((_, j) => j !== i)
}

/** Takes the extra-round allowance for a PR; undefined when none is open. */
export function takeFix(list: Allowance[], pr: number, now: number): Allowance[] | undefined {
  const i = list.findIndex(a => a.rule === 'fix' && a.pr === pr && (a.until ?? Infinity) > now)
  return i < 0 ? undefined : list.filter((_, j) => j !== i)
}

/** Whether a build call on `ticket` may pass its cap: a person allowed that ticket. */
export const ticketBudgetOpen = (list: Allowance[], ticket: string) => list.some(a => a.rule === 'ticketBudget' && a.ticket === ticket)

export function loadAllowances(value: unknown): Allowance[] {
  return Array.isArray(value) ? value.filter((a): a is Allowance => typeof a === 'object' && a !== null && ['3f', 'fix', 'ticketBudget'].includes((a as Allowance).rule) && ((a as Allowance).rule !== 'ticketBudget' || typeof (a as { ticket?: unknown }).ticket === 'string') && typeof (a as Allowance).at === 'number') : []
}
