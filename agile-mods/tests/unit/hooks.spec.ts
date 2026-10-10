import { beforeEach, describe, expect, test } from 'bun:test'
import { guardsAfter, guardsBefore, guardsReset, guardsStart } from '../../hooks/guards.ts'
import { receiptsAfter, receiptsCommand, receiptsStart } from '../../hooks/receipts.ts'
import { fakeHost, type Answers } from './fake-host.ts'

const OLD = 'a'.repeat(40)
const SHA = 'd'.repeat(40)
const OTHER = 'e'.repeat(40)
const skill = (name: string, args = '') => ['Skill', { skill: name, args }] as const
const done = (text: string | undefined) => ({ text, isError: false, denied: false })
const REVIEWER = { id: 'r1', type: 'agile-merge-review:pr-reviewer' }
const merge = (pin = SHA) => ({ command: `gh pr merge 7 --squash --match-head-commit ${pin}` })
const green = [{ databaseId: 3, headSha: SHA, status: 'completed', conclusion: 'success', workflowName: 'ci' }]

/** GitHub as the merge guard reads it: PR 7 open at SHA, CI green on it, two files. */
function github(over: Partial<Answers> = {}): Answers {
  return {
    agents: [REVIEWER, { id: 's1', type: 'agile-sprint-drain:merge-session' }, { id: 'f1', type: 'agile-merge-review:fix-until-satisfied' }],
    prView: { 7: { headRefOid: SHA, state: 'OPEN' } },
    runsOn: { [SHA]: green },
    prFiles: { 7: ['src/a.ts', 'src/b.ts'] },
    ...over,
  }
}

/** A reviewer agent's successful shell call. */
const read = (host: Parameters<typeof guardsAfter>[0], command: string, agent = 'r1', output = 'file text') => guardsAfter(host, 'Bash', { command }, agent, output)

