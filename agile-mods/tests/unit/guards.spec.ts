import { describe, expect, test } from 'bun:test'
import { readsOf, unreadFiles, withReads } from '../../hooks/state/review.ts'
import { budgetDenial, FIX_ROUNDS, fixDenial, grantDenial, isFixDispatch, isNewBuild, mergeDenial, mergeTargetOf, pushDenial, ruleOf } from '../../hooks/state/guards.ts'

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

describe('fix-round cap', () => {
  const heads = ['1'.repeat(40), '2'.repeat(40), '3'.repeat(40)]

  test('3c on a new head passes under the cap, a re-dispatch on a counted head always passes', () => {
    expect(FIX_ROUNDS).toBe(3)
    expect(fixDenial(7, heads.slice(0, 2), '9'.repeat(40))).toBeUndefined()
    expect(fixDenial(7, heads, heads[1]!)).toBeUndefined()
  })

  test('a fourth head is refused and sent to 3d', () => {
    const deny = fixDenial(7, heads, '9'.repeat(40))!
    expect(deny).toContain('3 fix rounds already (3c on 1111111, 2222222, 3333333)')
    expect(deny).toContain('take 3d')
    expect(ruleOf(deny)).toBe('fix')
  })

  test('3c dispatches, by agent or inline', () => {
    expect(isFixDispatch('Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied' })).toBe(true)
    expect(isFixDispatch('Skill', { skill: 'agile-merge-review:merge-fix-until-satisfied' })).toBe(true)
    expect(isFixDispatch('Skill', { skill: 'fix-until-satisfied-ish' })).toBe(false)
  })
})

describe('budget stop', () => {
  test('past the budget, new build work is refused and the merge train is not', () => {
    const impl = { skill: 'agile-execution:agile-10-implement' }
    expect(budgetDenial(19.99, 20, 'Skill', impl)).toBeUndefined()
    expect(budgetDenial(25, 0, 'Skill', impl)).toBeUndefined()
    const deny = budgetDenial(20, 20, 'Skill', impl)!
    expect(deny).toBe('budget: the loop spent $20.00 of its $20.00 budget (agile-mods budgetUsd). Start no new build work: merge what is open, then stop and report BUDGET.')
    expect(ruleOf(`agile-mods: ${deny}`)).toBe('budget')
    expect(budgetDenial(25, 20, 'Skill', { skill: 'agile-merge-review:agile-11-merge-train' })).toBeUndefined()
    expect(budgetDenial(25, 20, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer' })).toBeUndefined()
  })

  test('new build work: an implement run, or the first phase of a ticket', () => {
    expect(isNewBuild('Skill', { skill: 'implement-validate' })).toBe(true)
    expect(isNewBuild('Agent', { subagent_type: 'agile-execution:ticket-validator' })).toBe(true)
    expect(isNewBuild('Agent', { subagent_type: 'agile-execution:build-implementer' })).toBe(false)
  })
})
