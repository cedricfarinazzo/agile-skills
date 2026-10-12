import { describe, expect, test } from 'bun:test'
import { covers, END, howRead, parseReads, planChunks, readsOf, withReads, type Change } from '../../hooks/state/review.ts'
import { configOf, limitsLine, modesLine, repoConfigOf, tightened } from '../../hooks/state/config.ts'
import { allow, ticketBudgetOpen, openOf, take3f, takeFix, BYPASS_MS } from '../../hooks/state/bypass.ts'
import { guardedCall } from '../../hooks/guards.ts'
import { sideDoorDenial, prHeadOf, ticketBudgetDenial, type TicketCapInput, FIX_ROUNDS, fixDenial, grantDenial, isBuildWork, isFixDispatch, mergeDenial, mergeProblems, mergeTargetOf, pushDenial, pushPlanOf, ruleOf } from '../../hooks/state/guards.ts'

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
    expect(readsOf(`git show ${SHA}:src/a.ts && git -C /w show ${SHA}:b.ts | cat -n`)).toEqual([{ sha: SHA, path: 'src/a.ts' }, { sha: SHA, path: 'b.ts' }])
    // ./ and ../ are read by git from the current directory, not the repo root
    expect(parseReads(`cd pkg && git show ${SHA}:./index.ts`).skipped[0]).toContain('relative to the current directory')
    // a quoted spec, and brackets, as git gets them; a size check is not a read and says nothing
    expect(readsOf(`git show '${SHA}:app/(shop)/$id.tsx' && git show ${SHA}:app/[id]/page.tsx`)).toEqual([{ sha: SHA, path: 'app/(shop)/$id.tsx' }, { sha: SHA, path: 'app/[id]/page.tsx' }])
    expect(parseReads(`git show ${SHA}:a.ts | wc -c`).skipped).toEqual([])
    expect(readsOf(`git cat-file -p ${SHA}:c.ts`)).toEqual([{ sha: SHA, path: 'c.ts' }])
    expect(readsOf(`git show ${SHA}:a.ts | head -40`)).toEqual([{ sha: SHA, path: 'a.ts', range: [1, 40] }])
    expect(readsOf(`git show $SHA:a.ts; git show ${SHA}:$f`)).toEqual([])
    // a sha set in a variable on the line reads as that sha; an abbreviated one is kept for the hook to resolve
    expect(readsOf(`S=${SHA}; git show $S:a.ts && git show \${S}:b.ts`)).toEqual([{ sha: SHA, path: 'a.ts' }, { sha: SHA, path: 'b.ts' }])
    expect(readsOf(`git show ${SHA.slice(0, 8)}:a.ts`)).toEqual([{ sha: SHA.slice(0, 8), path: 'a.ts' }])
    expect(readsOf(`cat src/a.ts`)).toEqual([])
  })

  test('counts nothing the shell could run differently from the parser', () => {
    const show = `git show ${SHA}:a.ts`
    for (const command of [
      `${show} > /dev/null`,
      `${show} 2>/dev/null`,
      `echo "x && ${show}"`,
      `false || ${show}`,
      `${show} &`,
      `(${show})`,
      `x=$(${show})`,
      `# ${show}`,
      `git show --stat ${SHA}:a.ts`,
      `git show ${SHA}:a.ts ${SHA}:b.ts --name-only`,
      `${show} | wc -l`,
      `git show ${SHA.slice(0, 6)}:a.ts`,
      // a read after && runs only if the command before it succeeded, which the guard cannot see
      `gh pr diff 1 --name-only && ${show}`,
      `cat <<EOF\n${show}\nEOF`,
    ]) expect(readsOf(command)).toEqual([])
    // each read in a chain counts on its own; other commands on the line are left out
    expect(readsOf(`true; ${show}; x`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`false\n${show}`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`git diff origin/main -- x; echo ----; ${show}; gh run view 1 --log | grep x`)).toEqual([{ sha: SHA, path: 'a.ts' }])
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
    // the shell splits at the ; too: lines 1-9 were shown, and `20,30p` is a command of its own
    expect(readsOf(`git show ${SHA}:a.ts | sed -n 1,9p\;20,30p`)).toEqual([{ sha: SHA, path: 'a.ts', range: [1, 9] }])
    expect(covers([[1, 100], [101, 149], [150, END]], 400)).toBe(true)
    expect(covers([[1, 100], [102, 400]], 400)).toBe(false)
    expect(covers([[1, 300]], 400)).toBe(false)
    // reads joined by ; with echo separators, and a range after cat -n
    expect(readsOf(`${show}; echo '----'; git show ${SHA}:b.ts`)).toEqual([{ sha: SHA, path: 'a.ts' }, { sha: SHA, path: 'b.ts' }])
    expect(readsOf(`git show ${SHA}:a.ts | cat -n | sed -n 100,220p`)).toEqual([{ sha: SHA, path: 'a.ts', range: [100, 220] }])
    expect(readsOf(`${show}; echo "$x"`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`${show}; rm -rf x`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`git show ${SHA}:a.ts | head -n 9 | tail -n +3`)).toEqual([])
    // a leading cd picks the repository; the full sha still names the object
    expect(readsOf(`cd /w/repo && ${show}`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`cd /w/repo; ${show}`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`cd /w; ${show}; gh pr merge 1`)).toEqual([{ sha: SHA, path: 'a.ts' }])
    expect(readsOf(`cd $D && ${show}`)).toEqual([])
    expect(parseReads(`cd /w/repo && git -C /x show ${SHA}:a.ts; ${show}`).reads.map(r => r.dir)).toEqual(['/x', '/w/repo'])
  })

  test('a diff counts when it shows every changed line between two shas', () => {
    expect(parseReads(`git diff ${SHA}..${OTHER}`).diffs).toEqual([{ from: SHA, to: OTHER }])
    expect(parseReads(`git -C /w diff -U20 ${SHA.slice(0, 8)} ${OTHER} -- a.ts b.ts | cat`).diffs).toEqual([{ from: SHA.slice(0, 8), to: OTHER, paths: ['a.ts', 'b.ts'], dir: '/w' }])
    for (const flag of ['--stat', '--name-only', '--name-status', '--shortstat', '-w', '--ignore-all-space', '--diff-filter=M']) {
      const parsed = parseReads(`git diff ${flag} ${SHA}..${OTHER}`)
      expect(parsed.diffs).toEqual([])
      expect(parsed.skipped[0]).toContain('hides changed lines')
    }
    for (const command of [`git diff ${SHA}...${OTHER}`, `git diff origin/main..${OTHER}`, `git diff ${SHA}..${OTHER} | head -50`, `git diff ${SHA}..${OTHER} -- 'src/*'`]) {
      expect(parseReads(command).diffs).toEqual([])
    }
  })

  test('a part that names a sha and does not count says why', () => {
    expect(parseReads(`git show ${SHA}:a.ts | cut -c1-400`).skipped[0]).toContain('drops lines')
    expect(parseReads(`git show ${SHA}:a.ts > /tmp/x`).skipped[0]).toContain('not a plain read')
    expect(parseReads(`false || git show ${SHA}:a.ts`).skipped[0]).toContain('fails')
    expect(parseReads('ls && echo ok').skipped).toEqual([])
    // the shell ends at a comment, and an ANSI-C quote hides its escapes: nothing on such a line counts
    expect(readsOf(`echo x # ; git show ${SHA}:a.ts`)).toEqual([])
    expect(readsOf(`echo $'\\'; git show ${SHA}:a.ts'`)).toEqual([])
    // after a command that changes how the shell runs what follows, nothing counts
    for (const pre of ['set -e', 'set -o errexit', 'exec >/dev/null', 'trap x EXIT', 'alias git=x', 'git() { :; }', 'function git { :; }', 'eval x', 'source x', '. x', 'shopt -s expand_aliases']) {
      expect(readsOf(`${pre}; false; git show ${SHA}:a.ts`)).toEqual([])
    }
    // a variable or cd after a command that may have failed is not followed
    expect(readsOf(`false && S=${SHA}; git show $S:a.ts`)).toEqual([])
    expect(parseReads(`false && cd /x; git show ${SHA}:a.ts`).reads).toEqual([{ sha: SHA, path: 'a.ts' }])
  })

  test('the chunk plan keeps each chunk under the limit', () => {
    const text = Array.from({ length: 10 }, (_, i) => String(i).repeat(9)).join('\n') + '\n'
    expect(planChunks(text, 25)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]])
    expect(planChunks('x'.repeat(40) + '\ny\n', 25)).toEqual([[1, 1], [2, 2]])
  })

  test('a file counts in full, unchanged since a read, or by a diff since a read', async () => {
    const MID = 'c'.repeat(40)
    const changes: Record<string, Change[]> = {
      [`${SHA}..${MID}`]: [{ status: 'M', path: 'b.ts' }, { status: 'A', path: 'n.ts' }, { status: 'R', from: 'old.ts', path: 'r.ts' }],
      [`${MID}..${OTHER}`]: [{ status: 'M', path: 'b.ts' }],
      [`${SHA}..${OTHER}`]: [{ status: 'M', path: 'b.ts' }, { status: 'A', path: 'n.ts' }, { status: 'R', from: 'old.ts', path: 'r.ts' }],
    }
    const know = { changes: async (a: string, b: string) => changes[`${a}..${b}`], lines: async () => undefined, descends: async () => true }
    const reads = withReads({}, `git show ${SHA}:a.ts ${SHA}:b.ts ${SHA}:old.ts`, '')
    const at = (diffs: Record<string, { from: string; paths: string[] | '*' }[]>, sha: string, path: string) => howRead({ reads, parts: {}, diffs }, know, sha, path)
    // unchanged since a full read: carried, whatever the history
    expect(await at({}, OTHER, 'a.ts')).toBe('carried')
    expect(await at({}, OTHER, 'b.ts')).toBeUndefined()
    // changed: the diff from the read sha covers it; added and renamed files too
    const one = { [OTHER]: [{ from: SHA, paths: '*' as const }] }
    for (const f of ['a.ts', 'b.ts', 'n.ts', 'r.ts']) expect(await at(one, OTHER, f)).toBeTruthy()
    // a diff limited to other paths does not cover b.ts
    expect(await at({ [OTHER]: [{ from: SHA, paths: ['a.ts'] }] }, OTHER, 'b.ts')).toBeUndefined()
    // chained: SHA..MID then MID..OTHER
    const chain = { [MID]: [{ from: SHA, paths: '*' as const }], [OTHER]: [{ from: MID, paths: '*' as const }] }
    expect(await at(chain, OTHER, 'b.ts')).toBe('delta')
    expect(await at(chain, OTHER, 'n.ts')).toBe('delta')
    // a diff from a sha nobody read proves nothing
    expect(await at({ [OTHER]: [{ from: MID, paths: '*' as const }] }, OTHER, 'b.ts')).toBeUndefined()
    // off the head's history, an identical file carries only through a diff read from that sha
    const offHistory = { ...know, descends: async () => false }
    expect(await howRead({ reads, parts: {}, diffs: {} }, offHistory, OTHER, 'a.ts')).toBeUndefined()
    expect(await howRead({ reads, parts: {}, diffs: one }, offHistory, OTHER, 'a.ts')).toBe('delta')
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
    // after a fix, the refusal names the diff form; a session agent is told to read itself, with the chunk plan
    const unread = mergeDenial(12, SHA, { live, ci, unread: ['a'], plans: ['git show x:a | sed -n 1,9p · 10,20p'], inline: true })!
    expect(unread).toContain('git diff <reviewed sha>..<head>')
    expect(unread).toContain('sed -n 1,9p · 10,20p')
    expect(unread).toContain('read what is missing yourself (3b)')
  })

  test('each problem names its gate, and an unchecked gate is skipped', () => {
    const live = { headRefOid: SHA, state: 'OPEN' }
    expect(mergeProblems(12, undefined, { live, ci: { state: 'red', detail: 'x' }, unread: ['a'] }).map(p => p.gate)).toEqual(['mergePin', 'mergeCi', 'mergeReview'])
    expect(mergeProblems(12, undefined, { live, unread: [] }, { mergePin: false, mergeCi: false, mergeReview: true })).toEqual([])
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
  const rounds = { heads: ['1'.repeat(40), '2'.repeat(40), '3'.repeat(40)] }

  test('a new round passes under the cap, and a person can allow more', () => {
    expect(FIX_ROUNDS).toBe(3)
    expect(fixDenial(7, undefined)).toBeUndefined()
    expect(fixDenial(7, { heads: rounds.heads.slice(0, 2) })).toBeUndefined()
    expect(fixDenial(7, { ...rounds, extra: 1 })).toBeUndefined()
    expect(fixDenial(7, rounds, 0)).toBeUndefined()
    expect(fixDenial(7, rounds, 5)).toBeUndefined()
  })

  test('a fourth round is refused and sent to 3d', () => {
    const deny = fixDenial(7, rounds)!
    expect(deny).toContain('3 fix rounds already pushed after a review (onto 1111111, 2222222, 3333333)')
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

  test('a git error voids the reads it names, or every read when it names none', () => {
    const SHA = 'a'.repeat(40)
    expect(withReads({}, `git show ${SHA}:a.ts; git show ${SHA}:b.ts`, "fatal: path 'a.ts' does not exist\nb text")).toEqual({ [SHA]: ['b.ts'] })
    expect(withReads({}, `git show ${SHA}:a.ts; git show ${SHA}:b.ts`, 'fatal: bad object\nb text')).toEqual({})
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

describe('the branch a PR call opens', () => {
  test('--head, -H and a gh api head field, an owner prefix dropped; none when it names none', () => {
    expect(prHeadOf('Bash', { command: 'gh pr create --fill --head VC-3-cart' })).toBe('VC-3-cart')
    expect(prHeadOf('Bash', { command: 'gh pr create -H me:VC-3-cart --title x' })).toBe('VC-3-cart')
    expect(prHeadOf('Bash', { command: 'gh pr create --head="VC-3-cart"' })).toBe('VC-3-cart')
    expect(prHeadOf('Bash', { command: 'gh api -X POST repos/o/r/pulls -f head=VC-3-cart -f base=main' })).toBe('VC-3-cart')
    expect(prHeadOf('mcp__github__create_pull_request', { head: 'VC-3-cart' })).toBe('VC-3-cart')
    expect(prHeadOf('Bash', { command: 'gh pr create --fill' })).toBeUndefined()
  })
})

describe('ticket cap', () => {
  const impl = { skill: 'agile-execution:implement-code' }
  const costs: Record<string, number> = { 'VC-1': 12, 'VC-2': 3, 'VC-3': 20 }
  const input = (over: Partial<TicketCapInput> = {}): TicketCapInput => ({
    cost: k => costs[k] ?? 0,
    cap: 12,
    allowed: () => false,
    named: [],
    capped: ['VC-1', 'VC-3'],
    ...over,
  })

  test('a call naming a ticket at its cap is refused; the merge side and other tickets are not held', () => {
    expect(ticketBudgetDenial(input({ named: ['VC-2'] }), 'Skill', impl)).toBeUndefined()
    expect(ticketBudgetDenial(input({ cap: 0, named: ['VC-1'] }), 'Skill', impl)).toBeUndefined()
    const deny = ticketBudgetDenial(input({ named: ['VC-1'] }), 'Skill', impl)!
    expect(deny.text).toBe('agile-mods: ticket budget: VC-1 cost an estimated $12.00 of its $12.00 cap (agile-mods ticketBudgetUsd). Start no build work on it: report VC-1 as blocked (BUDGET) and go on with the other tickets; its open PR can still merge.')
    expect(deny.tickets).toEqual(['VC-1'])
    expect(ruleOf(deny.text)).toBe('ticketBudget')
    expect(ticketBudgetDenial(input({ named: ['VC-1'] }), 'Skill', { skill: 'agile-merge-review:agile-11-merge-train' })).toBeUndefined()
    expect(ticketBudgetDenial(input({ named: ['VC-1'] }), 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer' })).toBeUndefined()
    expect(ticketBudgetDenial(input({ named: ['VC-1'] }), 'Agent', { subagent_type: 'agile-sprint-drain:merge-session' })).toBeUndefined()
    expect(ticketBudgetDenial(input({ named: ['VC-1'] }), 'Bash', { command: 'gh pr create --fill' })?.tickets).toEqual(['VC-1'])
  })

  test('a call naming several tickets is held to each of them', () => {
    const deny = ticketBudgetDenial(input({ named: ['VC-1', 'VC-2'] }), 'Skill', impl)!
    expect(deny.tickets).toEqual(['VC-1'])
    const both = ticketBudgetDenial(input({ named: ['VC-1', 'VC-3', 'VC-2'] }), 'Agent', { subagent_type: 'agile-sprint-drain:build-session' })!
    expect(both.tickets).toEqual(['VC-1', 'VC-3'])
    expect(both.text).toContain('VC-1 ($12.00), VC-3 ($20.00)')
    expect(ticketBudgetDenial(input({ named: ['VC-1', 'VC-2'], allowed: k => k === 'VC-1' }), 'Skill', impl)).toBeUndefined()
  })

  test('naming another ticket is no way round: the agent\'s own ticket is held beside the named ones', () => {
    const deny = ticketBudgetDenial(input({ named: ['VC-2'], own: 'VC-1' }), 'Skill', impl)!
    expect(deny.tickets).toEqual(['VC-1'])
    expect(ticketBudgetDenial(input({ named: ['VC-2'], own: 'VC-2' }), 'Skill', impl)).toBeUndefined()
    // a person allowed VC-1: the decoy is no longer needed, and the call passes
    expect(ticketBudgetDenial(input({ named: ['VC-2'], own: 'VC-1', allowed: k => k === 'VC-1' }), 'Skill', impl)).toBeUndefined()
  })

  test('a call naming none is held to its agent\'s ticket, or refused while a ticket is over its cap', () => {
    expect(ticketBudgetDenial(input({ own: 'VC-1' }), 'Bash', { command: 'gh pr create --fill' })?.tickets).toEqual(['VC-1'])
    expect(ticketBudgetDenial(input({ own: 'VC-2' }), 'Bash', { command: 'gh pr create --fill' })).toBeUndefined()
    const none = ticketBudgetDenial(input(), 'Agent', { subagent_type: 'agile-execution:build-implementer', description: 'implement it' })!
    expect(none).toMatchObject({ tickets: [], named: false })
    expect(none.text).toContain('names no ticket, and VC-1, VC-3 are over the $12.00 cap')
    expect(ruleOf(none.text)).toBe('ticketBudget')
    // nothing is over its cap: a call naming none goes on
    expect(ticketBudgetDenial(input({ capped: [] }), 'Agent', { subagent_type: 'agile-execution:build-implementer' })).toBeUndefined()
    // a person allowed every ticket that is over
    expect(ticketBudgetDenial(input({ allowed: () => true }), 'Agent', { subagent_type: 'agile-execution:build-implementer' })).toBeUndefined()
    // the orchestrator names its tickets in every phase it runs
    expect(ticketBudgetDenial(input(), 'Skill', { skill: 'agile-execution:agile-10-implement' })).toBeUndefined()
    // the merge side and read-only agents are not build work
    expect(ticketBudgetDenial(input(), 'Agent', { subagent_type: 'Explore' })).toBeUndefined()
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

describe('guard config', () => {
  test('options are checked, and a bad value keeps its default with a note', () => {
    const { config, notes } = configOf({ guardMergeReview: 'warn', guardPush: 'off', fixRounds: '5', ticketBudgetUsd: -1, budgetUsd: 20, allowBypass: 'no' })
    expect(config.modes.mergeReview).toBe('warn')
    expect(config.modes.push).toBe('enforce')
    expect(config.fixRounds).toBe(5)
    expect(config.ticketBudgetUsd).toBe(0)
    expect(config.modes.ticketBudget).toBe('enforce')
    expect(config.allowBypass).toBe(true)
    expect(notes.join('\n')).toMatch(/guardPush.*enforce, warn/)
    expect(notes.length).toBe(4)
    expect(notes.join('\n')).toMatch(/budgetUsd was removed/)
    expect(modesLine(config)).toBe('mergeReview warn · the rest enforce')
    expect(modesLine(configOf({}).config)).toBe('all enforce')
    expect(modesLine(config)).not.toContain('ticketBudget')
    expect(limitsLine(config)).toBe('fixRounds 5 · ticket cap off · bypass on')
    expect(limitsLine(configOf({ ticketBudgetUsd: 8, guardTicketBudget: 'warn' }).config)).toBe('fixRounds 3 · ticket cap $8 (warn) · bypass on')
  })

  test('a repo only tightens', () => {
    const base = configOf({ guardMergeCi: 'warn', fixRounds: 3, ticketBudgetUsd: 20 }).config
    const repo = repoConfigOf('## Skill configuration\n- guardMergeCi: enforce\n- guardGrants: off\n- fixRounds: 5\n- ticketBudgetUsd = 10\n- guardTicketBudget: warn\n- allowBypass: false\n')
    const { config, notes } = tightened(base, repo)
    expect(config.modes.mergeCi).toBe('enforce')
    expect(config.modes.grants).toBe('enforce')
    expect(config.fixRounds).toBe(3)
    expect(config.ticketBudgetUsd).toBe(10)
    expect(config.modes.ticketBudget).toBe('enforce')
    expect(config.allowBypass).toBe(false)
    expect(notes.join('\n')).toMatch(/guardGrants: off is looser/)
    expect(notes.join('\n')).toMatch(/fixRounds: 5 is looser/)
    expect(tightened(configOf({ fixRounds: 0 }).config, { fixRounds: '2' }).config.fixRounds).toBe(2)
    expect(tightened(base, { fixRounds: '0' }).notes[0]).toContain('turn it off')
    // floored before it is compared: 0.5 cannot turn the cap off
    expect(tightened(base, { fixRounds: '0.5' }).config.fixRounds).toBe(3)
  })
})

describe('bypass', () => {
  test('a merge bypass covers one PR at its head, once, for 30 minutes', () => {
    const list = allow([], { rule: '3f', pr: 7, head: SHA }, 0)
    expect(take3f(list, 8, [SHA], 1)).toBeUndefined()
    expect(take3f(list, 7, [OTHER], 1)).toBeUndefined()
    expect(take3f(list, 7, [SHA.slice(0, 12)], 1)).toEqual([])
    expect(take3f(list, 7, [SHA], BYPASS_MS + 1)).toBeUndefined()
    expect(openOf(list, BYPASS_MS + 1, () => false)).toEqual([])
  })

  test('a fix bypass is one more round on that PR', () => {
    const list = allow([], { rule: 'fix', pr: 7 }, 0)
    expect(takeFix(list, 7, 1)).toEqual([])
    expect(takeFix(list, 9, 1)).toBeUndefined()
  })

  test('a ticket-cap bypass is that ticket\'s and lasts until it ends', () => {
    const list = allow([], { rule: 'ticketBudget', ticket: 'VC-1' }, 0)
    expect(ticketBudgetOpen(list, 'VC-1')).toBe(true)
    expect(ticketBudgetOpen(list, 'VC-2')).toBe(false)
    expect(openOf(list, BYPASS_MS * 10, () => false)).toBe(list)
    expect(openOf(list, 0, t => t === 'VC-1')).toEqual([])
  })
})
