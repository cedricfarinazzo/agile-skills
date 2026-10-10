// Pure retro data: what the loop did, counted as it happened, so agile-15-retro reads numbers
// instead of reconstructing them. Train steps and merge attempts are counted from the calls that
// dispatch them; tickets' phase markers and reworks come from the board's Jira sync.

import { PR_REF, stepOf, type Board } from './board.ts'

export type Retro = {
  since?: number
  prs: Record<string, { reviews: number; fixes: number; updates: number; merges: number }>
  blocked: number
  drainPasses: number
  drainOutcome?: string
}

export const EMPTY_RETRO: Retro = { prs: {}, blocked: 0, drainPasses: 0 }

const str = (value: unknown) => (typeof value === 'string' ? value : '')

export function loadRetro(value: unknown): Retro | undefined {
  if (typeof value !== 'object' || value === null || typeof (value as Retro).prs !== 'object') return undefined
  return { ...EMPTY_RETRO, ...(value as Partial<Retro>) }
}

const bumpPr = (r: Retro, pr: number, field: 'reviews' | 'fixes' | 'updates' | 'merges'): Retro => {
  const known = r.prs[pr] ?? { reviews: 0, fixes: 0, updates: 0, merges: 0 }
  return { ...r, prs: { ...r.prs, [pr]: { ...known, [field]: known[field] + 1 } } }
}

const STEP_FIELD: Record<string, 'reviews' | 'fixes' | 'updates'> = { '3a update': 'updates', '3b review': 'reviews', '3c fix': 'fixes' }

/** Folds the start of a call: a merge-train step or a merge attempt. */
export function retroStart(r: Retro, tool: string, args: Record<string, unknown>, now: number): Retro {
  const since = r.since ?? now
  if (tool === 'Skill' || tool === 'Agent') {
    const field = STEP_FIELD[stepOf(tool === 'Skill' ? str(args.skill) : str(args.subagent_type)) ?? '']
    const pr = Number((str(args.args) + ' ' + str(args.prompt) + ' ' + str(args.description)).match(PR_REF)?.[1])
    return field && pr ? bumpPr({ ...r, since }, pr, field) : { ...r, since }
  }
  const merge = tool === 'Bash' ? str(args.command).match(/\bgh pr merge\s+(\d+)/) : null
  if (merge) return bumpPr({ ...r, since }, Number(merge[1]), 'merges')
  if (tool.endsWith('__merge_pull_request') && typeof args.pullNumber === 'number') return bumpPr({ ...r, since }, args.pullNumber, 'merges')
  return r
}

/** Folds a finished agent call: a receipt whose `blocked` field is set. */
export function retroEnd(r: Retro, tool: string, text: string | undefined): Retro {
  if (text === undefined) return r
  if (tool === 'Agent' && /^\W*blocked\W*[:=]\s*(?!(?:none|no|false|null|-|—|\[\])\s*$)\S/im.test(text)) return { ...r, blocked: r.blocked + 1 }
  return r
}

export const retroDrain = (r: Retro, pass: number, outcome: string | undefined): Retro =>
  pass === r.drainPasses && outcome === r.drainOutcome ? r : { ...r, drainPasses: pass, drainOutcome: outcome }

/** The retro block: plain lines agile-15-retro can quote, or undefined when nothing was recorded. */
export function retroText(r: Retro, board: Board, now: number): string | undefined {
  const tickets = board.order.filter(k => board.tickets[k]!.phase).map(k => [k, board.tickets[k]!] as const)
  const prs = Object.entries(r.prs)
  if (!tickets.length && !prs.length && !r.drainPasses) return undefined
  const days = r.since !== undefined ? Math.max(0, Math.round((now - r.since) / 86_400_000)) : 0
  const reworked = tickets.filter(([, t]) => (t.reworks ?? 0) > 0)
  const refixed = prs.filter(([, p]) => p.fixes > 1 || p.reviews > 1)
  const retried = prs.filter(([, p]) => p.merges > 1)
  return [
    `agile-mods loop data (recorded by the mod over ${days} day(s); counts, not judgements):`,
    `- tickets with phase markers (Jira): ${tickets.length}; with rework cycles: ${reworked.length}${reworked.length ? ` (${reworked.map(([k, t]) => `${k}×${t.reworks}`).join(', ')})` : ''}`,
    `- PRs through the merge train: ${prs.length}; re-reviewed or re-fixed: ${refixed.length}${refixed.length ? ` (${refixed.map(([n, p]) => `#${n} review×${p.reviews} fix×${p.fixes}`).join(', ')})` : ''}`,
    `- merge attempts retried: ${retried.length}${retried.length ? ` (${retried.map(([n, p]) => `#${n}×${p.merges}`).join(', ')})` : ''}`,
    `- agent receipts that reported blocked: ${r.blocked}`,
    r.drainPasses ? `- sprint drain: ${r.drainPasses} pass(es), ${r.drainOutcome ?? 'running'}` : '- sprint drain: not run',
  ].join('\n')
}
