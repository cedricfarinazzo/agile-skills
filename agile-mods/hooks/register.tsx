/* @jsx h */
import type { EngineInterface, Register, RenderNode } from 'claude-code'
import { EMPTY, POINTS_FIELD, pointsFieldOf, loadBoard, observeAnswer, observeReview, observeStart, observeTool, parkedOf, sampled, stallsOf, stampCosts, type Board } from './state/board.ts'
import { TABS, alertRow, chartCells, chartGlyphs, consoleRows, rasterCells, statusText, tabOf, type Row, type Tab } from './state/console.ts'
import { keepRefusal, ruleOf, type Refusal } from './state/guards.ts'
import { EMPTY_RETRO, loadRetro, retroDrain, retroEnd, retroStart, retroText, type Retro } from './state/retro.ts'
import { agentTypeOf, guardsBefore, guardsReset, guardsStart, guardsTurn, inlineReviewDone, inlineReviewOf } from './guards.ts'
import { argsOf, type Finished, type Host } from './host.ts'
import { RECEIPTS_COMMAND, receiptsAfter, receiptsCommand, receiptsNow, receiptsStart } from './receipts.ts'

// The plugin's one hooks module. The board is folded from the loop's own tool calls and the drain's
// closing banner, kept in $.store, and drawn three ways: a one-line status entry, an alert row above
// the prompt when something needs a person, and the agile console pane (/agile-board) with a tab each
// for the board, the PR and ticket flow, the drain passes, the guards and the links. The same calls
// feed the retro counts that ride agile-15-retro's Skill call as context.
// The guards (guards.ts) and /receipts (receipts.ts) share these hooks: each event is registered
// once, and `$` reaches them only as the Host bound here.

const STORE_KEY = 'board'
const RETRO_KEY = 'retro'
const PANE = 'agile-console'
let board: Board = EMPTY
let retro: Retro = EMPTY_RETRO
let shown = true
let tab: Tab = 'board'
let autoOpen = true
let pointsField = POINTS_FIELD
let refusals: Refusal[] = []
let allowed = 0

function hostOf($: EngineInterface): Host {
  return {
    now: () => $.clock.now(),
    run: (argv, init) => $.process.run(argv, init),
    read: path => $.fs.read(path),
    agents: () => $.agent.list(),
    storeGet: key => $.store.get(key),
    storeSet: (key, value) => $.store.set(key, value),
    log: text => $.ui.log(text),
    toast: (text, timeoutMs) => $.ui.toast(text, timeoutMs ? { timeoutMs } : undefined),
  }
}

/** Takes the session's cost at each drain pass boundary that has none yet. */
function stamp($: EngineInterface) {
  void $.session.usage().then(u => {
    if (u.cost === undefined) return
    const next = stampCosts(board, u.cost.usd)
    if (next !== board) save($, next)
  }).catch(() => undefined)
}

function save($: EngineInterface, next: Board) {
  if (next === board) return
  const before = board
  const known = new Set([...stallsOf(board), ...parkedOf(board)])
  board = next
  const fresh = [...stallsOf(board).map(s => `looping: ${s}`), ...parkedOf(board).map(s => `parked: ${s}`)].filter(s => !known.has(s.replace(/^\w+: /, '')))
  if (fresh.length) $.ui.toast(`agile: ${fresh.join(' · ')}`, { timeoutMs: 10000 })
  void $.store.set(STORE_KEY, board).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
  $.ui.status(shown ? statusText(board) : undefined)
  $.ui.invalidate('ui.render')
  if (board.passes !== before.passes) stamp($)
  if (autoOpen && board.drain?.outcome === 'running' && before.drain?.outcome !== 'running') {
    // opened unasked, so it waits for a wide terminal and never takes the keyboard
    void $.ui.open({ id: PANE, title: 'agile console' }).catch(() => undefined)
  }
}

function saveRetro($: EngineInterface, next: Retro) {
  const synced = board.drain ? retroDrain(next, board.drain.pass, board.drain.outcome) : next
  if (synced === retro) return
  retro = synced
  void $.store.set(RETRO_KEY, retro).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
}

const COLORS: Record<string, string> = { c: 'cyan', m: 'magenta', g: 'green', y: 'yellow', r: 'red', bl: 'blue' }
const BADGES: Record<string, string> = { bgr: 'red', bgg: 'green', bgy: 'yellow' }

