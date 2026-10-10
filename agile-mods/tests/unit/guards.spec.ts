import { describe, expect, test } from 'bun:test'
import { readsOf, unreadFiles, withReads } from '../../hooks/state/review.ts'
import { grantDenial, mergeDenial, mergeTargetOf, pushDenial } from '../../hooks/state/guards.ts'

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

describe('review coverage', () => {
  test('counts whole git show and cat-file reads, not partial or computed ones', () => {
    expect(readsOf(`git show ${SHA}:src/a.ts && git -C /w show ${SHA}:./b.ts | cat -n`)).toEqual([{ sha: SHA, path: 'src/a.ts' }, { sha: SHA, path: 'b.ts' }])
    expect(readsOf(`git cat-file -p ${SHA}:c.ts`)).toEqual([{ sha: SHA, path: 'c.ts' }])
    expect(readsOf(`git show ${SHA}:a.ts | head -40`)).toEqual([])
    expect(readsOf(`git show $SHA:a.ts; git show ${SHA}:$f`)).toEqual([])
    expect(readsOf(`cat src/a.ts`)).toEqual([])
  })

  test('counts nothing the shell could run differently from the parser', () => {
    const show = `git show ${SHA}:a.ts`
    for (const command of [
      `${show} > /dev/null`,
      `${show} 2>/dev/null`,
      `echo "x && ${show}"`,
      `false || ${show}`,
      `true; ${show}`,
      `false\n${show}`,
      `${show} &`,
      `(${show})`,
      `x=$(${show})`,
      `# ${show}`,
      `git show --stat ${SHA}:a.ts`,
      `git show ${SHA}:a.ts ${SHA}:b.ts --name-only`,
      `${show} | wc -l`,
      `git show ${SHA.slice(0, 12)}:a.ts`,
    ]) expect(readsOf(command)).toEqual([])
    expect(readsOf(`${show} && git show ${SHA}:b.ts | nl`)).toEqual([{ sha: SHA, path: 'a.ts' }, { sha: SHA, path: 'b.ts' }])
  })

  test('a file is read when shown at the head, or at an ancestor with no change since', () => {
    const reads = withReads(withReads({}, `git show ${SHA}:a.ts ${SHA}:b.ts`, ''), `git show ${OTHER}:b.ts`, '')
    expect(unreadFiles(reads, OTHER, ['a.ts', 'b.ts'], { [SHA]: ['b.ts'] })).toEqual([])
    expect(unreadFiles(reads, OTHER, ['a.ts', 'b.ts'], { [SHA]: ['a.ts', 'b.ts'] })).toEqual(['a.ts'])
    expect(unreadFiles(reads, OTHER, ['a.ts', 'b.ts'], { [SHA]: undefined })).toEqual(['a.ts'])
  })

  test('the same read twice keeps one entry', () => {
    const once = withReads({}, `git show ${SHA}:a.ts`, '')
    expect(withReads(once, `git show ${SHA}:a.ts`, '')).toBe(once)
  })
})

describe('3f merge gates', () => {
  test('targets gh and MCP merges, on any server name', () => {
    expect(mergeTargetOf('Bash', { command: 'gh pr merge 12 --squash' })).toEqual({ pr: 12 })
    expect(mergeTargetOf('Bash', { command: `gh pr merge 12 --squash --match-head-commit ${SHA}` })).toEqual({ pr: 12, head: SHA })
    expect(mergeTargetOf('mcp__github__merge_pull_request', { pullNumber: 12, expectedHeadSha: SHA })).toEqual({ pr: 12, head: SHA })
    expect(mergeTargetOf('mcp__gh2__merge_pull_request', { pullNumber: 12 })).toEqual({ pr: 12 })
    expect(mergeTargetOf('Bash', { command: 'gh pr view 12' })).toBeUndefined()
  })

  test('a merge needs a pin on the live head, green CI on it, and every file read', () => {
    const live = { headRefOid: SHA, state: 'OPEN' }
    const ci = { state: 'green' as const }
    expect(mergeDenial(12, undefined, {})).toContain('--match-head-commit')
    expect(mergeDenial(12, SHA, {})).toContain('could not read the PR')
    expect(mergeDenial(12, OTHER, { live })).toContain('is not the PR head')
    expect(mergeDenial(12, SHA, { live, ci: { state: 'none' } })).toContain('no CI run')
    expect(mergeDenial(12, SHA, { live, ci: { state: 'red', detail: 'ci failure' } })).toContain('red (ci failure)')
    expect(mergeDenial(12, SHA, { live, ci })).toContain("could not list the PR's files")
    expect(mergeDenial(12, SHA, { live, ci, unread: ['a', 'b', 'c', 'd', 'e', 'f'] })).toContain('a, b, c, d, e and 1 more')
    expect(mergeDenial(12, SHA.slice(0, 12), { live, ci, unread: [] })).toBeUndefined()
    expect(mergeDenial(12, SHA, { live: { headRefOid: OTHER, state: 'MERGED' } })).toBeUndefined()
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
