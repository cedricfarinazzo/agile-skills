import { describe, expect, test } from 'bun:test'
import { EMPTY_RETRO, loadRetro, retroDrain, retroEnd, retroStart, retroText } from '../hooks/state/retro.ts'
import { EMPTY, applyJira, applyPrs, linksOf } from '../hooks/state/board.ts'

const DAY = 86_400_000
const issue = (key: string, phases: string[]) => ({ key, webUrl: `https://acme.atlassian.net/browse/${key}`, fields: { status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } }, comment: { comments: phases.map(p => ({ body: `🤖 <!-- agile:phase=${p} -->` })) } } })

describe('retro counts', () => {
  test('counts markers, rework, steps, retried merges and blocked receipts', () => {
    let r = retroStart(EMPTY_RETRO, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'PR #4' }, 0)
    r = retroStart(r, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'PR #4' }, DAY)
    r = retroStart(r, 'Skill', { skill: 'merge-fix-until-satisfied', args: 'PR 4' }, DAY)
    r = retroStart(r, 'Bash', { command: 'gh pr merge 4 --squash' }, DAY)
    r = retroStart(r, 'Bash', { command: 'gh pr merge 4 --squash' }, 2 * DAY)
    r = retroEnd(r, 'Agent', 'blocked: no CI')
    r = retroEnd(r, 'Agent', 'blocked: none')
    r = retroDrain(r, 3, 'DRAINED')
    const board = applyJira(EMPTY, { issues: [issue('VC-3', ['plan', 'rework']), issue('VC-4', [])] }, 'customfield_10016', 0)
    expect(retroText(r, board, 2 * DAY)?.split('\n')).toEqual([
      'agile-mods loop data (recorded by the mod over 2 day(s); counts, not judgements):',
      '- tickets with phase markers (Jira): 1; with rework cycles: 1 (VC-3×1)',
      '- PRs through the merge train: 1; re-reviewed or re-fixed: 1 (#4 review×2 fix×1)',
      '- merge attempts retried: 1 (#4×2)',
      '- agent receipts that reported blocked: 1',
      '- sprint drain: 3 pass(es), DRAINED',
    ])
  })

  test('nothing recorded means no block, and old stores load', () => {
    expect(retroText(EMPTY_RETRO, EMPTY, 0)).toBeUndefined()
    expect(loadRetro({ prs: {} })).toEqual(EMPTY_RETRO)
  })
})

describe('links', () => {
  test('come from the Jira issue self URL and the gh PR url', () => {
    let b = applyJira(EMPTY, { issues: [issue('VC-3', ['pr'])] }, 'customfield_10016', 0)
    expect(linksOf(b)).toEqual([{ label: 'VC-3 In Progress', href: 'https://acme.atlassian.net/browse/VC-3' }])
    b = applyPrs(b, [{ number: 4, title: 'VC-3 x', state: 'OPEN', url: 'https://github.com/acme/app/pull/4' }], 0)
    expect(linksOf(b).at(-1)).toEqual({ label: 'PR #4 VC-3', href: 'https://github.com/acme/app/pull/4' })
  })
})

describe('retro merges', () => {
  test('an MCP merge counts as a merge attempt', () => {
    const r = retroStart(EMPTY_RETRO, 'mcp__github__merge_pull_request', { pullNumber: 4 }, 5)
    expect(r.prs[4]?.merges).toBe(1)
    expect(r.since).toBe(5)
  })
})
