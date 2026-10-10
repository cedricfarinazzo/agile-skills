import { beforeEach, describe, expect, test } from 'bun:test'
import { Glob } from 'bun'
import { guardsBefore, guardsReset, guardsStart } from '../../hooks/guards.ts'
import { fakeHost } from './fake-host.ts'

// Every git and gh command the skills write, run through the guards inside a loop: a guard that
// refused one would stall the step that runs it. `<placeholder>` and `[optional]` parts are filled.
const ROOT = `${import.meta.dir}/../../..`

async function skillCommands(): Promise<[string, string][]> {
  const found = new Map<string, string>()
  for await (const file of new Glob('*/skills/*/SKILL.md').scan(ROOT)) {
    const text = await Bun.file(`${ROOT}/${file}`).text()
    const spans = [...text.matchAll(/`([^`\n]+)`/g)].map(m => m[1]!)
    const fenced = [...text.matchAll(/```(?:bash|sh)?\n([\s\S]*?)```/g)].flatMap(m => m[1]!.split('\n'))
    for (const line of [...spans, ...fenced].map(x => x.trim())) {
      // a line with an ellipsis is prose about a command, not one
      if (/^(\w+=\S+\s+)*(git|gh)\s/.test(line) && !line.includes('…')) found.set(line.replace(/<[^>]*>/g, 'x').replace(/\[[^\]]*\]/g, ''), file)
    }
  }
  return [...found]
}

describe('the skills\' own commands pass the guards', () => {
  beforeEach(() => guardsReset())

  test('no git or gh command a skill writes is refused inside a loop', async () => {
    const commands = await skillCommands()
    // the corpus is real: the train's pushes and its remote branch cleanup are in it
    expect(commands.length).toBeGreaterThan(80)
    expect(commands.some(([c]) => c.startsWith('git push origin --delete'))).toBe(true)
    const base = fakeHost({ agents: [{ id: 'f1', type: 'agile-merge-review:fix-until-satisfied' }] }).host
    const host = { ...base, prOfBranch: async () => null, branch: async () => 'feature', pushBranch: async () => 'feature' }
    await guardsStart(host, '/repo')
    await guardsBefore(host, 'Skill', { skill: 'agile-sprint-drain' }, undefined)
    const refused: string[] = []
    for (const [command, file] of commands) {
      for (const agent of ['f1', undefined]) {
        const deny = await guardsBefore(host, 'Bash', { command }, agent)
        if (deny) refused.push(`${file}: ${command} -> ${deny}`)
      }
    }
    expect(refused).toEqual([])
  })
})
