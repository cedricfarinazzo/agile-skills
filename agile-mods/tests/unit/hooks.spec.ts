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
    const { host, calls } = fakeHost({ runs: { 'git -C /w rev-parse': { exitCode: 0, stdout: 'main\n' } } })
    await guardsBefore(host, ...skill('agile-10-implement'), undefined)
    expect(await guardsBefore(host, 'Bash', { command: 'git -C /w push' }, undefined)).toContain('never pushes to main')
    expect(await guardsBefore(host, 'Bash', { command: 'git push origin feat/x' }, undefined)).toBeUndefined()
    expect(calls).toEqual(['git -C /w rev-parse --abbrev-ref HEAD'])
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
  const fix = (pr = 7) => ['Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied', description: `fix PR #${pr}` }] as const
  const at = (sha: string) => ({ prView: { 7: { headRefOid: sha, state: 'OPEN' } } })

  test('counted by the live head gh reports at each 3c dispatch; the fourth head is refused', async () => {
    await guardsBefore(fakeHost().host, ...skill('agile-11-merge-train'), undefined)
    for (const sha of [OLD, SHA, OTHER]) {
      expect(await guardsBefore(fakeHost(at(sha)).host, ...fix(), undefined)).toBeUndefined()
      // a re-dispatch on the same head (a missing receipt) is not a new round
      expect(await guardsBefore(fakeHost(at(sha)).host, ...fix(), undefined)).toBeUndefined()
    }
    const { host, calls } = fakeHost(at('f'.repeat(40)))
    expect(await guardsBefore(host, ...fix(), undefined)).toContain('3 fix rounds already')
    expect(calls).toEqual(['gh pr view 7'])
  })

  test('the count survives a restart, and reset clears it', async () => {
    const { host, store } = fakeHost(at(OLD))
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    await guardsBefore(host, ...fix(), undefined)
    expect(store.get('fixes')).toEqual({ 7: [OLD] })
    guardsReset(host)
    expect(store.get('fixes')).toEqual({})
  })

  test('fails closed: no PR named, or gh does not answer', async () => {
    const { host } = fakeHost()
    await guardsBefore(host, ...skill('agile-11-merge-train'), undefined)
    expect(await guardsBefore(host, 'Agent', { subagent_type: 'agile-merge-review:fix-until-satisfied', description: 'fix it' }, undefined)).toContain('names the PR it fixes')
    expect(await guardsBefore(host, ...fix(), undefined)).toContain('could not read the PR')
  })

  test('off outside the merge train, on inside a merge-session', async () => {
    const outside = fakeHost()
    expect(await guardsBefore(outside.host, ...fix(), undefined)).toBeUndefined()
    expect(outside.calls).toEqual([])
    const session = fakeHost({ agents: [{ id: 's1', type: 'agile-sprint-drain:merge-session' }] })
    expect(await guardsBefore(session.host, 'Skill', { skill: 'merge-fix-until-satisfied', args: 'PR #7' }, 's1')).toContain('could not read the PR')
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
