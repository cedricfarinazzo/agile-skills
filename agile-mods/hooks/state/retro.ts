// Pure retro data: what the loop did, counted as it happened, so agile-15-retro reads numbers
// instead of reconstructing them from Jira comments.

import { PR_REF, stepOf } from './board.ts'

export type Retro = {
  since?: number
  tickets: Record<string, { markers: number; reworks: number }>
  prs: Record<string, { reviews: number; fixes: number; updates: number; merges: number }>
  blocked: number
  drainPasses: number
  drainOutcome?: string
}

export const EMPTY_RETRO: Retro = { tickets: {}, prs: {}, blocked: 0, drainPasses: 0 }

const str = (value: unknown) => (typeof value === 'string' ? value : '')

export function loadRetro(value: unknown): Retro | undefined {
  if (typeof value !== 'object' || value === null || typeof (value as Retro).tickets !== 'object') return undefined
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
  if (tool === 'mcp__github__merge_pull_request' && typeof args.pullNumber === 'number') return bumpPr({ ...r, since }, args.pullNumber, 'merges')
  return r
}

/** Folds a finished call: phase markers per ticket, and blocked receipts. */
export function retroEnd(r: Retro, tool: string, args: Record<string, unknown>, text: string | undefined): Retro {
  if (text === undefined) return r
  if (tool === 'mcp__atlassian__addCommentToJiraIssue') {
    const key = str(args.issueIdOrKey)
    const phases = [...str(args.commentBody).matchAll(/agile:phase=([a-z_]+)/g)].map(m => m[1])
    if (!phases.length || !key) return r
    const known = r.tickets[key] ?? { markers: 0, reworks: 0 }
    const reworks = phases.filter(p => p === 'rework').length
    return { ...r, tickets: { ...r.tickets, [key]: { markers: known.markers + phases.length, reworks: known.reworks + reworks } } }
  }
  if (tool === 'Agent' && /^\W*blocked\W*[:=]\s*(?!(?:none|no|false|null|-|—|\[\])\s*$)\S/im.test(text)) return { ...r, blocked: r.blocked + 1 }
  return r
}

export const retroDrain = (r: Retro, pass: number, outcome: string | undefined): Retro =>
  pass === r.drainPasses && outcome === r.drainOutcome ? r : { ...r, drainPasses: pass, drainOutcome: outcome }

/** The retro block: plain lines agile-15-retro can quote, or undefined when nothing was recorded. */
export function retroText(r: Retro, now: number): string | undefined {
  const tickets = Object.entries(r.tickets)
  const prs = Object.entries(r.prs)
  if (!tickets.length && !prs.length && !r.drainPasses) return undefined
  const days = r.since !== undefined ? Math.max(0, Math.round((now - r.since) / 86_400_000)) : 0
  const reworked = tickets.filter(([, t]) => t.reworks > 0)
  const refixed = prs.filter(([, p]) => p.fixes > 1 || p.reviews > 1)
  const retried = prs.filter(([, p]) => p.merges > 1)
  return [
    `agile-mods loop data (recorded by the mod over ${days} day(s); counts, not judgements):`,
    `- tickets with phase markers: ${tickets.length}; with rework cycles: ${reworked.length}${reworked.length ? ` (${reworked.map(([k, t]) => `${k}×${t.reworks}`).join(', ')})` : ''}`,
    `- PRs through the merge train: ${prs.length}; re-reviewed or re-fixed: ${refixed.length}${refixed.length ? ` (${refixed.map(([n, p]) => `#${n} review×${p.reviews} fix×${p.fixes}`).join(', ')})` : ''}`,
    `- merge attempts retried: ${retried.length}${retried.length ? ` (${retried.map(([n, p]) => `#${n}×${p.merges}`).join(', ')})` : ''}`,
    `- blocked agent receipts: ${r.blocked}`,
    r.drainPasses ? `- sprint drain: ${r.drainPasses} pass(es), ${r.drainOutcome ?? 'running'}` : '- sprint drain: not run',
  ].join('\n')
}
