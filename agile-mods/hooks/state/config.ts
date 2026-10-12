// Pure guard configuration: the plugin's userConfig options, checked, then tightened (never
// loosened) by the consumer repo's CLAUDE.md / AGENTS.md, which the loop itself can edit.

export type Mode = 'enforce' | 'warn' | 'off'
export type Gate = 'grants' | 'mergePin' | 'mergeCi' | 'mergeReview' | 'push' | 'sideDoor'

export type GuardConfig = {
  modes: Record<Gate, Mode>
  /** Fix rounds per PR after a review; 0 is no cap. */
  fixRounds: number
  allowBypass: boolean
  /** USD; 0 is no budget. */
  budgetUsd: number
}

/** Each gate's option name, as the plugin's userConfig and a repo's config spell it. */
export const OPTION: Record<Gate, string> = {
  grants: 'guardGrants',
  mergePin: 'guardMergePin',
  mergeCi: 'guardMergeCi',
  mergeReview: 'guardMergeReview',
  push: 'guardPush',
  sideDoor: 'guardSideDoor',
}

export const GATES = Object.keys(OPTION) as Gate[]

export const DEFAULTS: GuardConfig = {
  modes: { grants: 'enforce', mergePin: 'enforce', mergeCi: 'enforce', mergeReview: 'enforce', push: 'enforce', sideDoor: 'enforce' },
  fixRounds: 3,
  allowBypass: true,
  budgetUsd: 0,
}

/** The modes a gate takes: a push to main cannot be undone, so the push guard has no off. */
const modesOf = (gate: Gate): Mode[] => (gate === 'push' ? ['enforce', 'warn'] : ['enforce', 'warn', 'off'])

const RANK: Record<Mode, number> = { off: 0, warn: 1, enforce: 2 }

const count = (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
const flag = (value: unknown) => (typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined)

/** The options as given, each checked; a value out of range keeps its default, and a note says so. */
export function configOf(options: Record<string, unknown> | undefined): { config: GuardConfig; notes: string[] } {
  const notes: string[] = []
  const o = options ?? {}
  const modes = { ...DEFAULTS.modes }
  for (const gate of GATES) {
    const value = o[OPTION[gate]]
    if (value === undefined || value === '') continue
    const mode = String(value).trim().toLowerCase() as Mode
    if (modesOf(gate).includes(mode)) modes[gate] = mode
    else notes.push(`${OPTION[gate]}: "${value}" is not ${modesOf(gate).join(', ')}; ${DEFAULTS.modes[gate]} applies`)
  }
  const numberOf = (key: 'fixRounds' | 'budgetUsd') => {
    if (o[key] === undefined || o[key] === '') return DEFAULTS[key]
    const n = count(o[key])
    if (n === undefined) notes.push(`${key}: "${o[key]}" is not a number of 0 or more; ${DEFAULTS[key]} applies`)
    return n ?? DEFAULTS[key]
  }
  const fixRounds = Math.floor(numberOf('fixRounds'))
  const budgetUsd = numberOf('budgetUsd')
  let allowBypass = DEFAULTS.allowBypass
  if (o.allowBypass !== undefined && o.allowBypass !== '') {
    const b = flag(o.allowBypass)
    if (b === undefined) notes.push(`allowBypass: "${o.allowBypass}" is not true or false; ${DEFAULTS.allowBypass} applies`)
    else allowBypass = b
  }
  return { config: { modes, fixRounds, allowBypass, budgetUsd }, notes }
}

const KEYS = [...Object.values(OPTION), 'fixRounds', 'budgetUsd', 'allowBypass']

/** The guard keys a repo's AGENTS.md / CLAUDE.md sets (`guardPush: enforce`, `- fixRounds = 2`), the first of each. */
export function repoConfigOf(text: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const key of KEYS) {
    const m = text.match(new RegExp(`\\b${key}\\b\\W*?\\s*[:=]\\s*\`?([\\w.]+)`))
    if (m) found[key] = m[1]!
  }
  return found
}

/**
 * A repo's settings applied only where they are stricter: a mode higher, a cap or budget lower (and
 * not 0, which turns it off), the bypass turned off. A looser value is ignored, and a note says so.
 */
export function tightened(config: GuardConfig, repo: Record<string, string>): { config: GuardConfig; notes: string[] } {
  const notes: string[] = []
  const modes = { ...config.modes }
  for (const gate of GATES) {
    const value = repo[OPTION[gate]]
    if (value === undefined) continue
    const mode = value.toLowerCase() as Mode
    if (!modesOf(gate).includes(mode)) notes.push(`repo ${OPTION[gate]}: "${value}" is not ${modesOf(gate).join(', ')}; ignored`)
    else if (RANK[mode] > RANK[modes[gate]]) modes[gate] = mode
    else if (RANK[mode] < RANK[modes[gate]]) notes.push(`repo ${OPTION[gate]}: ${mode} is looser than ${modes[gate]}; a repo can only tighten, ignored`)
  }
  const lower = (key: 'fixRounds' | 'budgetUsd', current: number) => {
    if (repo[key] === undefined) return current
    const n = count(repo[key])
    if (n === undefined || n === 0) {
      notes.push(`repo ${key}: "${repo[key]}" ${n === 0 ? 'would turn it off, which a repo cannot do' : 'is not a number'}; ignored`)
      return current
    }
    if (current === 0 || n < current) return key === 'fixRounds' ? Math.floor(n) : n
    if (n > current) notes.push(`repo ${key}: ${n} is looser than ${current}; a repo can only tighten, ignored`)
    return current
  }
  const fixRounds = lower('fixRounds', config.fixRounds)
  const budgetUsd = lower('budgetUsd', config.budgetUsd)
  let allowBypass = config.allowBypass
  if (repo.allowBypass === 'false') allowBypass = false
  else if (repo.allowBypass === 'true' && !config.allowBypass) notes.push('repo allowBypass: true is looser than false; a repo can only tighten, ignored')
  return { config: { modes, fixRounds, allowBypass, budgetUsd }, notes }
}

/** One line for the Guards tab header: every gate's mode, the cap, the budget and the bypass. */
export function modesLine(config: GuardConfig): string {
  const modes = GATES.map(g => `${OPTION[g].replace(/^guard/, '').replace(/^./, c => c.toLowerCase())} ${config.modes[g]}`).join(' · ')
  return `${modes} · fixRounds ${config.fixRounds || 'off'} · budget ${config.budgetUsd ? `$${config.budgetUsd}` : 'off'} · bypass ${config.allowBypass ? 'on' : 'off'}`
}