/** Text props for a segment's style tags. */
function styleOf(tags?: string): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const t of (tags ?? '').split(' ')) {
    if (t === 'd') props.dimColor = true
    else if (t === 'b') props.bold = true
    else if (t === 'u') props.underline = true
    else if (COLORS[t]) props.color = COLORS[t]
    else if (BADGES[t]) Object.assign(props, { backgroundColor: BADGES[t], color: 'black' })
  }
  return props
}

export const register: Register = (on, options) => {
  autoOpen = options?.autoOpen !== false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const host = hostOf($)
    const stored = loadBoard(await $.store.get(STORE_KEY).catch(() => undefined))
    if (stored) board = stored
    const storedRetro = loadRetro(await $.store.get(RETRO_KEY).catch(() => undefined))
    if (storedRetro) retro = storedRetro
    guardsStart(r.cwd)
    // agile-10-implement's story-points-field, pinned in the consumer repo's AGENTS.md or CLAUDE.md
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      const field = pointsFieldOf(await $.fs.read(`${r.cwd}/${file}`).catch(() => ''))
      if (field) {
        pointsField = field
        break
      }
    }
    await receiptsStart(host)
    await $.command.register({
      name: 'agile-board',
      description: 'Agile console: board, flow, drain, guards and links tabs, plus show, hide, retro, reset (agile-mods)',
      argumentHint: '[board | flow | drain | guards | links | show | hide | retro | reset]',
      immediate: true,
    }).catch(err => $.ui.log(`agile-mods: /agile-board not registered: ${err}`))
    await $.command.register(RECEIPTS_COMMAND).catch(err => $.ui.log(`agile-mods: /receipts not registered: ${err}`))
    $.ui.status(shown ? statusText(board) : undefined)
    // elapsed times move while a loop runs; the redraw is throttled by the engine
    $.clock.every(5000, () => {
      if (board.loop && board.drain?.outcome !== 'STUCK' && board.drain?.outcome !== 'DRAINED') $.ui.invalidate('ui.render')
    })
    return r
  })

  on('command.run', { command: 'agile-board' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'reset') {
      save($, EMPTY)
      saveRetro($, EMPTY_RETRO)
      guardsReset()
      refusals = []
      allowed = 0
      return { text: 'agile board and retro counts cleared' }
    }
    if (arg === 'retro') return { text: retroText(retro, await $.clock.now()) ?? 'no loop data recorded yet' }
    if (arg === 'hide' || arg === 'show') {
      shown = arg === 'show'
      $.ui.status(shown ? statusText(board) : undefined)
      $.ui.invalidate('ui.render')
      return { text: shown ? 'agile status and alerts shown' : 'agile status and alerts hidden' }
    }
    const wanted = arg ? tabOf(arg) : tab
    if (!wanted) return { text: `unknown tab "${arg}": board, flow, drain, guards, links, or show, hide, retro, reset` }
    tab = wanted
    const pane = await $.ui.open({ id: PANE, title: 'agile console', focus: true, closeOnEscape: true })
    $.ui.invalidate('ui.render')
    return pane.isPlaced ? {} : { text: `the agile console needs a wider terminal (${pane.reason}); widen it and run /agile-board again` }
  })

  on('command.run', { command: 'receipts' }, async ($, e) => ({ text: await receiptsCommand(hostOf($), e.args.trim().toLowerCase()) }))

  on('tool.call', async ($, e, next) => {
    const host = hostOf($)
    const args = argsOf(e)
    const deny = await guardsBefore(host, board, e.tool, args, e.agentId)
    if (deny) {
      const type = e.agentId ? await agentTypeOf(host, e.agentId) : undefined
      refusals = keepRefusal(refusals, { at: await $.clock.now(), rule: ruleOf(deny), text: deny, ...(type && { agent: type.split(':').at(-1) }) })
      $.ui.toast(deny.replace(/^agile-mods:\s*/, 'agile guard: '), { timeoutMs: 8000 })
      $.ui.invalidate('ui.render')
      return { deny }
    }
    allowed += 1

    const now = await $.clock.now()
    save($, observeStart(board, e.tool, args, now))
    saveRetro($, retroStart(retro, e.tool, args, now))
    const r = await next(e)
    const done: Finished = {
      denied: r.deny !== undefined,
      isError: r.isError === true,
      text: r.deny !== undefined || r.isError ? undefined : r.text,
    }
    save($, sampled(observeTool(board, e.tool, args, done.text, pointsField), await $.clock.now()))
    saveRetro($, retroEnd(retro, e.tool, args, done.text))
    await receiptsAfter(host, e.tool, args, done)
    $.ui.invalidate('ui.render')

    if (e.tool === 'Skill' && done.text !== undefined && /(^|:)agile-15-retro$/.test(String(args.skill))) {
      const data = retroText(retro, await $.clock.now())
      if (data && r.deny === undefined && !r.isError) return { ...r, context: [...(r.context ?? []), data] }
    }
    return r
  })

  // an inline merge-review-pr names its reviewed sha in a response of the loop that ran it: the
  // main loop, or a drain's merge-session agent; the sha lands on the board, so a fresh session
  // resuming at 3e after a CI handoff merges against it
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const pr = inlineReviewOf(e.agentId)
    if (pr === undefined || !r.answer) return r
    const reviewed = observeReview(board, pr, r.answer)
    if (reviewed !== board) {
      save($, reviewed)
      inlineReviewDone(e.agentId)
    }
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    guardsTurn(r.text ?? '', e.agentId)
    if (e.agentId) return r
    const now = await $.clock.now()
    save($, sampled(observeAnswer(board, r.text ?? '', now), now))
    saveRetro($, retro)
    stamp($)
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!shown || e.props.hasSurvey) return next(e)
    const row = alertRow(board, { now: await $.clock.now(), refusals, allowed, receipts: receiptsNow() }, e.props.bodyColumns)
    if (!row) return next(e)
    const ui = await $.ui.resolve(e)
    const { Box } = ui
    return (
      <Box flexDirection="column">
        {renderRow(ui, row, 'alert')}
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    const ui = await $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const usage = await $.session.usage().catch(() => undefined)
    const ctx = { now: await $.clock.now(), usd: usage?.cost?.usd, refusals, allowed, receipts: receiptsNow() }
    const w = Math.max(30, e.props.bodyColumns - 2)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          {TABS.map(t => (
            <Button key={`tab-${t.id}`} label={t.label} hotkey={t.hotkey} plain dimColor={tab !== t.id} onPress={() => {
              tab = t.id
              $.ui.invalidate('ui.render')
            }} />
          ))}
        </Box>
        <Text>{' '}</Text>
        {consoleRows(tab, board, ctx, w).map((row, i) => renderRow(ui, row, `r${i}`))}
      </Box>
    )
  })
}

