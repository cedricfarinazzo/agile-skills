import { beforeEach, describe, expect, test } from 'bun:test'
import { authoringAfter, authoringBefore, authoringStart, authoringTurn } from '../hooks/authoring.ts'
import { guardsBefore, guardsReset, guardsStart, guardsTurn, inlineReviewDone, inlineReviewOf } from '../hooks/guards.ts'
import { receiptsAfter, receiptsCommand, receiptsStart } from '../hooks/receipts.ts'
import { EMPTY, observeReview, observeTool, type Board } from '../hooks/state/board.ts'
import { fakeHost } from './fake-host.ts'

const SHA = 'd'.repeat(40)
const skill = (name: string, args = '') => ['Skill', { skill: name, args }] as const
const done = (text: string | undefined) => ({ text, isError: false, denied: false })

/** A board where PR 7's head was reviewed and its CI read green twice. */
function greenBoard(): Board {
  let b = observeTool(EMPTY, 'Agent', { subagent_type: 'agile-merge-review:pr-reviewer', description: 'review PR #7' }, `Reviewed sha: ${SHA}`)
  const view = { command: 'gh run view 3 --json status,conclusion,headSha' }
  const green = JSON.stringify({ databaseId: 3, status: 'completed', conclusion: 'success', headSha: SHA })
  b = observeTool(b, 'Bash', view, green)
  return observeTool(b, 'Bash', view, green)
}