describe('merge guard', () => {
  beforeEach(async () => {
    guardsReset()
    await guardsStart(fakeHost().host, '/repo')
  })

  test('merges are gated from the train skill on, and no answer text ends the gate; only reset does', async () => {
    const { host } = fakeHost(github())
    expect(await guardsBefore(host, 'Bash', { command: 'gh pr merge 7 --squash' }, undefined)).toBeUndefined()
    await guardsBefore(host, ...skill('agile-merge-review:agile-11-merge-train'), undefined)
    expect(await guardsBefore(host, 'Bash', { command: 'gh pr merge 7 --squash' }, undefined)).toContain('--match-head-commit')
    guardsReset()
    expect(await guardsBefore(host, 'Bash', { command: 'gh pr merge 7 --squash' }, undefined)).toBeUndefined()
  })

  test('a merge-review agent is gated even with no train skill seen in this session', async () => {
    const { host } = fakeHost(github())
    expect(await guardsBefore(host, 'Bash', merge(), 's1')).toContain('no review read 2 file(s)')
  })

  test('a pinned merge of a head every file of which a reviewer read, with green CI, passes', async () => {
    const { host, calls } = fakeHost(github())
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    await read(host, `git show ${SHA}:src/a.ts && git show ${SHA}:src/b.ts | cat -n`)
    expect(await guardsBefore(host, 'Bash', merge(), undefined)).toBeUndefined()
    expect(calls).toEqual(['gh pr view 7', 'gh run list --commit ddddddd', 'gh api pulls/7/files'])
  })

  test('a receipt naming a reviewed sha proves nothing: only the reads count', async () => {
    const { host } = fakeHost(github())
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    await receiptsAfter(host, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'PR #7' }, done(`Reviewed sha: ${SHA}`))
    expect(await guardsBefore(host, 'Bash', merge(), undefined)).toContain('no review read 2 file(s)')
  })

  test('reads by an agent that is not reviewing, partial reads and computed specs do not count', async () => {
    const { host } = fakeHost(github())
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    await read(host, `git show ${SHA}:src/a.ts`, 'f1')
    await read(host, `git show ${SHA}:src/a.ts | head -50`)
    await read(host, `for f in a b; do git show ${SHA}:src/$f.ts; done`)
    await guardsAfter(host, 'Bash', { command: `git show ${SHA}:src/b.ts` }, 'r1', undefined)
    await read(host, `git show ${SHA}:src/b.ts`, 'r1', '<persisted-output>\nOutput too large (146.5KB).')
    await read(host, `git show ${SHA}:src/b.ts`, 'r1', 'x'.repeat(30_001))
    expect(await guardsBefore(host, 'Bash', merge(), undefined)).toContain('src/a.ts, src/b.ts')
  })

  test('an inline merge-review-pr counts its loop reads until that loop invokes the next skill', async () => {
    const { host } = fakeHost(github())
    await guardsBefore(host, ...skill('agile-merge-review:merge-review-pr', 'PR 7'), 's1')
    await read(host, `git show ${SHA}:src/a.ts`, 's1')
    await guardsBefore(host, ...skill('agile-merge-review:merge-fix-until-satisfied', 'PR 7'), 's1')
    await read(host, `git show ${SHA}:src/b.ts`, 's1')
    expect(await guardsBefore(host, 'Bash', merge(), 's1')).toContain('1 file(s) as they land')
  })

  test('a delta review: files unchanged since an earlier read sha the head descends from stay read', async () => {
    const { host } = fakeHost(github({ compare: { [`${OLD}...${SHA}`]: { status: 'ahead', files: ['src/b.ts'] } } }))
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    await read(host, `git show ${OLD}:src/a.ts ${OLD}:src/b.ts`)
    expect(await guardsBefore(host, 'Bash', merge(), undefined)).toContain(': src/b.ts.')
    await read(host, `git show ${SHA}:src/b.ts`)
    expect(await guardsBefore(host, 'Bash', merge(), undefined)).toBeUndefined()
  })

  test('a rebase that rewrote the history voids the older reads', async () => {
    const { host } = fakeHost(github({ compare: { [`${OLD}...${SHA}`]: { status: 'diverged', files: [] } } }))
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    await read(host, `git show ${OLD}:src/a.ts ${OLD}:src/b.ts`)
    expect(await guardsBefore(host, 'Bash', merge(), undefined)).toContain('no review read 2 file(s)')
  })

  test('the pin must be the live head, and CI on it must be finished and green', async () => {
    const pending = [{ ...green[0], status: 'in_progress', conclusion: '' }]
    const red = [...green, { databaseId: 4, headSha: SHA, status: 'completed', conclusion: 'failure', workflowName: 'e2e' }]
    const check = async (over: Partial<Answers>, pin = SHA) => {
      const { host } = fakeHost(github(over))
      await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
      return guardsBefore(host, 'Bash', merge(pin), undefined)
    }
    expect(await check({}, OTHER)).toContain('is not the PR head')
    expect(await check({ runsOn: { [SHA]: [] } })).toContain('no CI run')
    expect(await check({ runsOn: { [SHA]: pending } })).toContain('has not finished (ci in_progress)')
    expect(await check({ runsOn: { [SHA]: red } })).toContain('is red (e2e failure)')
  })

  test('a gate whose source does not answer refuses', async () => {
    const check = async (over: Partial<Answers>) => {
      const { host } = fakeHost(github(over))
      await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
      return guardsBefore(host, 'mcp__github__merge_pull_request', { pullNumber: 7, expectedHeadSha: SHA }, undefined)
    }
    expect(await check({ prView: {} })).toContain('could not read the PR')
    expect(await check({ runsOn: {} })).toContain('could not read CI')
    expect(await check({ prFiles: {} })).toContain("could not list the PR's files")
  })

  test('reads survive a restart through the store', async () => {
    const first = fakeHost(github())
    await guardsBefore(first.host, ...skill('agile-11-merge-train'), undefined)
    await read(first.host, `git show ${SHA}:src/a.ts ${SHA}:src/b.ts`)
    const second = fakeHost(github())
    second.store.set('reads', first.store.get('reads'))
    guardsReset()
    await guardsStart(second.host, '/repo')
    expect(await guardsBefore(second.host, 'Bash', merge(), 's1')).toBeUndefined()
  })
})

