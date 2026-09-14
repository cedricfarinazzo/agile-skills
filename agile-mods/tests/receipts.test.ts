import { describe, expect, test } from 'bun:test'
import { MAX_RECEIPTS, isContractAgent, keepReceipt, receiptIssues, receiptsText, type Receipt } from '../hooks/state/receipts.ts'

describe('receipts', () => {
  test('a clean strict receipt has no issues', () => {
    expect(receiptIssues('agile-merge-review:pr-updater', 'outcome: Pushed\nsha: abc1234\nunapplied_mutations: none')).toEqual([])
  })

  test('flags preamble, summary, blocked and unapplied mutations', () => {
    const text = "I'll summarise the work.\n## Summary\nblocked: CI unreachable\nunapplied_mutations: transition VC-3 — no permission"
    expect(receiptIssues('agile-merge-review:jira-postmortem', text)).toEqual([
      'preamble',
      'summary section in a strict receipt',
      'blocked: CI unreachable',
      'unapplied_mutations: transition VC-3 — no permission',
    ])
  })

  test('pr-reviewer needs a reviewed sha; an unproven base claim is flagged', () => {
    expect(receiptIssues('agile-merge-review:pr-reviewer', '## PR #3 Review\nlint error is pre-existing')).toEqual([
      '"pre-existing" without base-branch proof',
      'no reviewed sha',
    ])
  })

  test('only the two agent plugins carry the contract', () => {
    expect(isContractAgent('agile-execution:build-monitor')).toBe(true)
    expect(isContractAgent('Explore')).toBe(false)
  })

  test('keeps the newest receipts and lists flagged ones first', () => {
    let list: Receipt[] = []
    for (let i = 0; i < MAX_RECEIPTS + 5; i++) list = keepReceipt(list, { agent: 'agile-merge-review:pr-updater', at: i, issues: [] })
    expect(list).toHaveLength(MAX_RECEIPTS)
    expect(list[0]?.at).toBe(5)
    expect(receiptsText(list, false)).toContain('none flagged')
    list = keepReceipt(list, { agent: 'agile-merge-review:pr-reviewer', at: 99, pr: 3, issues: ['no reviewed sha'] })
    expect(receiptsText(list, false).split('\n')[1]).toContain('pr-reviewer')
  })
})