describe('guards hook', () => {
  beforeEach(() => {
    guardsReset()
    guardsStart('/repo')
  })

  test('merges are gated only while a train runs, until its final report', async () => {
    const { host } = fakeHost()
    const merge = { command: 'gh pr merge 7 --squash' }
    expect(await guardsBefore(host, EMPTY, 'Bash', merge, undefined)).toBeUndefined()
    await guardsBefore(host, EMPTY, ...skill('agile-merge-review:agile-11-merge-train'), undefined)
    expect(await guardsBefore(host, EMPTY, 'Bash', merge, undefined)).toContain('--match-head-commit')
    guardsTurn('3e: waiting on run 3')
    expect(await guardsBefore(host, EMPTY, 'Bash', merge, undefined)).toContain('--match-head-commit')
    guardsTurn('## Merge train\n- **Per-PR outcome** — …')
    expect(await guardsBefore(host, EMPTY, 'Bash', merge, undefined)).toBeUndefined()
  })

  test('a pinned merge of the reviewed, green head passes', async () => {
    const { host } = fakeHost()
    await guardsBefore(host, EMPTY, ...skill('agile-11-merge-train'), undefined)
    expect(await guardsBefore(host, greenBoard(), 'Bash', { command: `gh pr merge 7 --squash --match-head-commit ${SHA}` }, undefined)).toBeUndefined()
    expect(await guardsBefore(host, greenBoard(), 'mcp__github__merge_pull_request', { pullNumber: 7, expectedHeadSha: 'e'.repeat(40) }, undefined)).toContain('unreviewed code')
  })

  test('inside a drain, an inner train report does not end the gate; the banner does', async () => {
    const { host } = fakeHost()
    const merge = { command: 'gh pr merge 7' }
    await guardsBefore(host, EMPTY, ...skill('agile-sprint-drain'), undefined)
    guardsTurn('- **Per-PR outcome** — pass 1')
    expect(await guardsBefore(host, EMPTY, 'Bash', merge, undefined)).toContain('--match-head-commit')
    guardsTurn('══ DRAINED ══  12 tickets Done')
    expect(await guardsBefore(host, EMPTY, 'Bash', merge, undefined)).toBeUndefined()
  })

  test('the push guard reads the checked-out branch only for a push that names none', async () => {
    const { host, calls } = fakeHost({ runs: { 'git -C /w rev-parse': { exitCode: 0, stdout: 'main\n' } } })
    await guardsBefore(host, EMPTY, ...skill('agile-10-implement'), undefined)
    expect(await guardsBefore(host, EMPTY, 'Bash', { command: 'git -C /w push' }, undefined)).toContain('never pushes to main')
    expect(await guardsBefore(host, EMPTY, 'Bash', { command: 'git push origin feat/x' }, undefined)).toBeUndefined()
    expect(calls).toEqual(['git -C /w rev-parse --abbrev-ref HEAD'])
  })

  test('the push guard also holds inside a loop agent, and not outside a loop', async () => {
    const { host } = fakeHost({ agents: [{ id: 'a1', type: 'agile-merge-review:pr-updater' }] })
    const push = { command: 'git push --force origin feat/x' }
    expect(await guardsBefore(host, EMPTY, 'Bash', push, undefined)).toBeUndefined()
    expect(await guardsBefore(host, EMPTY, 'Bash', push, 'a1')).toContain('lease')
  })

  test('the grant backstop names the agent type the engine reports', async () => {
    const { host } = fakeHost({ agents: [{ id: 'a2', type: 'agile-merge-review:pr-reviewer' }] })
    expect(await guardsBefore(host, EMPTY, 'Edit', { file_path: '/x' }, 'a2')).toContain('never edits')
    expect(await guardsBefore(host, EMPTY, 'Edit', { file_path: '/x' }, 'unknown')).toBeUndefined()
  })

  test('an inline review is remembered for the turn only', async () => {
    const { host } = fakeHost()
    await guardsBefore(host, EMPTY, ...skill('agile-merge-review:merge-review-pr', 'PR 12'), undefined)
    expect(inlineReviewOf()).toBe(12)
    guardsTurn('')
    expect(inlineReviewOf()).toBeUndefined()
  })

  test('an inline review inside a merge-session agent is kept per loop', async () => {
    const { host } = fakeHost({ agents: [{ id: 's1', type: 'agile-sprint-drain:merge-session' }] })
    await guardsBefore(host, EMPTY, ...skill('agile-merge-review:merge-review-pr', 'PR 9'), 's1')
    expect(inlineReviewOf('s1')).toBe(9)
    expect(inlineReviewOf()).toBeUndefined()
    guardsTurn('')
    expect(inlineReviewOf('s1')).toBe(9)
    inlineReviewDone('s1')
    expect(inlineReviewOf('s1')).toBeUndefined()
  })

  test('in dispatch=session, the gate holds inside the session agent against the sha its review named', async () => {
    const { host } = fakeHost({ agents: [{ id: 's1', type: 'agile-sprint-drain:merge-session' }] })
    await guardsBefore(host, EMPTY, ...skill('agile-sprint-drain'), undefined)
    await guardsBefore(host, EMPTY, ...skill('agile-merge-review:agile-11-merge-train'), 's1')
    const b = observeReview(greenBoard(), 7, `Reviewed sha: ${SHA}`)
    expect(await guardsBefore(host, b, 'Bash', { command: `gh pr merge 7 --squash --match-head-commit ${'e'.repeat(40)}` }, 's1')).toContain('unreviewed code')
    expect(await guardsBefore(host, b, 'Bash', { command: `gh pr merge 7 --squash --match-head-commit ${SHA}` }, 's1')).toBeUndefined()
    guardsTurn('- **Per-PR outcome** — merged 7', 's1')
    expect(await guardsBefore(host, b, 'Bash', { command: 'gh pr merge 7' }, 's1')).toContain('--match-head-commit')
  })

  test('a fresh merge-session resuming at 3e after a CI handoff merges against the sha an earlier session reviewed', async () => {
    const { host } = fakeHost({ agents: [{ id: 's1', type: 'agile-sprint-drain:merge-session' }, { id: 's2', type: 'agile-sprint-drain:merge-session' }] })
    await guardsBefore(host, EMPTY, ...skill('agile-sprint-drain'), undefined)
    await guardsBefore(host, EMPTY, ...skill('agile-merge-review:merge-review-pr', 'PR 7'), 's1')
    const b = observeReview(greenBoard(), 7, `Reviewed sha: ${SHA}`)
    inlineReviewDone('s1')
    guardsTurn(`waiting: 3\nresume_at: 3e`, 's1')
    expect(await guardsBefore(host, b, 'Bash', { command: `gh pr merge 7 --squash --match-head-commit ${'e'.repeat(40)}` }, 's2')).toContain('unreviewed code')
    expect(await guardsBefore(host, b, 'Bash', { command: `gh pr merge 7 --squash --match-head-commit ${SHA}` }, 's2')).toBeUndefined()
  })

  test('the push guard holds in a session agent', async () => {
    const { host } = fakeHost({ agents: [{ id: 'b1', type: 'agile-sprint-drain:build-session' }] })
    expect(await guardsBefore(host, EMPTY, 'Bash', { command: 'git push -f origin feat/x' }, 'b1')).toContain('lease')
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

describe('authoring hook', () => {
  const root = '/repo'
  const skillPath = `${root}/agile-x/skills/agile-1-y/SKILL.md`
  const SKILL = '---\nname: agile-1-y\ndescription: "Does y. Triggers: make y, build y."\n---\n'
  const manifest = JSON.stringify({ name: 'agile-skills', plugins: [{ name: 'agile-x' }, { name: 'agile-z' }] })

  test('is off outside the agile-skills repo', async () => {
    const { host } = fakeHost({ files: { '/other/.claude-plugin/marketplace.json': '{"name":"other"}' } })
    expect(await authoringStart(host, '/other')).toBe(false)
  })

  test('refuses an edit that drops a trigger, allows a reword', async () => {
    const { host } = fakeHost({
      files: { [`${root}/.claude-plugin/marketplace.json`]: manifest, [skillPath]: SKILL },
      runs: { 'git show HEAD:agile-x/skills/agile-1-y/SKILL.md': { exitCode: 0, stdout: SKILL } },
    })
    expect(await authoringStart(host, root)).toBe(true)
    const drop = { file_path: skillPath, old_string: 'make y, build y', new_string: 'make y' }
    expect(await authoringBefore(host, 'Edit', drop)).toContain('"build y"')
    const reword = { file_path: skillPath, old_string: 'Does y.', new_string: 'Builds the y.' }
    expect(await authoringBefore(host, 'Edit', reword)).toBeUndefined()
    expect(await authoringBefore(host, 'Write', { file_path: skillPath, content: SKILL.replace('make y, ', '') })).toContain('"make y"')
  })

  test('refuses a commit that touches a plugin without a version line; -a and --all read HEAD', async () => {
    const { host, calls } = fakeHost({
      files: { [`${root}/.claude-plugin/marketplace.json`]: manifest },
      runs: {
        'git diff --cached --name-only': { exitCode: 0, stdout: 'agile-x/README.md\n' },
        'git diff HEAD --name-only': { exitCode: 0, stdout: 'agile-z/README.md\n' },
        'git diff': { exitCode: 0, stdout: '' },
      },
    })
    await authoringStart(host, root)
    expect(await authoringBefore(host, 'Bash', { command: 'git commit -m "docs -data"' })).toContain('agile-x')
    expect(await authoringBefore(host, 'Bash', { command: 'git commit --all -m x' })).toContain('agile-z')
    expect(calls.some(c => c.startsWith('git diff HEAD'))).toBe(true)
    expect(await authoringBefore(host, 'Bash', { command: 'git status' })).toBeUndefined()
  })

  test('reminds about a new bare MCP name, and runs the invariants after an edit turn', async () => {
    const md = `${root}/agile-x/README.md`
    const { host, toasts } = fakeHost({
      files: { [`${root}/.claude-plugin/marketplace.json`]: manifest, [md]: 'Call `getJiraIssue` here.\n' },
      runs: { 'git show': { exitCode: 0, stdout: '' }, 'bash -c': { exitCode: 0, stdout: 'Confluence tree: 2 variants\n' } },
    })
    await authoringStart(host, root)
    const [reminder] = await authoringAfter(host, 'Edit', { file_path: md }, done('ok'))
    expect(reminder).toContain('getJiraIssue (line 1)')
    await authoringTurn(host)
    expect(toasts).toEqual(['agile-verify: 1 invariant(s) drifted · /agile-verify'])
    await authoringTurn(host)
    expect(toasts.length).toBe(1)
  })
})
