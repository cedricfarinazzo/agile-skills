/* @jsx h */
import type { EngineInterface, Register } from 'claude-code'
import { EMPTY, buildLines, drainLine, linksOf, loadBoard, mergeLines, observeAnswer, observeStart, observeTool, type Board } from './state/board.ts'
import { EMPTY_RETRO, loadRetro, retroDrain, retroEnd, retroStart, retroText, type Retro } from './state/retro.ts'
import { VERIFY_COMMAND, authoringAfter, authoringBefore, authoringStart, authoringTurn, invariants } from './authoring.ts'
import { guardsAfter, guardsBefore, guardsStart, guardsTurn } from './guards.ts'
import { argsOf, type Finished, type Host } from './host.ts'
import { RECEIPTS_COMMAND, receiptsAfter, receiptsCommand, receiptsStart } from './receipts.ts'

// The plugin's one hooks module. /agile-board draws the sprint above the prompt: a build queue
// (tickets by agile:phase marker) and a merge queue (PRs by merge-train step), folded from the
// loop's own tool calls and the drain's closing banner, kept in $.store. The same calls feed the
// retro counts that ride agile-15-retro's Skill call as context, and the links pane.
// The guards (guards.ts), /receipts (receipts.ts) and the authoring checks (authoring.ts) share
// these hooks: each event is registered once, and `$` reaches them only as the Host bound here.

const STORE_KEY = 'board'
const RETRO_KEY = 'retro'
const LINKS_PANE = 'agile-links'
let board: Board = EMPTY
let retro: Retro = EMPTY_RETRO
let shown = true

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

function save($: EngineInterface, next: Board) {
  if (next === board) return
  const before = board.drain?.outcome
  board = next
  void $.store.set(STORE_KEY, board).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
  $.ui.invalidate('ui.render')
  if (board.drain && board.drain.outcome !== 'running' && before !== board.drain.outcome) {
    const text = drainLine(board) ?? ''
    $.ui.toast(`agile: ${text}`, { timeoutMs: 10000 })
    // a drain runs unattended: its end also reaches the desktop, where a notifier exists
    void $.process.run(['notify-send', 'agile-skills', text], { timeoutMs: 5000 })
      .catch(() => $.process.run(['osascript', '-e', `display notification ${JSON.stringify(text)} with title "agile-skills"`], { timeoutMs: 5000 }))
      .catch(() => undefined)
  }
}