type Elements = Awaited<ReturnType<EngineInterface['ui']['resolve']>>

/** One row as elements: styled text in a line, bordered tiles, the burndown, or a link. */
function renderRow(ui: Elements, row: Row, key: string): RenderNode {
  const { Box, Text, Link } = ui
  if (row.kind === 'link') return <Link key={key} href={row.href} label={row.label} />
  if (row.kind === 'tiles') {
    return (
      <Box key={key} flexDirection="row" columnGap={1}>
        {row.tiles.map(t => (
          <Box key={`${key}:${t.label}`} borderStyle="round" flexGrow={1} flexDirection="column" paddingX={1}>
            <Text dimColor>{t.label}</Text>
            <Text bold {...styleOf(t.tone)}>{t.value}</Text>
            <Text dimColor wrap="truncate">{t.sub}</Text>
          </Box>
        ))}
      </Box>
    )
  }
  if (row.kind === 'chart') {
    const { Raster } = ui as { Raster?: (props: Record<string, unknown>) => RenderNode }
    // a Raster draws in the terminal only; elsewhere the same data is text
    if (Raster) return Raster({ key, columns: row.chart.cols, rows: row.chart.rows, cells: rasterCells(chartCells(row.chart)) })
    return (
      <Box key={key} flexDirection="column">
        {chartGlyphs(row.chart).map((segs, i) => (
          <Box key={`${key}:${i}`} flexDirection="row">
            {segs.map((s, j) => <Text key={`g${j}`} {...styleOf(s.c)}>{s.t}</Text>)}
          </Box>
        ))}
      </Box>
    )
  }
  return (
    <Box key={key} flexDirection="row">
      {row.segs.filter(s => s.t).map((s, i) => <Text key={`s${i}`} {...styleOf(s.c)} wrap="truncate">{s.t}</Text>)}
    </Box>
  )
}