describe('push and grant guards', () => {
  beforeEach(async () => {
    guardsReset()
    await guardsStart(fakeHost().host, '/repo')
  })

  test('the push guard reads the checked-out branch only for a push that names none', async () => {
    const { host, calls } = fakeHost({ runs: { 'git -C /w rev-parse': { exitCode: 0, stdout: 'main\n' } }, prOfBranch: { 'feat/x': null } })
    await guardsBefore(host, ...skill('agile-10-implement'), undefined)
    expect(await guardsBefore(host, 'Bash', { command: 'git -C /w push' }, undefined)).toContain('never pushes to main')
    expect(await guardsBefore(host, 'Bash', { command: 'git push origin feat/x' }, undefined)).toBeUndefined()
    // the push guard reads git once; the fix-round cap then asks gh for the branch's PR
    expect(calls).toEqual(['git -C /w rev-parse --abbrev-ref HEAD', 'gh pr list --head feat/x'])
  })

  test('a computed or quoted push target is refused', async () => {
    const { host } = fakeHost()
    await guardsBefore(host, ...skill('agile-10-implement'), undefined)
    expect(await guardsBefore(host, 'Bash', { command: 'git push origin $BRANCH' }, undefined)).toContain('computed push target')
    expect(await guardsBefore(host, 'Bash', { command: 'bash -c "git push origin main"' }, undefined)).toContain('never pushes to main')
  })

  test('the push guard also holds inside a loop agent, and not outside a loop', async () => {
    const { host } = fakeHost({ agents: [{ id: 'a1', type: 'agile-merge-review:pr-updater' }] })
    const push = { command: 'git push --force origin feat/x' }
    expect(await guardsBefore(host, 'Bash', push, undefined)).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', push, 'a1')).toContain('lease')
  })

  test('the push guard holds in a session agent', async () => {
    const { host } = fakeHost({ agents: [{ id: 'b1', type: 'agile-sprint-drain:build-session' }] })
    expect(await guardsBefore(host, 'Bash', { command: 'git push -f origin feat/x' }, 'b1')).toContain('lease')
  })

  test('the grant backstop names the agent type the engine reports, on any server name', async () => {
    const { host } = fakeHost({ agents: [{ id: 'a2', type: 'agile-merge-review:pr-reviewer' }, { id: 'a3', type: 'agile-merge-review:jira-postmortem' }] })
    expect(await guardsBefore(host, 'Edit', { file_path: '/x' }, 'a2')).toContain('never edits')
    expect(await guardsBefore(host, 'Edit', { file_path: '/x' }, 'unknown')).toBeUndefined()
    expect(await guardsBefore(host, 'mcp__claude_ai_Atlassian__addCommentToJiraIssue', {}, 'a2')).toContain('never posts')
    expect(await guardsBefore(host, 'mcp__claude_ai_Atlassian__createIssueLink', {}, 'a3')).toContain('may not create issue links')
  })
})