function saveRetro($: EngineInterface, next: Retro) {
  const synced = board.drain ? retroDrain(next, board.drain.pass, board.drain.outcome) : next
  if (synced === retro) return
  retro = synced
  void $.store.set(RETRO_KEY, retro).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const host = hostOf($)
    const stored = loadBoard(await $.store.get(STORE_KEY).catch(() => undefined))
    if (stored) board = stored
    const storedRetro = loadRetro(await $.store.get(RETRO_KEY).catch(() => undefined))
    if (storedRetro) retro = storedRetro
    guardsStart(r.cwd)
    await receiptsStart(host)
    await $.command.register({
      name: 'agile-board',
      description: 'Sprint board above the prompt: show, hide, links, retro, reset (agile-mods)',
      argumentHint: '[show | hide | links | retro | reset]',
      immediate: true,
    }).catch(err => $.ui.log(`agile-mods: /agile-board not registered: ${err}`))
    await $.command.register(RECEIPTS_COMMAND).catch(err => $.ui.log(`agile-mods: /receipts not registered: ${err}`))
    if (await authoringStart(host, r.cwd)) {
      await $.command.register(VERIFY_COMMAND).catch(err => $.ui.log(`agile-mods: /agile-verify not registered: ${err}`))
    }
    return r
  })

  on('command.run', { command: 'agile-board' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'reset') {
      save($, EMPTY)
      saveRetro($, EMPTY_RETRO)
      return { text: 'agile board and retro counts cleared' }
    }
    if (arg === 'retro') return { text: retroText(retro, await $.clock.now()) ?? 'no loop data recorded yet' }
    if (arg === 'links') {
      if (!linksOf(board).length) return { text: 'no links yet: they appear once a Jira or PR result names its site' }
      await $.ui.open({ id: LINKS_PANE, title: 'agile links', closeOnEscape: true, focus: true })
      return {}
    }
    shown = arg !== 'hide'
    $.ui.invalidate('ui.render')
    return { text: shown ? 'agile board shown' : 'agile board hidden' }
  })

  on('command.run', { command: 'receipts' }, async ($, e) => ({ text: await receiptsCommand(hostOf($), e.args.trim().toLowerCase()) }))

  on('command.run', { command: 'agile-verify' }, async ($, e, next) => {
    const drift = await invariants(hostOf($))
    return { text: drift || 'invariants hold: agents ↔ dispatch, mid-phase block, Confluence tree, frontmatter' }
  })

  on('tool.call', async ($, e, next) => {
    const host = hostOf($)
    const args = argsOf(e)
    const deny = (await guardsBefore(host, e.tool, args, e.agentId)) ?? (await authoringBefore(host, e.tool, args))
    if (deny) return { deny }

    save($, observeStart(board, e.tool, args))
    saveRetro($, retroStart(retro, e.tool, args, await $.clock.now()))
    const r = await next(e)
    const done: Finished = {
      denied: r.deny !== undefined,
      isError: r.isError === true,
      text: r.deny !== undefined || r.isError ? undefined : r.text,
    }
    save($, observeTool(board, e.tool, args, done.text))
    saveRetro($, retroEnd(retro, e.tool, args, done.text))
    await receiptsAfter(host, e.tool, args, done)

    const extra = [...guardsAfter(e.tool, args, done), ...(await authoringAfter(host, e.tool, args, done))]
    if (e.tool === 'Skill' && done.text !== undefined && /(^|:)agile-15-retro$/.test(String(args.skill))) {
      const data = retroText(retro, await $.clock.now())
      if (data) extra.push(data)
    }
    return extra.length && r.deny === undefined && !r.isError ? { ...r, context: [...(r.context ?? []), ...extra] } : r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId) return r
    save($, observeAnswer(board, r.text ?? ''))
    saveRetro($, retro)
    guardsTurn(r.text ?? '')
    await authoringTurn(hostOf($))
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const idle = !board.loop && board.order.length === 0 && board.prOrder.length === 0
    if (!shown || idle || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    const { Box, Text } = await $.ui.resolve(e)
    const drain = drainLine(board)
    const color = board.drain?.outcome === 'STUCK' ? 'red' : board.drain?.outcome === 'DRAINED' ? 'green' : undefined
    // header, drain line, two section titles, and a row for whatever else draws in the band
    const rows = Math.max(2, Math.min(12, e.props.maxRows - 5))
    const build = buildLines(board, Math.ceil(rows / 2))
    const merge = mergeLines(board, rows - build.length)
    return (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate">{`agile · ${board.loop ?? 'idle'} · /agile-board links · hide`}</Text>
        {drain ? <Text color={color} bold wrap="truncate">{drain}</Text> : null}
        {build.length ? <Text bold={board.stage === 'build'} dimColor={board.stage !== 'build'}>build queue</Text> : null}
        {build.map(line => <Text key={`b:${line.slice(0, 10)}`} wrap="truncate">{line}</Text>)}
        {merge.length ? <Text bold={board.stage === 'merge'} dimColor={board.stage !== 'merge'}>merge queue</Text> : null}
        {merge.map(line => <Text key={`m:${line.slice(0, 7)}`} wrap="truncate">{line}</Text>)}
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== LINKS_PANE) return next(e)
    const { Box, Text, Link } = await $.ui.resolve(e)
    const links = linksOf(board)
    return (
      <Box flexDirection="column">
        {links.length ? links.map(l => <Link key={`l:${l.href}`} href={l.href} label={l.label} />) : <Text dimColor>no links yet</Text>}
      </Box>
    )
  })
}
