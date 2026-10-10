// UI tests for hooks/register.tsx: the console pane and the alert row, mounted through the engine on
// each surface, from a board the store already holds. They check that every tab draws a tree the
// surface accepts and that the tab buttons switch it.
import { describe, expect, test } from 'claude-code/testing'
import type { Board } from '../../hooks/state/board.ts'
import { SHA, start, world } from './world.ts'

const SURFACES = ['terminal', 'desktop'] as const
const HOUR = 3_600_000

/** A drain in its second pass: one ticket parked, PR 42 open in review, PR 40 merged, history for the forecast. */
function board(): Board {
  return {
    tickets: {
      'VC-3': { key: 'VC-3', status: 'Done', category: 'done', pr: 40, points: 3 },
      'VC-7': { key: 'VC-7', status: 'In Review', category: 'indeterminate', phase: 'review', pr: 42, points: 5, since: 0 },
      'VC-9': { key: 'VC-9', status: 'Needs Info', category: 'indeterminate', parked: 'needs-info', points: 2 },
    },
    order: ['VC-3', 'VC-7', 'VC-9'],
    prs: {
      40: { number: 40, key: 'VC-3', state: 'MERGED', merged: true, step: 'merged', createdAt: 0, mergedAt: HOUR },
      42: { number: 42, key: 'VC-7', state: 'OPEN', step: '3b review', seen: { '3b review': 1 }, head: SHA, createdAt: HOUR, files: ['src/a.ts'], filesHead: SHA },
    },
    prOrder: [40, 42],
    loop: 'drain',
    stage: 'merge',
    drain: { pass: 2, outcome: 'running' },
    since: 0,
    burn: [{ at: 0, left: 10, total: 10, done: 0 }, { at: HOUR, left: 5, total: 10, done: 3 }],
    burnUnit: 'points',
    passes: [{ start: 0, merge: HOUR / 2, end: HOUR, cost0: 0, cost1: 2, tokens: { build: { input: 10, read: 900, write: 90, output: 5 } } }, { start: HOUR, cost0: 2 }],
    history: { merges: Array.from({ length: 20 }, (_, d) => -d * 86_400_000), cycles: [1, 2, 3, 4, 5, 6].map(h => h * HOUR) },
    spend: { usd: 3, since: 0 },
    site: 'https://acme.atlassian.net',
    repo: 'https://github.com/acme/app',
    gh: { at: 0 },
    jira: { at: 0 },
  }
}

const PANE = { title: 'agile console', isFocused: true, bodyColumns: 120, placement: 'dock' } as never
const ABOVE = { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 120, scroll: {}, view: {} } as never

describe('console pane through the engine', () => {
  for (const surface of SURFACES) {
    test(`${surface}: every tab draws, and its button switches to it`, async ($, on) => {
      world(on, { stored: { '/repo:board': board() } })
      await start($)
      const ui = await $.ui.mount({ plugin: 'agile-mods', surface, component: 'Pane', props: PANE, requestId: 'agile-console' })
      expect(await ui.find({ text: /DRAIN/ })).toBeDefined()
      expect(await ui.find({ text: /burnup/ })).toBeDefined()
      expect(await ui.find({ text: /85% by/ })).toBeDefined()
      expect(await ui.find({ text: /no such text anywhere/ })).toBeUndefined()
      const shown: Record<string, RegExp> = { flow: /MERGE/, wip: /AGING/, drain: /AGENTS/, guards: /GUARDS/, links: /VC-7/, board: /burnup/ }
      for (const [tab, text] of Object.entries(shown)) {
        await ui.press({ key: `tab-${tab}` })
        expect(await ui.find({ text })).toBeDefined()
      }
      await ui.press({ key: 'tab-wip' })
      expect(await ui.find({ text: /#42 VC-7/ })).toBeDefined()
    })
  }

  test('another pane is left to the plugins beneath', async ($, on) => {
    world(on, { stored: { '/repo:board': board() } })
    await start($)
    const ui = await $.ui.mount({ plugin: 'agile-mods', surface: 'terminal', component: 'Pane', props: PANE, requestId: 'someone-else' })
    expect(await ui.find({ text: /DRAIN/ })).toBeUndefined()
  })
})

describe('alert row through the engine', () => {
  for (const surface of SURFACES) {
    test(`${surface}: parked work needs a person`, async ($, on) => {
      world(on, { stored: { '/repo:board': board() } })
      await start($)
      const ui = await $.ui.mount({ plugin: 'agile-mods', surface, component: 'AbovePrompt', props: ABOVE })
      expect(await ui.find({ text: /need/ })).toBeDefined()
      expect(await ui.find({ text: /VC-9 Needs Info/ })).toBeDefined()
    })
  }

  test('quiet when nothing needs a person', async ($, on) => {
    const quiet = board()
    quiet.tickets['VC-9'] = { key: 'VC-9', status: 'To Do', category: 'new', points: 2 }
    world(on, { stored: { '/repo:board': quiet } })
    await start($)
    const ui = await $.ui.mount({ plugin: 'agile-mods', surface: 'terminal', component: 'AbovePrompt', props: ABOVE })
    expect(await ui.find({ text: /need/ })).toBeUndefined()
    // what is beneath is drawn as it was
    expect(await ui.find({ text: /the prompt/ })).toBeDefined()
  })

  test('/agile-board hide removes the row, show brings it back', async ($, on) => {
    world(on, { stored: { '/repo:board': board() } })
    await start($)
    await $.command.run({ command: 'agile-board', args: 'hide' } as never)
    const hidden = await $.ui.mount({ plugin: 'agile-mods', surface: 'terminal', component: 'AbovePrompt', props: ABOVE })
    expect(await hidden.find({ text: /need/ })).toBeUndefined()
    await $.command.run({ command: 'agile-board', args: 'show' } as never)
    const shown = await $.ui.mount({ plugin: 'agile-mods', surface: 'terminal', component: 'AbovePrompt', props: ABOVE })
    expect(await shown.find({ text: /need/ })).toBeDefined()
  })
})
