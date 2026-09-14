import type { Finished, Host } from './host.ts'
import { PR_REF } from './state/board.ts'
import { baseProofReminder, fenceOf, grantDenial, headReadOf, isReviewStep, mergeTargetOf, reviewedOf, shaGateDenial, unprovenClaimOf } from './state/guards.ts'

// Guards: the rules the skills state in prose, enforced on the call that would break them.
// - a subagent's tool grant: review-lens and pr-reviewer never edit or post, jira-postmortem never links;
// - the 3f reviewed-sha gate: while a merge train runs, a merge refuses a head no review vouched for;
// - base-branch proof: a receipt claiming "pre-existing" or "flaky" with no comparison gets a reminder;
// - untrusted output: a PR, issue, ticket or page whose text reads like an instruction gets a fence.

let cwd: string | undefined
let trainActive = false
let inlineReview: number | undefined
const reviewed = new Map<number, string>()
const agentTypes = new Map<string, string>()

async function agentTypeOf(host: Host, id: string): Promise<string | undefined> {
  if (!agentTypes.has(id)) {
    for (const a of await host.agents().catch(() => [])) agentTypes.set(a.id, a.type)
  }
  return agentTypes.get(id)
}

async function headOf(host: Host, pr: number): Promise<string | undefined> {
  const run = await host.run(['gh', 'pr', 'view', String(pr), '--json', 'headRefOid', '-q', '.headRefOid'], { cwd, timeoutMs: 20_000 }).catch(() => undefined)
  const sha = run?.exitCode === 0 ? run.stdout.trim() : ''
  if (!sha) host.log(`agile-mods: could not read PR #${pr}'s head; the reviewed-sha gate compares nothing for this merge`)
  return sha || undefined
}

export const guardsStart = (sessionCwd: string) => {
  cwd = sessionCwd
}

/** Before a tool call: the refusal, when a grant or the reviewed-sha gate forbids it. */
export async function guardsBefore(host: Host, tool: string, args: Record<string, unknown>, agentId: string | undefined): Promise<string | undefined> {
  if (agentId) {
    const type = await agentTypeOf(host, agentId)
    const deny = type ? grantDenial(type, tool, args) : undefined
    if (deny) return `agile-mods: ${deny}`
  }
  const skill = typeof args.skill === 'string' ? args.skill : ''
  if (tool === 'Skill' && /(^|:)(agile-11-merge-train|agile-sprint-drain)$/.test(skill)) trainActive = true
  if (tool === 'Skill' && /(^|:)merge-review-pr$/.test(skill)) {
    inlineReview = Number(String(args.args ?? '').match(PR_REF)?.[1]) || undefined
  }
  const target = mergeTargetOf(tool, args)
  if (!target || !trainActive) return undefined
  const deny = shaGateDenial(target.pr, reviewed.get(target.pr), target.head ?? await headOf(host, target.pr))
  return deny ? `agile-mods: ${deny}` : undefined
}

/** After a tool call: records reviewed shas, returns the reminders to add as context. */
export function guardsAfter(tool: string, args: Record<string, unknown>, done: Finished): string[] {
  const text = done.text
  if (text === undefined) return []
  if (tool === 'Agent' && isReviewStep(tool, args)) {
    const review = reviewedOf(args, text)
    if (review) reviewed.set(review.pr, review.sha)
  }
  const read = inlineReview !== undefined ? headReadOf(tool, args, text) : undefined
  if (read && read.pr === inlineReview) reviewed.set(read.pr, read.sha)
  const extra: string[] = []
  const claim = tool === 'Agent' ? unprovenClaimOf(text) : undefined
  if (claim) extra.push(baseProofReminder(claim))
  const fence = fenceOf(tool, args, text)
  if (fence) extra.push(fence)
  return extra
}

/** A main-loop turn's answer: an inline review's receipt names its reviewed sha. */
export function guardsTurn(answer: string) {
  if (inlineReview === undefined) return
  const review = reviewedOf({ args: `PR ${inlineReview}` }, answer)
  if (review) reviewed.set(review.pr, review.sha)
  inlineReview = undefined
}
