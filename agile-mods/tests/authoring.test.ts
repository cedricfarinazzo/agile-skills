import { describe, expect, test } from 'bun:test'
import { INVARIANTS_SCRIPT, applyEdit, bareMcpNames, bumpedOf, droppedTriggers, isSkillFile, missingBumps, triggersOf } from '../hooks/state/authoring.ts'

const skill = (triggers: string) => `---\nname: x\ndescription: "Does x. Triggers: ${triggers}."\n---\n# x\n`

describe('trigger guard', () => {
  test('reads the Triggers: list', () => {
    expect(triggersOf(skill('drain the sprint, ship the sprint'))).toEqual(['drain the sprint', 'ship the sprint'])
  })

  test('a dropped phrase is reported, a reworded description is not', () => {
    expect(droppedTriggers(skill('drain the sprint, ship the sprint'), skill('ship the sprint'))).toEqual(['drain the sprint'])
    expect(droppedTriggers(skill('drain the sprint'), skill('Drain the sprint, clear the board'))).toEqual([])
  })

  test('applies an Edit as the tool would', () => {
    expect(applyEdit('a b a', 'a', 'c', false)).toBe('c b a')
    expect(applyEdit('a b a', 'a', 'c', true)).toBe('c b c')
    expect(applyEdit('a b', 'z', 'c', false)).toBeUndefined()
    expect(applyEdit('a', 'a', '$&$&', false)).toBe('$&$&')
  })

  test('recognises skill files', () => {
    expect(isSkillFile('agile-execution/skills/agile-10-implement/SKILL.md')).toBe(true)
    expect(isSkillFile('agile-execution/README.md')).toBe(false)
  })
})

describe('MCP lint', () => {
  test('flags bare names, not qualified ones', () => {
    const md = 'call `getJiraIssue` first\nthen `mcp__atlassian__getJiraIssue`\nand merge_pull_request, mcp__github__merge_pull_request'
    expect(bareMcpNames(md)).toEqual([{ line: 1, name: 'getJiraIssue' }, { line: 3, name: 'merge_pull_request' }])
  })
})

describe('version bump', () => {
  const plugins = new Set(['agile-execution', 'agile-mods'])

  test('a touched plugin without a version line in its manifest diff is missing', () => {
    const diff = '+++ b/agile-mods/.claude-plugin/plugin.json\n@@ -3 +3 @@\n-  "version": "0.1.0",\n+  "version": "0.2.0",\n'
    expect(missingBumps(['agile-mods/hooks/guards.ts', 'agile-execution/README.md', 'README.md'], bumpedOf(diff), plugins)).toEqual(['agile-execution'])
  })

  test('a manifest diff that changes only the description is not a bump', () => {
    expect(bumpedOf('+++ b/agile-mods/.claude-plugin/plugin.json\n+  "description": "x",\n')).toEqual(new Set())
  })
})

describe('invariants script', () => {
  test('prints nothing on this repository as committed', () => {
    const root = new URL('../..', import.meta.url).pathname
    const run = Bun.spawnSync(['bash', '-c', INVARIANTS_SCRIPT], { cwd: root })
    expect(run.stderr.toString()).toBe('')
    expect(run.stdout.toString()).toBe('')
  })
})
