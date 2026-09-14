import type { Finished, Host } from './host.ts'
import { PR_REF } from './state/board.ts'
import { isContractAgent, keepReceipt, receiptIssues, receiptsText, type Receipt } from './state/receipts.ts'

// /receipts: every agile-execution / agile-merge-review agent's receipt, checked against the shared
// receipt contract as it comes back — preamble, summary section, blocked, unapplied_mutations, a
// base-branch claim with no proof, pr-reviewer without a reviewed sha. A flagged receipt also toasts.

const STORE_KEY = 'receipts'
let receipts: Receipt[] = []

export const RECEIPTS_COMMAND = {
  name: 'receipts',
  description: 'Agent receipts checked against the receipt contract: flagged, all, clear (agile-mods)',
  argumentHint: '[all | clear]',
  immediate: true,
} as const

export async function receiptsStart(host: Host) {
  const stored = await host.storeGet(STORE_KEY).catch(() => undefined)
  if (Array.isArray(stored)) receipts = stored as Receipt[]
}

export async function receiptsCommand(host: Host, arg: string): Promise<string> {
  if (arg !== 'clear') return receiptsText(receipts, arg === 'all')
  receipts = []
  await host.storeSet(STORE_KEY, receipts).catch(() => undefined)
  return 'receipts cleared'
}

export async function receiptsAfter(host: Host, tool: string, args: Record<string, unknown>, done: Finished) {
  const agent = typeof args.subagent_type === 'string' ? args.subagent_type : ''
  if (tool !== 'Agent' || !isContractAgent(agent) || done.denied) return
  const pr = Number(`${args.description ?? ''} ${args.prompt ?? ''}`.match(PR_REF)?.[1]) || undefined
  const receipt: Receipt = { agent, at: await host.now(), ...(pr && { pr }), issues: done.isError ? ['agent errored'] : receiptIssues(agent, done.text ?? '') }
  receipts = keepReceipt(receipts, receipt)
  void host.storeSet(STORE_KEY, receipts).catch(err => host.log(`agile-mods: store write failed: ${err}`))
  if (receipt.issues.length) host.toast(`receipt ${agent.split(':').at(-1)}: ${receipt.issues.join('; ')} · /receipts`)
}
