import { describe, expect, test } from 'bun:test'
import { reviewedOf } from '../hooks/state/board.ts'
import { grantDenial, mergeDenial, mergeTargetOf, pushDenial } from '../hooks/state/guards.ts'

const SHA = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)

describe('grant backstop', () => {
  test('review-lens and pr-reviewer never edit or post', () => {
    expect(grantDenial('agile-execution:review-lens', 'Edit', {})).toContain('never edits')
    expect(grantDenial('agile-merge-review:pr-reviewer', 'Bash', { command: 'gh pr comment 4 --body x' })).toContain('never posts')
    expect(grantDenial('agile-merge-review:pr-reviewer', 'Bash', { command: 'gh api repos/o/r/issues/4/comments -X POST -f body=x' })).toContain('never posts')
    expect(grantDenial('agile-execution:review-lens', 'mcp__atlassian__addCommentToJiraIssue', {})).toContain('self-reviewer')
    expect(grantDenial('agile-execution:review-lens', 'Skill', { skill: 'agile-execution:implement-review' })).toContain('duplicate verdict')
  })

  test('reads stay allowed, and other agents are untouched', () => {
    expect(grantDenial('agile-merge-review:pr-reviewer', 'Bash', { command: 'gh pr view 4 --json headRefOid' })).toBeUndefined()
    expect(grantDenial('agile-merge-review:pr-reviewer', 'mcp__atlassian__getJiraIssue', {})).toBeUndefined()
    expect(grantDenial('agile-execution:build-implementer', 'Edit', {})).toBeUndefined()
  })

  test('jira-postmortem never creates issue links', () => {
    expect(grantDenial('agile-merge-review:jira-postmortem', 'mcp__atlassian__createIssueLink', {})).toContain('issue links')
    expect(grantDenial('agile-merge-review:jira-postmortem', 'mcp__atlassian__addCommentToJiraIssue', {})).toBeUndefined()
  })
})

describe('reviewed-sha gate', () => {
  test('reads the reviewed sha, the new one of a delta review', () => {
    expect(reviewedOf({ description: 'review PR #12' }, `## PR #12 Review — x\n\nReviewed sha: ${SHA}\n`)).toEqual({ pr: 12, sha: SHA })
    expect(reviewedOf({ prompt: 'PR 12' }, `Reviewed sha: ${OTHER}   (delta-review only: reviewed \`${SHA.slice(0, 7)}..${OTHER}\`)`)).toEqual({ pr: 12, sha: OTHER })
    expect(reviewedOf({ prompt: 'PR 12' }, 'no sha here')).toBeUndefined()
  })

  test('targets gh and MCP merges', () => {
    expect(mergeTargetOf('Bash', { command: 'gh pr merge 12 --squash' })).toEqual({ pr: 12 })
    expect(mergeTargetOf('Bash', { command: `gh pr merge 12 --squash --match-head-commit ${SHA}` })).toEqual({ pr: 12, head: SHA })
    expect(mergeTargetOf('mcp__github__merge_pull_request', { pullNumber: 12, expectedHeadSha: SHA })).toEqual({ pr: 12, head: SHA })
    expect(mergeTargetOf('Bash', { command: 'gh pr view 12' })).toBeUndefined()
  })

  test('a train merge needs a pinned head, the reviewed sha when known, and CI green twice', () => {
    const green = { id: 7, status: 'completed', conclusion: 'success', reads: 2 }
    expect(mergeDenial(12, undefined, SHA, green)).toContain('--match-head-commit')
    expect(mergeDenial(12, OTHER, SHA, green)).toContain('unreviewed code')
    expect(mergeDenial(12, SHA, undefined, undefined)).toContain('no CI run')
    expect(mergeDenial(12, SHA, SHA, { ...green, conclusion: 'failure' })).toContain('not completed/success')
    expect(mergeDenial(12, SHA, SHA, { ...green, status: 'in_progress', conclusion: undefined })).toContain('in_progress')
    expect(mergeDenial(12, SHA, SHA, { ...green, reads: 1 })).toContain('read green once')
    expect(mergeDenial(12, SHA.slice(0, 12), SHA, green)).toBeUndefined()
    expect(mergeDenial(12, SHA, undefined, green)).toBeUndefined()
  })
})

describe('push guard', () => {
  test('refuses a push to the base branch, by refspec or from it', () => {
    expect(pushDenial('git push origin main', 'feat')).toContain('main')
    expect(pushDenial('cd /w && git push origin HEAD:refs/heads/master', 'feat')).toContain('master')
    expect(pushDenial('git push', 'main')).toContain('main')
    expect(pushDenial('git push origin HEAD', 'main')).toContain('main')
  })

  test('refuses a force push without a lease', () => {
    expect(pushDenial('git push --force origin feat', 'feat')).toContain('lease')
    expect(pushDenial('git push -uf origin feat', 'feat')).toContain('lease')
    expect(pushDenial('git push --force-with-lease origin feat', 'feat')).toBeUndefined()
  })

  test('a feature push passes', () => {
    expect(pushDenial('git push -u origin feat/VC-3', 'feat/VC-3')).toBeUndefined()
    expect(pushDenial('git -C /w push', 'feat')).toBeUndefined()
  })
})