describe('fix-round cap', () => {
  beforeEach(async () => {
    guardsReset()
    await guardsStart(fakeHost().host, '/repo')
  })
  const agents = [1, 2, 3, 4].map(n => ({ id: `f${n}`, type: 'agile-merge-review:fix-until-satisfied' })).concat(
    { id: 'u1', type: 'agile-merge-review:pr-updater' }, { id: 'ms', type: 'agile-sprint-drain:merge-session' }, { id: 'g1', type: 'general-purpose' })
  /** PR 7 open on branch VC-7 at `head`. */
  const gh = (head = SHA, over: Partial<Answers> = {}) => fakeHost({ agents, prOfBranch: { 'VC-7': { number: 7, headRefOid: head } }, ...over })
  const push = { command: 'git push origin VC-7' }
  const loop = async () => guardsBefore(fakeHost().host, ...skill('agile-sprint-drain'), undefined)
  const sha = (n: number) => String(n).repeat(40)

  test('one round per dispatched agent run; the fourth is refused', async () => {
    await loop()
    for (const n of [1, 2, 3]) {
      expect(await guardsBefore(gh(sha(n)).host, 'Bash', push, `f${n}`)).toBeUndefined()
      expect(await guardsBefore(gh(sha(9)).host, 'Bash', push, `f${n}`)).toBeUndefined()
    }
    const { host, calls } = gh(OTHER)
    expect(await guardsBefore(host, 'Bash', push, 'f4')).toContain('3 fix rounds already pushed (onto 1111111, 2222222, 3333333)')
    expect(calls).toContain('gh pr list --head VC-7')
  })

  test('any phase counts: a general-purpose agent or the main loop pushing to the PR takes a round', async () => {
    await loop()
    await guardsBefore(gh(sha(1)).host, 'Bash', push, 'g1')
    await guardsBefore(gh(sha(2)).host, 'Bash', push, undefined)
    await guardsBefore(fakeHost().host, ...skill('agile-10-implement'), undefined)
    await guardsBefore(gh(sha(3)).host, 'Bash', push, undefined)
    expect(await guardsBefore(gh(sha(4)).host, 'Bash', push, 'f1')).toContain('fix rounds already')
  })

  test('in the main loop or a session agent, a Skill or Agent call in between starts a new round', async () => {
    await loop()
    for (const n of [1, 2]) expect(await guardsBefore(gh(sha(n)).host, 'Bash', push, 'ms')).toBeUndefined()
    await guardsBefore(fakeHost().host, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer' }, 'ms')
    await guardsBefore(gh(sha(3)).host, 'Bash', push, 'ms')
    await guardsBefore(fakeHost().host, ...skill('merge-fix-until-satisfied', 'PR #7'), 'ms')
    await guardsBefore(gh(sha(4)).host, 'Bash', push, 'ms')
    await guardsBefore(fakeHost().host, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer' }, 'ms')
    expect(await guardsBefore(gh(sha(5)).host, 'Bash', push, 'ms')).toContain('3 fix rounds already pushed')
  })

  test('a push of merge commits alone is an update, and takes no round', async () => {
    await loop()
    for (const n of [1, 2, 3]) await guardsBefore(gh(sha(n)).host, 'Bash', push, `f${n}`)
    const update = gh(OTHER, { onlyMerges: { [`${OTHER}..VC-7`]: true } })
    expect(await guardsBefore(update.host, 'Bash', push, 'u1')).toBeUndefined()
    // the base's own commits, brought in by the merge, are not the PR's
    expect(update.calls).toContain('git -C /repo rev-list --no-merges eeeeeee..VC-7 ^origin/main')
    // the same updater pushing a commit of its own is a round
    expect(await guardsBefore(gh(OTHER).host, 'Bash', push, 'u1')).toContain('fix rounds already')
  })

  test('the PR comes from the pushed branch: a bare push from git, refspec targets, every target', async () => {
    await loop()
    for (const n of [1, 2, 3]) await guardsBefore(gh(sha(n)).host, 'Bash', push, `f${n}`)
    const bare = gh(OTHER, { pushBranch: { '/w': 'VC-7' } })
    expect(await guardsBefore(bare.host, 'Bash', { command: 'cd /w && git push' }, 'f4')).toContain('fix rounds already')
    expect(bare.calls).toContain('git -C /w rev-parse @{push}')
    const two = fakeHost({ agents, prOfBranch: { scratch: null, 'VC-7': { number: 7, headRefOid: OTHER } } })
    expect(await guardsBefore(two.host, 'Bash', { command: 'git push origin scratch HEAD:refs/heads/VC-7' }, 'f4')).toContain('fix rounds already')
  })

  test('a push the cap cannot read with certainty is refused in the loop', async () => {
    await loop()
    const commands = [
      'git push -o ci.skip origin VC-7', 'git push --all origin', 'cd ../wt; git push', 'git push origin VC-7 | tee log', 'git -c x=y push origin VC-7',
      'git push origin VC-7 && git push origin VC-8',
      // a step before the push could move what it sends after the cap read it
      'git checkout VC-7 && git push', 'git branch -u origin/VC-7 && git push', 'git commit -m "fix; tidy" && git push origin VC-7',
    ]
    for (const command of commands) expect(await guardsBefore(gh().host, 'Bash', { command }, 'f1')).toContain('the fix-round cap reads every push in the loop')
    expect(await guardsBefore(gh().host, 'Bash', { command: 'cd /w && git push -u origin VC-7' }, 'f1')).toBeUndefined()
    // a push hidden in a shell script is read too
    expect(await guardsBefore(gh().host, 'Bash', { command: `bash -c 'git push origin VC-7'` }, 'f1')).toContain('the fix-round cap reads every push in the loop')
  })

  test('git named as an argument is not a push or an alias; a delete sends no commit', async () => {
    await loop()
    for (const command of ['grep -rn git src/', 'rg "git push" agile-*/skills', 'echo git push origin main > notes.txt', 'git log --grep push --oneline', 'git --version', 'git -C /w', 'git commit -m "docs: the git push form"', 'gh pr create --title x --body "run git push first"',
      `git commit -m "$(cat <<'EOF'\ndocs: run git push origin x yourself\nEOF\n)"`, `gh pr comment 7 --body-file - <<'EOF'\nthen git push\nEOF`]) {
      expect(await guardsBefore(fakeHost({ agents }).host, 'Bash', { command }, 'f1')).toBeUndefined()
    }
    // however a push is wrapped or hidden, it is read as one, and one the cap cannot read is refused
    const hidden = [
      'timeout 60 git push origin main', 'nice git push origin VC-7', 'sudo -u x git push origin VC-7', 'env -i git push origin VC-7', '/usr/bin/env git push origin VC-7',
      '{ git push origin VC-7; }', 'if true; then git push origin VC-7; fi', '! git push origin VC-7', 'bash -lc "git push origin VC-7"', 'sh -ec "git push origin VC-7"',
      '"git" push origin main', 'git $(echo push) origin VC-7', 'timeout 60 git up origin VC-7', 'grep x f; git push origin VC-7', 'git -P push origin VC-7', 'git --no-pager -C /w push origin VC-7 extra:main',
      // quoting, escapes, expansions, text run by something else
      'g\\it push origin VC-7', "$'git' push origin VC-7", 'G=git && $G push origin VC-7', '${X:-git} push origin VC-7', 'echo push origin VC-7 | xargs git',
      "man -P 'git push origin main' ls", 'echo "$(git push origin VC-7)"', 'bash <<< "git push origin VC-7"', 'echo "git push origin VC-7" | bash', 'bash -l -c "git push origin VC-7"',
      'python3 -c "import os; os.system(\'git push origin VC-7\')"', 'gh repo sync --branch main --force',
      `awk 'BEGIN{system("git push origin VC-7")}'`, `find . -maxdepth 0 -exec git push origin VC-7 \\;`, `ssh host 'git push origin VC-7'`, `make push GIT='git push origin VC-7'`,
      'man git push', 'timeout 60 bash -c true && git push origin VC-7 2>&1', 'rg --pre=./run x && echo git push', "rg --pre-glob '*' --pre 'git push origin VC-7' x", '{git,} push origin VC-7', 'GIT_PAGER="git push origin VC-7" git log', 'bash <<EOF\ngit push origin VC-7\nEOF',
    ]
    for (const command of hidden) expect(await guardsBefore(gh().host, 'Bash', { command }, 'f1')).toMatch(/^agile-mods: /)
    expect(await guardsBefore(gh().host, 'Bash', { command: '"git" push origin main' }, 'f1')).toContain('never pushes to main')
    for (const n of [1, 2, 3]) await guardsBefore(gh(sha(n)).host, 'Bash', push, `f${n}`)
    // past the cap, deleting the branch is not a fix round
    expect(await guardsBefore(gh(OTHER).host, 'Bash', { command: 'git push origin --delete VC-7' }, 'f4')).toBeUndefined()
    expect(await guardsBefore(gh(OTHER).host, 'Bash', { command: 'git push origin :VC-7' }, 'f4')).toBeUndefined()
    // a delete beside a push still counts the push
    expect(await guardsBefore(gh(OTHER).host, 'Bash', { command: 'git push origin :old VC-7' }, 'f4')).toContain('fix rounds already')
    // but deleting main is still a push to main
    expect(await guardsBefore(gh(OTHER).host, 'Bash', { command: 'git push origin --delete main' }, 'f4')).toContain('never pushes to main')
  })

  test('a dispatch text naming only a PR with spent rounds is refused before the work', async () => {
    await loop()
    for (const n of [1, 2, 3]) await guardsBefore(gh(sha(n)).host, 'Bash', push, `f${n}`)
    expect(await guardsBefore(gh().host, 'Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied', description: 'fix PR #7' }, undefined)).toContain('fix rounds already')
    expect(await guardsBefore(gh().host, 'Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied', description: 'fix PR #7 like #41' }, undefined)).toBeUndefined()
  })

  test('side doors are refused inside a loop: the API, GitHub MCP branch writes, git aliases', async () => {
    const host = fakeHost({ agents }).host
    await loop()
    expect(await guardsBefore(host, 'Bash', { command: 'gh api -X PUT repos/o/r/contents/a.ts -f branch=VC-7 -f content=x' }, 'f1')).toContain('with git push')
    expect(await guardsBefore(host, 'Bash', { command: 'gh api --method PUT repos/{owner}/{repo}/pulls/7/merge' }, undefined)).toContain('gh pr merge')
    expect(await guardsBefore(host, 'mcp__github__push_files', { branch: 'VC-7' }, 'f1')).toContain('with git push')
    // an alias however it was set: config, -c, the environment
    expect(await guardsBefore(host, 'Bash', { command: 'git -C /w up origin VC-7' }, 'f1')).toContain('"git up" is not one')
    expect(await guardsBefore(host, 'Bash', { command: 'git -c alias.up=push up origin VC-7' }, 'f1')).toContain('"git up" is not one')
    // API and MCP writes: an allowlist, so an endpoint or tool nobody listed is refused
    for (const command of ['gh api -X POST repos/o/r/git/blobs -f content=x', 'gh api -X PATCH repos/o/r/branches/x/protection -F x=1', 'gh api -X POST repos/o/r/dispatches -f event_type=x', 'gh api -X PUT repos/o/r/pulls/7/update-branch',
      `gh api graphql -f query='mutation { createCommitOnBranch(input: {}) { commit { oid } } }'`, `gh api graphql -f query='mutation { x: mergePullRequest(input: {}) { clientMutationId } }'`,
      // an allowed path in a field value does not unlock the endpoint; a second mutation is read; a query the line does not show is refused
      'gh api -X POST repos/o/r/git/refs -f ref=refs/heads/x -f note=repos/o/r/issues/1/comments',
      `gh api graphql -f query='mutation { addComment(input: {}) { x } createCommitOnBranch(input: {}) { x } }'`,
      'gh api graphql -F query=@q.graphql', 'gh api graphql -f query="$Q"']) {
      expect(await guardsBefore(host, 'Bash', { command }, 'f1')).toMatch(/through the API only|through GraphQL only|with git push|gh pr merge/)
    }
    for (const command of ['gh api repos/o/r/pulls/7/comments/9/replies -f body=x', 'gh api -X POST repos/o/r/issues/7/comments -f body=x', 'gh api -X POST repos/o/r/pulls/7/reviews -f event=COMMENT',
      `gh api graphql -f query='mutation { addPullRequestReviewThreadReply(input: {}) { comment { id } } }'`, `gh api graphql -f query='query { viewer { login } }'`]) {
      expect(await guardsBefore(host, 'Bash', { command }, 'f1')).toBeUndefined()
    }
    expect(await guardsBefore(host, 'mcp__github__fork_repository', {}, 'f1')).toContain('with git push')
    expect(await guardsBefore(host, 'mcp__claude_ai_github__some_new_write', {}, 'f1')).toContain('with git push')
    expect(await guardsBefore(host, 'mcp__gh__create_or_update_ref', {}, 'f1')).toContain('with git push')
    // a GitHub server is default-deny, whatever the verb; elsewhere the write verbs count
    expect(await guardsBefore(host, 'mcp__github__assign_copilot_to_issue', {}, 'f1')).toContain('with git push')
    expect(await guardsBefore(host, 'mcp__claude_ai_github__star_repository', {}, 'f1')).toContain('with git push')
    expect(await guardsBefore(host, 'mcp__ci__run_workflow', {}, 'f1')).toContain('with git push')
    expect(await guardsBefore(host, 'mcp__ci__dispatch_event', {}, 'f1')).toContain('with git push')
    // a write the endpoint reader cannot place is refused
    expect(await guardsBefore(host, 'Bash', { command: 'X=$(gh api -X POST)' }, 'f1')).toContain('through the API only')
    // each call read on its own: a write after an allowed call, a write method given with =
    expect(await guardsBefore(host, 'Bash', { command: 'gh api repos/o/r/pulls/1/comments && gh api -X PUT repos/o/r/contents/a -f x=1' }, 'f1')).toContain('through the API only')
    expect(await guardsBefore(host, 'Bash', { command: 'gh api --method=DELETE repos/o/r/git/refs/heads/x' }, 'f1')).toContain('through the API only')
    expect(await guardsBefore(host, 'Bash', { command: 'gh api repos/o/r/pulls/1 && gh api -X PUT repos/o/r/pulls/7/merge' }, undefined)).toContain('gh pr merge')
    // gh's options before api, and endpoints the narrower merge and PR patterns miss, are still refused
    for (const command of ['gh --repo=o/r api -X PUT repos/o/r/contents/a -f x=1', 'gh -R o/r api -X PUT repos/o/r/git/refs/heads/x', 'gh api -X PUT repos/o/r/pulls/7/merge?x=1', 'gh api -X POST /repos/o/r/pulls?draft=1 -f head=x']) {
      expect(await guardsBefore(host, 'Bash', { command }, undefined)).toMatch(/^agile-mods: /)
    }
    expect(await guardsBefore(host, 'Bash', { command: 'gh api -fx=1 repos/o/r/git/refs' }, 'f1')).toContain('through the API only')
    expect(await guardsBefore(host, 'Bash', { command: 'gh api repos/o/r/pulls/1/files && gh api -X POST repos/o/r/issues/1/comments -f body=x' }, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'echo $(gh api -X POST repos/o/r/git/refs -f ref=x)' }, 'f1')).toContain('through the API only')
    expect(await guardsBefore(host, 'mcp__atlassian__createJiraIssue', {}, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'mcp__github__pull_request_read', {}, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'mcp__github__add_issue_comment', {}, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'gh p' }, 'f1')).toContain('"gh p" is not one')
    expect(await guardsBefore(host, 'Bash', { command: "gh alias set p 'pr view'" }, 'f1')).toContain('gh aliases')
    expect(await guardsBefore(host, 'Bash', { command: 'gh extension exec x' }, 'f1')).toContain('gh extensions')
    expect(await guardsBefore(host, 'Bash', { command: 'gh pr view 7 --json files && gh run list -L 1' }, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.up GIT_CONFIG_VALUE_0=push git status' }, 'f1')).toContain('environment')
    // git's own commands, and git named inside quoted text or a path, go on
    expect(await guardsBefore(host, 'Bash', { command: 'git -C /w log --oneline -3 && git rev-parse HEAD' }, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'cat .git/config' }, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'echo "git up is an alias"' }, 'f1')).toBeUndefined()
    // unsure is not exempt: a git word in a compound line is read as a command, quotes or not
    // words are read as the shell reads them: a quoted message is text, a quoted program name is not
    expect(await guardsBefore(host, 'Bash', { command: 'cat .git/config && echo "git up is an alias"' }, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'cat x && "git" up origin VC-7' }, 'f1')).toContain('"git up" is not one')
    expect(await guardsBefore(host, 'Bash', { command: 'git $(echo up) origin VC-7' }, 'f1')).toMatch(/computed git subcommand|fix-round cap reads every push/)
    expect(await guardsBefore(host, 'Bash', { command: 'gh api -X GET repos/o/r/git/refs -F per_page=100' }, 'f1')).toBeUndefined()
    // reads and comment replies through the API go on
    expect(await guardsBefore(host, 'Bash', { command: 'gh api repos/o/r/pulls/7/files' }, 'f1')).toBeUndefined()
    expect(await guardsBefore(host, 'Bash', { command: 'gh api repos/o/r/pulls/7/comments/9/replies -f body=done' }, 'f1')).toBeUndefined()
    // outside a loop, nothing here is checked
    guardsReset()
    expect(await guardsBefore(fakeHost().host, 'Bash', { command: 'git up' }, undefined)).toBeUndefined()
  })

  test('no open PR on the branch: not a round; gh failing: refused', async () => {
    await loop()
    expect(await guardsBefore(fakeHost({ agents, prOfBranch: { 'VC-7': null } }).host, 'Bash', push, 'f1')).toBeUndefined()
    expect(await guardsBefore(fakeHost({ agents }).host, 'Bash', push, 'f1')).toContain('could not read the PR of VC-7')
  })

  test('a failed store write is logged, and the guard still holds for the session', async () => {
    await loop()
    const failing = (head: string) => fakeHost({ agents, storeFails: true, prOfBranch: { 'VC-7': { number: 7, headRefOid: head } } })
    for (const n of [1, 2, 3]) {
      const { host, logs } = failing(sha(n))
      await guardsBefore(host, 'Bash', push, `f${n}`)
      await new Promise(r => setTimeout(r, 0))
      expect(logs).toEqual(['agile-mods: store write failed: Error: disk full'])
    }
    expect(await guardsBefore(failing(OTHER).host, 'Bash', push, 'f4')).toContain('fix rounds already')
    const reviewer = fakeHost({ agents: [REVIEWER], storeFails: true })
    await guardsBefore(reviewer.host, ...skill('agile-11-merge-train'), undefined)
    await read(reviewer.host, `git show ${SHA}:src/a.ts`)
    await new Promise(r => setTimeout(r, 0))
    expect(reviewer.logs).toEqual(['agile-mods: store write failed: Error: disk full'])
  })

  test('the count survives a restart, and reset clears it', async () => {
    await loop()
    const hosts = [1, 2, 3].map(n => gh(sha(n)))
    for (const [i, h] of hosts.entries()) await guardsBefore(h.host, 'Bash', push, `f${i + 1}`)
    // the last write holds every round
    const saved = hosts[2]!
    expect(saved.store.get('fixes')).toEqual({ 7: { ids: ['agent:f1', 'agent:f2', 'agent:f3'], heads: [sha(1), sha(2), sha(3)] } })
    // a new session: memory empty, the store read back
    guardsReset()
    const next = gh(OTHER)
    next.store.set('fixes', saved.store.get('fixes'))
    await guardsStart(next.host, '/repo')
    await loop()
    expect(await guardsBefore(next.host, 'Bash', push, 'f4')).toContain('3 fix rounds already pushed')
    guardsReset(next.host)
    expect(next.store.get('fixes')).toEqual({})
  })

  test('an older store entry (heads per PR, not rounds) is not read as rounds', async () => {
    const old = gh(OTHER)
    old.store.set('fixes', { 7: [sha(1), sha(2), sha(3)] })
    guardsReset()
    await guardsStart(old.host, '/repo')
    await loop()
    expect(await guardsBefore(old.host, 'Bash', push, 'f1')).toBeUndefined()
  })
})

