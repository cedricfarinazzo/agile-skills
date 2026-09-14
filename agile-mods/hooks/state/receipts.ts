// Pure receipt checks for /receipts: the parts of the shared receipt contract a reader can test
// without re-running the phase.

import { unprovenClaimOf } from './guards.ts'

export type Receipt = {
  agent: string
  at: number
  pr?: number
  issues: string[]
}

const PREAMBLE = /^(I('| a)m|I'll|I will|I have|Here('s| is| are)|Sure|Okay|OK,|Let me|Great|Done[.!])/i
const SUMMARY = /^#{1,4}\s*(Summary|Overview|Praise|What went well)\b/im
const FINDINGS_AGENTS = new Set(['pr-reviewer', 'review-lens', 'self-reviewer'])

/** Whether an agent type belongs to the plugins whose agents carry the receipt contract. */
export const isContractAgent = (agentType: string) => /^agile-(execution|merge-review):/.test(agentType)

/** The contract breaches visible in one receipt; empty when none shows. */
export function receiptIssues(agentType: string, text: string): string[] {
  const agent = agentType.split(':').at(-1) ?? agentType
  const issues: string[] = []
  const first = text.split('\n').find(l => l.trim())?.trim() ?? ''
  if (!text.trim()) issues.push('no receipt')
  if (PREAMBLE.test(first)) issues.push('preamble')
  if (SUMMARY.test(text)) issues.push(FINDINGS_AGENTS.has(agent) ? 'summary/praise section' : 'summary section in a strict receipt')
  const blocked = text.match(/^\W*blocked\W*[:=]\s*(.+)$/im)?.[1]?.trim()
  if (blocked && !/^(none|no|false|null|-|—|\[\])$/i.test(blocked)) issues.push(`blocked: ${blocked.slice(0, 80)}`)
  const unapplied = text.match(/^\W*unapplied_mutations\W*[:=]\s*(.+)$/im)?.[1]?.trim()
  if (unapplied && !/^(none|no|\[\]|-|—|0)$/i.test(unapplied)) issues.push(`unapplied_mutations: ${unapplied.slice(0, 80)}`)
  const claim = unprovenClaimOf(text)
  if (claim) issues.push(`"${claim}" without base-branch proof`)
  if (agent === 'pr-reviewer' && !/Reviewed sha:\s*`?[0-9a-f]{7,40}/i.test(text)) issues.push('no reviewed sha')
  return issues
}

export const MAX_RECEIPTS = 40

export const keepReceipt = (list: Receipt[], receipt: Receipt): Receipt[] => [...list, receipt].slice(-MAX_RECEIPTS)

/** The /receipts listing: flagged receipts first, newest first within each group. */
export function receiptsText(list: Receipt[], all: boolean): string {
  const shown = [...list].reverse().filter(r => all || r.issues.length)
  if (!list.length) return 'no agent receipts in this session yet'
  if (!shown.length) return `${list.length} receipt(s), none flagged · /receipts all lists them`
  const rows = shown.map(r => `${r.agent.split(':').at(-1)!.padEnd(20)} ${r.pr ? `PR #${r.pr}`.padEnd(9) : ''.padEnd(9)} ${r.issues.length ? r.issues.join('; ') : 'ok'}`)
  return [`${shown.length} of ${list.length} receipt(s)${all ? '' : ' flagged'}`, ...rows].join('\n')
}
