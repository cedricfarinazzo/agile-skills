import { describe, expect, test } from 'bun:test'
import { covers, END, readsOf, unreadFiles, withReads } from '../../hooks/state/review.ts'
import { guardedCall } from '../../hooks/guards.ts'
import { sideDoorDenial, budgetDenial, FIX_ROUNDS, fixDenial, grantDenial, isBuildWork, isFixDispatch, mergeDenial, mergeTargetOf, pushDenial, pushPlanOf, ruleOf } from '../../hooks/state/guards.ts'

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
    expect(readsOf(`git show ${SHA}:a.ts | head -40`)).toEqual([{ sha: SHA, path: 'a.ts', range: [1, 40] }])
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
      `true; ${show}; x`,
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
    // one file piped first into a line-range filter is a ranged read
    expect(readsOf(`git show ${SHA}:a.ts | sed -n 10,90p | nl`)).toEqual([{ sha: SHA, path: 'a.ts', range: [10, 90] }])
    expect(readsOf(`git show ${SHA}:a.ts | tail -n +500`)).toEqual([{ sha: SHA, path: 'a.ts', range: [500, END] }])
    expect(readsOf(`git show ${SHA}:a.ts ${SHA}:b.ts | head -n 9`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | head -n 9 | grep x`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | head -n -5`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | sed -n '1,400p'`)).toEqual([{ sha: SHA, path: 'a.ts', range: [1, 400] }])
    expect(readsOf(`git show ${SHA}:a.ts | sed -n '1,4p;9p'`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | head -n5`)).toEqual([{ sha: SHA, path: 'a.ts', range: [1, 5] }])
    expect(readsOf(`git show ${SHA}:a.ts | sed -n 50,10p`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | sed -n 0,10p`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | sed -n 1,9p\;20,30p`)).toEqual([])
    expect(covers([[1, 100], [101, 149], [150, END]], 400)).toBe(true)
    expect(covers([[1, 100], [102, 400]], 400)).toBe(false)
    expect(covers([[1, 300]], 400)).toBe(false)
    // reads joined by ; with echo separators, and a range after cat -n
    expect(readsOf(`${show}; echo '----'; git show ${SHA}:b.ts`)).toEqual([{ sha: SHA, path: 'a.ts' }, { sha: SHA, path: 'b.ts' }])
    expect(readsOf(`git show ${SHA}:a.ts | cat -n | sed -n 100,220p`)).toEqual([{ sha: SHA, path: 'a.ts', range: [100, 220] }])
    expect(readsOf(`${show}; echo "$x"`)).toEqual([])
    expect(readsOf(`${show}; rm -rf x`)).toEqual([])
    expect(readsOf(`git show ${SHA}:a.ts | head -n 9 | tail -n +3`)).toEqual([])
    // a leading cd picks the repository; the full sha still names the object
    expect(readsOf(`cd /w/repo && ${show}`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`cd /w/repo; ${show}`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`cd /w; ${show}; gh pr merge 1`)).toEqual([])
    expect(readsOf(`cd $D && ${show}`)).toEqual([])
    expect(readsOf(`gh pr diff 1 --name-only && ${show}`)).toEqual([])
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
  const rounds = { ids: ['agent:f1', 'loop::4', 'loop:s1:9'], heads: ['1'.repeat(40), '2'.repeat(40), '3'.repeat(40)] }

  test('a new round passes under the cap; a counted round pushes again freely', () => {
    expect(FIX_ROUNDS).toBe(3)
    expect(fixDenial(7, undefined, 'agent:x')).toBeUndefined()
    expect(fixDenial(7, { ids: rounds.ids.slice(0, 2), heads: rounds.heads.slice(0, 2) }, 'agent:x')).toBeUndefined()
    expect(fixDenial(7, rounds, 'loop::4')).toBeUndefined()
  })

  test('a fourth round is refused and sent to 3d', () => {
    const deny = fixDenial(7, rounds, 'agent:f9')!
    expect(deny).toContain('3 fix rounds already pushed (onto 1111111, 2222222, 3333333)')
    expect(deny).toContain('take 3d')
    expect(ruleOf(deny)).toBe('fix')
  })

  test('3c dispatches, by agent or inline', () => {
    expect(isFixDispatch('Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied' })).toBe(true)
    expect(isFixDispatch('Skill', { skill: 'agile-merge-review:merge-fix-until-satisfied' })).toBe(true)
    expect(isFixDispatch('Skill', { skill: 'fix-until-satisfied-ish' })).toBe(false)
  })

  test('main and force are read from the words the shell resolves, and +ref is a force push', () => {
    expect(pushDenial('cd /w; git push origin m\\ain', 'a')).toContain('never pushes to main')
    expect(pushDenial("cd /w; git push origin 'ma''in'", 'a')).toContain('never pushes to main')
    expect(pushDenial('cd /w\ngit push origin feat/a\ngit push origin main', 'a')).toContain('never pushes to main')
    expect(pushDenial('git push origin +feat/a', 'a')).toContain('force-pushes')
    expect(pushDenial('git push --force-with-lease origin +HEAD:feat/a', 'feat/a')).toBeUndefined()
    expect(pushDenial('git push origin feat/a 2>&1 | tail -2', 'a')).toBeUndefined()
  })

  test('a failed read joined by ; credits nothing', () => {
    const SHA = 'a'.repeat(40)
    expect(withReads({}, `git show ${SHA}:a.ts; git show ${SHA}:b.ts`, "fatal: path 'a.ts' does not exist\nb text")).toEqual({})
    expect(withReads({}, `git show ${SHA}:a.ts; git show ${SHA}:b.ts`, 'a text\nb text')).toEqual({ [SHA]: ['a.ts', 'b.ts'] })
  })

  test('gh options before the subcommand, and a graphql read beside $ and @ elsewhere on the line', () => {
    expect(sideDoorDenial('Bash', { command: 'R=o/r; gh -R $R run view 1 --log-failed | grep x' })).toBeUndefined()
    expect(sideDoorDenial('Bash', { command: 'gh --repo o/r pr view 1' })).toBeUndefined()
    expect(sideDoorDenial('Bash', { command: 'gh -R o/r myalias' })).toContain('gh myalias')
    expect(sideDoorDenial('Bash', { command: `gh api graphql -f query='query{repository(owner:"o",name:"r"){id}}' > x.json; grep -c '@' x.json; echo $?` })).toBeUndefined()
    expect(sideDoorDenial('Bash', { command: `gh api graphql -f query='mutation{deleteRef(input:{refId:"x"}){clientMutationId}}' > x; echo $?` })).toContain('GraphQL')
    expect(sideDoorDenial('Bash', { command: `Q='mutation{deleteRef(input:{refId:"x"}){clientMutationId}}'; gh api graphql -f query="$Q"` })).toContain('GraphQL')
  })

  test('what a push sends where, or why it cannot be read', () => {
    expect(pushPlanOf('git push origin VC-1-auth')).toEqual({ refs: [{ src: 'VC-1-auth', dst: 'VC-1-auth' }] })
    expect(pushPlanOf('cd /w && git -C /x push -u origin "feat/x"')).toEqual({ dir: '/x', refs: [{ src: 'feat/x', dst: 'feat/x' }] })
    expect(pushPlanOf('cd /w && git push --force-with-lease origin +HEAD:refs/heads/feat/y')).toEqual({ dir: '/w', refs: [{ src: 'HEAD', dst: 'feat/y' }] })
    expect(pushPlanOf('git push')).toEqual({ refs: [] })
    expect(pushPlanOf('git push origin a b')).toEqual({ refs: [{ src: 'a', dst: 'a' }, { src: 'b', dst: 'b' }] })
    expect(pushPlanOf('git add -A && git commit -m "x; $y" && git push origin a')).toEqual({ refs: [{ src: 'a', dst: 'a' }], commits: true })
    // commit and push in one command: read, and always a round
    expect(pushPlanOf("git commit -m 'x; y && z' && git push origin a")).toEqual({ refs: [{ src: 'a', dst: 'a' }], commits: true })
    expect(pushPlanOf(`cd /w && git branch --show-current && git add -A && git commit -q -m "$(cat <<'EOF'\nfix: a; b $(x) && git push origin main\nEOF\n)" && git push -u origin a 2>&1 | tail -2`)).toEqual({ dir: '/w', refs: [{ src: 'a', dst: 'a' }], commits: true })
    expect(pushPlanOf(`git commit -F - <<'EOF'\nmsg; $(rm -rf x)\nEOF\ngit push origin a`)).toEqual({ refs: [{ src: 'a', dst: 'a' }], commits: true })
    expect(pushPlanOf(`git commit -m "$(cat <<EOF\n$(date)\nEOF\n)" && git push origin a`)).toEqual({ refs: [{ src: 'a', dst: 'a' }], commits: true })
    expect(pushPlanOf(`git commit -F - <<'EOF' && git push origin a\nmsg; $(rm x)\nEOF`)).toEqual({ refs: [{ src: 'a', dst: 'a' }], commits: true })
    // a script: each push read on its own when it names its branch, always a round
    expect(pushPlanOf(`cd /w; npm test 2>&1 | tail -1; git add -A && git commit -qm "x" && git push -q -u origin feat/a 2>&1 | tail -1; echo done`)).toEqual({ refs: [{ src: 'feat/a', dst: 'feat/a' }], commits: true })
    // a word after a redirection is still a ref
    expect(pushPlanOf(`cd /w; git push origin a 2>/dev/null b; echo`)).toEqual({ refs: [{ src: 'a', dst: 'a' }, { src: 'b', dst: 'b' }], commits: true })
    expect(pushPlanOf(`cd /w; git push origin a > log b; echo`)).toEqual({ refs: [{ src: 'a', dst: 'a' }, { src: 'b', dst: 'b' }], commits: true })
    expect(pushPlanOf(`cd /w; git push -q; echo $?`)).toEqual({ dir: '/w', refs: [], commits: true })
    expect(pushPlanOf(`cd /w; git checkout b; git push -q`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf(`cd /w; gh pr checkout 12; git push`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf(`cd /w; gh pr co 12; git push origin HEAD`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf(`cd /w; cd x; git push`)).toEqual({ dir: '/w/x', refs: [], commits: true })
    expect(pushPlanOf(`cd /w/a/b; npm test; cd ..; git branch --show-current; git push -q; cd /`)).toEqual({ dir: '/w/a/b/..', refs: [], commits: true })
    expect(pushPlanOf(`for d in a b; do cd $d; git push; done`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf(`(cd x; true); git push`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf(`cd /w; git push origin HEAD; echo`)).toEqual({ dir: '/w', refs: [], commits: true })
    expect(pushPlanOf(`B=feat/a; git push origin $B`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf(`cd /w; git push origin --delete m/a m/b`)).toEqual({ refs: [{ src: '', dst: 'm/a' }, { src: '', dst: 'm/b' }], commits: true })
    expect(pushPlanOf(`cd /w; G=git; $G push origin x; git push origin y`)).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf('git checkout b && git push origin b')).toEqual({ refs: [{ src: 'b', dst: 'b' }], commits: true })
    expect(pushPlanOf('git checkout b && git push')).toEqual({ error: 'only a cd, git add, git commit or a git read may run before a push in the same command' })
    expect(pushPlanOf('git reset --hard x && git push origin b')).toEqual({ refs: [{ src: 'b', dst: 'b' }], commits: true })
    expect(pushPlanOf('git push origin a && git log -1')).toEqual({ refs: [{ src: 'a', dst: 'a' }] })
    expect(pushPlanOf('git push -o ci.skip origin a')).toEqual({ error: 'the push option -o is not read' })
    expect(pushPlanOf('git push --all origin')).toEqual({ error: 'the push option --all is not read' })
    expect(pushPlanOf('cd w; git push')).toEqual({ dir: 'w', refs: [], commits: true })
    expect(pushPlanOf('git push origin --delete feat/x')).toEqual({ refs: [{ src: 'feat/x', dst: 'feat/x' }], delete: true })
    // what the push prints, merged and trimmed, changes nothing it sends
    expect(pushPlanOf('cd /w && git push origin a 2>&1 | tail -2')).toEqual({ dir: '/w', refs: [{ src: 'a', dst: 'a' }] })
    expect(pushPlanOf('git push origin a | tail -n 5')).toEqual({ refs: [{ src: 'a', dst: 'a' }] })
    expect(pushPlanOf('git push origin a 2>&1 | head -2')).toEqual({ error: 'a push in the loop is one plain command' })
    expect(pushPlanOf('git push origin a | tee log')).toEqual({ refs: [{ src: 'a', dst: 'a' }], commits: true })
    expect(pushPlanOf('git push origin a 2>&1 | tail -2; git push origin main')).toEqual({ refs: [{ src: 'a', dst: 'a' }, { src: 'main', dst: 'main' }], commits: true })
    expect(pushDenial('git push origin a 2>&1 | tail -2; git push origin main', 'a')).toContain('never pushes to main')
    expect(pushPlanOf('GIT_TRACE=1 git push origin a')).toEqual({ error: 'a push in the loop runs git directly, with no prefix' })
  })
})

describe('fail closed', () => {
  test('a call a guard covers is told apart from the call alone, for a hook that could not run', () => {
    const covered: [string, Record<string, unknown>][] = [
      ['Bash', { command: 'gh pr merge 7 --squash' }], ['Bash', { command: 'cd /w && git push origin x' }], ['Bash', { command: 'gh api -X PUT repos/o/r/contents/a' }],
      ['Bash', { command: 'gh pr comment 7 -b x' }], ['Edit', {}], ['Write', {}], ['NotebookEdit', {}], ['mcp__github__merge_pull_request', { pullNumber: 7 }],
      ['mcp__github__push_files', {}], ['mcp__atlassian__transitionJiraIssue', {}], ['mcp__atlassian__addCommentToJiraIssue', {}],
    ]
    for (const [tool, args] of covered) expect(guardedCall(tool, args)).toBe(true)
    const free: [string, Record<string, unknown>][] = [['Read', {}], ['Bash', { command: 'git status' }], ['mcp__atlassian__getJiraIssue', {}], ['Skill', { skill: 'agile-10-implement' }]]
    for (const [tool, args] of free) expect(guardedCall(tool, args)).toBe(false)
  })
})

describe('budget stop', () => {
  test('past the budget, build work is refused and the merge side is not', () => {
    const impl = { skill: 'agile-execution:agile-10-implement' }
    expect(budgetDenial(19.99, 20, 'Skill', impl)).toBeUndefined()
    expect(budgetDenial(25, 0, 'Skill', impl)).toBeUndefined()
    const deny = budgetDenial(20, 20, 'Skill', impl)!
    expect(deny).toBe('agile-mods: budget: the loop spent $20.00 of its $20.00 budget (agile-mods budgetUsd). Start no build work: merge what is open, then stop and report BUDGET.')
    expect(ruleOf(deny)).toBe('budget')
    expect(budgetDenial(25, 20, 'Skill', { skill: 'agile-merge-review:agile-11-merge-train' })).toBeUndefined()
    expect(budgetDenial(25, 20, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer' })).toBeUndefined()
    expect(budgetDenial(25, 20, 'Agent', { subagent_type: 'agile-sprint-drain:merge-session' })).toBeUndefined()
  })

  test('build work: an implement run or phase, opening a PR, any agent but the merge side and read-only types', () => {
    for (const skill of ['implement-validate', 'agile-execution:implement-plan', 'implement-code']) expect(isBuildWork('Skill', { skill })).toBe(true)
    for (const t of ['agile-execution:build-implementer', 'agile-sprint-drain:build-session', 'general-purpose', 'claude', 'fork', 'code-simplifier:code-simplifier', '']) expect(isBuildWork('Agent', { subagent_type: t })).toBe(true)
    for (const t of ['Explore', 'Plan', 'agile-merge-review:fix-until-satisfied', 'agile-sprint-drain:merge-session']) expect(isBuildWork('Agent', { subagent_type: t })).toBe(false)
    expect(isBuildWork('Bash', { command: 'gh pr create --fill' })).toBe(true)
    expect(isBuildWork('mcp__github__create_pull_request', {})).toBe(true)
    expect(isBuildWork('Bash', { command: 'gh api -X POST repos/o/r/pulls -f head=x' })).toBe(true)
    expect(isBuildWork('Bash', { command: 'gh api repos/o/r/pulls/7/comments/9/replies -f body=x' })).toBe(false)
    expect(isBuildWork('Skill', { skill: 'merge-review-pr' })).toBe(false)
    expect(isBuildWork('Bash', { command: 'git push' })).toBe(false)
  })
})
