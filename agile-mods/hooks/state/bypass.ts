// Pure one-time bypasses: what a person allowed from the Guards tab after a refusal. Only a person
// grants one (a pane button or /agile-board allow, never a tool call), each covers exactly the facts
// refused, and none leaves the machine.

/** What a refusal can be allowed for: one merge of a PR at a head, one more fix round, or a ticket past the budget. */
export type Offer =
  | { rule: '3f'; pr: number; head?: string }
  | { rule: 'fix'; pr: number }
  | { rule: 'budget'; ticket?: string }

/** An offer a person allowed: a merge or fix bypass expires, a budget one ends with its ticket. */
export type Allowance = Offer & { at: number; until?: number; merged?: number }

export const BYPASS_MS = 30 * 60_000

export const offerText = (o: Offer) =>
  o.rule === '3f' ? `merge PR #${o.pr}${o.head ? ` at ${o.head.slice(0, 7)}` : ''}` : o.rule === 'fix' ? `one more fix round on PR #${o.pr}` : `build ${o.ticket ?? 'the current ticket'} past the budget`

/** Adds an allowance; a budget one notes how many PRs had merged, to end at the next when it names no ticket. */
export function allow(list: Allowance[], offer: Offer, now: number, merged: number): Allowance[] {
  const same = (a: Allowance) => JSON.stringify({ ...a, at: 0, until: 0, merged: 0 }) === JSON.stringify({ ...offer, at: 0, until: 0, merged: 0 })
  const kept = list.filter(a => !same(a))
  return [...kept, offer.rule === 'budget' ? { ...offer, at: now, merged } : { ...offer, at: now, until: now + BYPASS_MS }]
}

/** The allowances still open: merge and fix ones within their time, budget ones whose ticket is not done or parked. */
export function openOf(list: Allowance[], now: number, ended: (ticket: string) => boolean, merged: number): Allowance[] {
  const next = list.filter(a => (a.until === undefined || a.until > now) && !(a.rule === 'budget' && (a.ticket ? ended(a.ticket) : merged > (a.merged ?? 0))))
  return next.length === list.length ? list : next
}

/** Takes the merge allowance for a PR at one of `heads` (the pin and the live head); undefined when none is open. */
export function take3f(list: Allowance[], pr: number, heads: string[], now: number): Allowance[] | undefined {
  const i = list.findIndex(a => a.rule === '3f' && a.pr === pr && (a.until ?? Infinity) > now && (!a.head || heads.some(h => h.startsWith(a.head!) || a.head!.startsWith(h))))
  return i < 0 ? undefined : list.filter((_, j) => j !== i)
}

/** Takes the extra-round allowance for a PR; undefined when none is open. */
export function takeFix(list: Allowance[], pr: number, now: number): Allowance[] | undefined {
  const i = list.findIndex(a => a.rule === 'fix' && a.pr === pr && (a.until ?? Infinity) > now)
  return i < 0 ? undefined : list.filter((_, j) => j !== i)
}

/** Whether a build call naming `keys` may pass the budget: an open budget allowance names one of them, or one names no ticket. */
export const budgetOpen = (list: Allowance[], keys: string[]) =>
  list.some(a => a.rule === 'budget' && (!a.ticket || !keys.length || keys.includes(a.ticket)))

export function loadAllowances(value: unknown): Allowance[] {
  return Array.isArray(value) ? value.filter((a): a is Allowance => typeof a === 'object' && a !== null && ['3f', 'fix', 'budget'].includes((a as Allowance).rule) && typeof (a as Allowance).at === 'number') : []
}