describe('receipts hook', () => {
  test('stores contract receipts, toasts a flagged one, ignores other agents', async () => {
    const { host, store, toasts } = fakeHost()
    await receiptsStart(host)
    await receiptsCommand(host, 'clear')
    await receiptsAfter(host, 'Agent', { subagent_type: 'general-purpose', description: 'x' }, done('Here is it'))
    await receiptsAfter(host, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'review PR #4' }, done('## PR #4 Review'))
    await receiptsAfter(host, 'Agent', { subagent_type: 'agile-execution:ticket-validator', description: 'VC-1' }, done('verdict: pass'))
    expect((store.get('receipts') as unknown[]).length).toBe(2)
    expect(toasts).toEqual(['receipt pr-reviewer: no reviewed sha · /receipts'])
    expect(await receiptsCommand(host, '')).toContain('PR #4')
  })

  test('an errored dispatch is flagged, a denied one is not recorded', async () => {
    const { host } = fakeHost()
    await receiptsCommand(host, 'clear')
    await receiptsAfter(host, 'Agent', { subagent_type: 'agile-execution:build-monitor' }, { text: undefined, isError: true, denied: false })
    await receiptsAfter(host, 'Agent', { subagent_type: 'agile-execution:build-monitor' }, { text: undefined, isError: false, denied: true })
    expect(await receiptsCommand(host, 'all')).toContain('agent errored')
    expect(await receiptsCommand(host, 'all')).toContain('1 of 1')
  })

  test('a stored list survives a restart', async () => {
    const { host, store } = fakeHost()
    store.set('receipts', [{ agent: 'agile-execution:pr-publisher', at: 1, issues: ['preamble'] }])
    await receiptsStart(host)
    expect(await receiptsCommand(host, '')).toContain('preamble')
  })
})
