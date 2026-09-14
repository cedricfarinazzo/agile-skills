import { describe, expect, test } from 'bun:test'
import { EMPTY_RETRO, loadRetro, retroDrain, retroEnd, retroStart, retroText } from '../hooks/state/retro.ts'
import { EMPTY, linksOf, observeTool } from '../hooks/state/board.ts'

const DAY = 86_400_000
const marker = (key: string, phase: string) => ({ issueIdOrKey: key, commentBody: `🤖 <!-- agile:phase=${phase} -->` })

describe('retro counts', () => {
  test('counts markers, rework, steps, retried merges and blocked receipts', () => {
    let r = retroStart(EMPTY_RETRO, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'PR #4' }, 0)
    r = retroStart(r, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'PR #4' }, DAY)
    r = retroStart(r, 'Skill', { skill: 'merge-fix-until-satisfied', args: 'PR 4' }, DAY)
    r = retroStart(r, 'Bash', { command: 'gh pr merge 4 --squash' }, DAY)
    r = retroStart(r, 'Bash', { command: 'gh pr merge 4 --squash' }, 2 * DAY)
    r = retroEnd(r, 'mcp__atlassian__addCommentToJiraIssue', marker('VC-3', 'plan'), 'ok')
    r = retroEnd(r, 'mcp__atlassian__addCommentToJiraIssue', marker('VC-3', 'rework'), 'ok')
    r = retroEnd(r, 'Agent', {}, 'blocked: no CI')
    r = retroEnd(r, 'Agent', {}, 'blocked: none')
    r = retroDrain(r, 3, 'DRAINED')
    expect(retroText(r, 2 * DAY)?.split('\n')).toEqual([
      'agile-mods loop data (recorded by the mod over 2 day(s); counts, not judgements):',
      '- tickets with phase markers: 1; with rework cycles: 1 (VC-3×1)',
      '- PRs through the merge train: 1; re-reviewed or re-fixed: 1 (#4 review×2 fix×1)',
      '- merge attempts retried: 1 (#4×2)',
      '- blocked agent receipts: 1',
      '- sprint drain: 3 pass(es), DRAINED',
    ])
  })

  test('nothing recorded means no block, and old stores load', () => {
    expect(retroText(EMPTY_RETRO, 0)).toBeUndefined()
    expect(loadRetro({ tickets: {} })).toEqual(EMPTY_RETRO)
  })
})

describe('links', () => {
  test('appear once the Jira site and GitHub repo are read off tool output', () => {
    let b = observeTool(EMPTY, 'mcp__atlassian__addCommentToJiraIssue', marker('VC-3', 'pr'), 'Comment added: https://acme.atlassian.net/browse/VC-3?focusedCommentId=1')
    expect(linksOf(b)).toEqual([{ label: 'VC-3 pr', href: 'https://acme.atlassian.net/browse/VC-3' }])
    b = observeTool(b, 'Bash', { command: 'gh pr create --title "VC-3 x"' }, 'https://github.com/acme/app/pull/4')
    expect(linksOf(b).at(-1)).toEqual({ label: 'PR #4 VC-3', href: 'https://github.com/acme/app/pull/4' })
  })
})
