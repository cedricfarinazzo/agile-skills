/* @jsx h */
import type { EngineInterface, ProcessRunResult, Register, RenderNode } from 'claude-code'
import { EMPTY, POINTS_FIELD, applyJira, markerTargets, nextPageOf, applyPrs, applyRuns, cloudIdOf, jqlOf, judged, keysOf, loadBoard, observeStart, parkedOf, pointsFieldOf, sampled, stallsOf, stampCosts, withKeys, type Board } from './state/board.ts'
import { TABS, alertRow, chartCells, chartGlyphs, consoleRows, rasterCells, statusText, tabOf, type Row, type Tab } from './state/console.ts'
import { keepRefusal, ruleOf, type Refusal } from './state/guards.ts'
import { EMPTY_RETRO, loadRetro, retroDrain, retroEnd, retroStart, retroText, type Retro } from './state/retro.ts'
import { agentTypeOf, guardedCall, guardsAfter, guardsBefore, guardsReset, guardsStart, loopRunning } from './guards.ts'
import { argsOf, type Compare, type Finished, type Host, type PrRow, type RunRow } from './host.ts'
import { RECEIPTS_COMMAND, receiptsAfter, receiptsCommand, receiptsNow, receiptsStart } from './receipts.ts'

// The plugin's one hooks module. The board is read from the sources the mod queries itself: gh for
// PRs and CI runs, the session's Atlassian MCP server for tickets. It refreshes while a loop runs,
// shortly after the loop's own writes, and when /agile-board opens. Tool calls add only the
// dispatches themselves (which orchestrator or train step started, when). The board is kept in
// $.store and drawn three ways: a one-line status entry, an alert row above the prompt when
// something needs a person, and the agile console pane (/agile-board).
// The guards (guards.ts) and /receipts (receipts.ts) share these hooks: each event is registered
// once, and `$` reaches them only as the Host bound here.

const STORE_KEY = 'board'
const RETRO_KEY = 'retro'
const PANE = 'agile-console'
const TICK_MS = 15_000
const GH_EVERY = 15_000
const JIRA_EVERY = 60_000
const SOON_MS = 3_000
const MARKER_READS = 4
const JIRA_PAGES = 4
let board: Board = EMPTY
let retro: Retro = EMPTY_RETRO
let shown = true
let tab: Tab = 'board'
let autoOpen = true
let pointsField = POINTS_FIELD
let cloudId: string | undefined
let refusals: Refusal[] = []
let allowed = 0
let paneAt = 0
let soonQueued = false
const busy = { gh: false, jira: false }
let ghError: string | undefined
// the plugin store is shared by every repo: each key is scoped to the session's working directory
let scope = ''

const PR_NUMBER = /^\d{1,9}$/
const SHA = /^[0-9a-f]{7,40}$/
const GH_TIMEOUT = { timeoutMs: 15_000 }

/** A gh answer: stdout when it exited 0, else undefined with the first stderr line kept for the board. */
async function gh(run: Promise<ProcessRunResult>): Promise<string | undefined> {
  try {
    const r = await run
    if (r.exitCode === 0) return r.stdout
    ghError = r.stderr.trim().split('\n')[0] || `gh exited ${r.exitCode}`
  } catch (err) {
    ghError = String(err)
  }
  return undefined
}

const parsed = <T,>(text: string | undefined): T | undefined => {
  try {
    return text === undefined ? undefined : (JSON.parse(text) as T)
  } catch {
    return undefined
  }
}

/** The session's Atlassian JQL search tool, by its full name (`mcp__<server>__searchJiraIssuesUsingJql`). */
async function jiraSearchTool($: EngineInterface): Promise<string | undefined> {
  const tools = await $.tool.list().catch(() => [])
  return tools.map(t => t.name).find(n => /^mcp__.+__searchJiraIssuesUsingJql$/.test(n))
}

// Every program the mods run is written out here, argument by argument. The only computed
// arguments are a PR number and a commit sha, each checked against its pattern before the call,
// and the directory a push names. No output leaves the machine.
function hostOf($: EngineInterface): Host {
  return {
    now: () => $.clock.now(),
    branch: dir => $.process.run(['git', '-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 5_000 })
      .then(r => (r.exitCode === 0 ? r.stdout.trim() : undefined), () => undefined),
    prs: async () => parsed<PrRow[]>(await gh($.process.run(['gh', 'pr', 'list', '--state', 'all', '--limit', '100', '--json', 'number,title,headRefName,headRefOid,state,createdAt,mergedAt,url'], GH_TIMEOUT))),
    runs: async () => parsed<RunRow[]>(await gh($.process.run(['gh', 'run', 'list', '--limit', '100', '--json', 'databaseId,headSha,status,conclusion,workflowName,createdAt'], GH_TIMEOUT))),
    prView: async pr => (PR_NUMBER.test(String(pr)) ? parsed(await gh($.process.run(['gh', 'pr', 'view', String(pr), '--json', 'headRefOid,state'], GH_TIMEOUT))) : undefined),
    runsOn: async sha => (SHA.test(sha) ? parsed<RunRow[]>(await gh($.process.run(['gh', 'run', 'list', '--commit', sha, '--limit', '50', '--json', 'databaseId,headSha,status,conclusion,workflowName,createdAt'], GH_TIMEOUT))) : undefined),
    prFiles: async pr => {
      if (!PR_NUMBER.test(String(pr))) return undefined
      const out = await gh($.process.run(['gh', 'api', '--paginate', `repos/{owner}/{repo}/pulls/${pr}/files`, '--jq', '.[] | select(.status != "removed") | .filename'], GH_TIMEOUT))
      return out?.split('\n').filter(Boolean)
    },
    compare: async (base, head) => (SHA.test(base) && SHA.test(head) ? parsed<Compare>(await gh($.process.run(['gh', 'api', `repos/{owner}/{repo}/compare/${base}...${head}`, '--jq', '{status: .status, files: [.files[].filename]}'], GH_TIMEOUT))) : undefined),
    jira: async (cloud, jql, fields, page) => {
      const tool = await jiraSearchTool($)
      if (!tool) throw new Error('no Atlassian MCP server connected')
      // 50 a page: a larger answer passes the engine's MCP output limit and arrives as a notice, not JSON
      const input = { cloudId: cloud, jql, fields, maxResults: 50, responseContentFormat: 'markdown', ...(page && { nextPageToken: page }) }
      // the call goes through the session's permissions: asked first, so a refresh never opens a dialog
      const { decision } = await $.tool.check({ tool, input })
      if (decision !== 'allow') throw new Error(`allow ${tool} in /permissions to sync Jira`)
      const r = await $.mcp.call(tool.replace(/^mcp__(.+)__[^_]+$/, '$1'), 'searchJiraIssuesUsingJql', input)
      const text = r.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('')
      if (r.isError) throw new Error(text.slice(0, 120) || 'Jira search failed')
      const answer = r.structuredContent ?? parsed(text)
      if (answer === undefined) throw new Error('the Jira answer was not JSON (too large?)')
      return answer
    },
    agents: () => $.agent.list(),
    storeGet: key => $.store.get(scope + key),
    storeSet: (key, value) => $.store.set(scope + key, value),
    log: text => $.ui.log(text),
    toast: (text, timeoutMs) => $.ui.toast(text, timeoutMs ? { timeoutMs } : undefined),
  }
}

/** Re-reads PRs and CI runs with gh. */
async function syncGh($: EngineInterface) {
  if (busy.gh) return
  busy.gh = true
  try {
    const host = hostOf($)
    ghError = undefined
    const [prs, runs] = await Promise.all([host.prs(), host.runs()])
    const now = await $.clock.now()
    if (!prs || !runs) save($, { ...board, gh: { ...board.gh, error: ghError ?? 'gh failed' } })
    else save($, sampled(judged(applyRuns(applyPrs(board, prs, now), runs, now), now, false), now))
  } finally {
    busy.gh = false
  }
}

/** Re-reads the board's tickets from Jira: its projects' open sprints and every key it holds. */
async function syncJira($: EngineInterface) {
  const jql = jqlOf(board)
  if (busy.jira || !jql) return
  if (!cloudId) {
    save($, { ...board, jira: { ...board.jira, error: 'no cloudId: set it under ## Skill configuration in AGENTS.md or CLAUDE.md' } })
    return
  }
  busy.jira = true
  try {
    const host = hostOf($)
    let page: string | undefined
    for (let i = 0; i < JIRA_PAGES; i++) {
      const answer = await host.jira(cloudId, jql, ['summary', 'status', 'labels', pointsField], page)
      save($, applyJira(board, answer, pointsField, await $.clock.now()))
      page = nextPageOf(answer)
      if (!page) break
    }
    for (const key of markerTargets(board, MARKER_READS)) {
      save($, applyJira(board, await host.jira(cloudId, `key = ${key}`, ['comment']), pointsField, await $.clock.now()))
    }
    const now = await $.clock.now()
    save($, sampled(judged(board, now, false), now))
  } catch (err) {
    save($, { ...board, jira: { ...board.jira, error: err instanceof Error ? err.message : String(err) } })
  } finally {
    busy.jira = false
  }
}

/** Whether the board refreshes on its own: a loop is running, or the pane was drawn in the last minute. */
const live = (now: number) => (loopRunning() && board.drain?.outcome !== 'DRAINED') || now - paneAt < 60_000

async function tick($: EngineInterface, force = false) {
  const now = await $.clock.now()
  if (!force && !live(now)) return
  if (force || now - (board.gh?.at ?? 0) >= GH_EVERY) await syncGh($)
  if (force || now - (board.jira?.at ?? 0) >= JIRA_EVERY) await syncJira($)
}

/** A refresh a few seconds after a call that changed GitHub or Jira, once however many land. */
function soon($: EngineInterface) {
  if (soonQueued) return
  soonQueued = true
  $.clock.after(SOON_MS, () => {
    soonQueued = false
    void tick($, true).catch(() => undefined)
  })
}

const WRITES = /\b(gh\s+(pr|run|api)\b|git\s+push\b)/
const writes = (tool: string, args: Record<string, unknown>) =>
  (tool === 'Bash' && WRITES.test(String(args.command ?? ''))) || /^mcp__.+__(transitionJiraIssue|editJiraIssue|addCommentToJiraIssue|createJiraIssue|create_pull_request|merge_pull_request|update_pull_request)$/.test(tool)

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
  void $.store.set(scope + STORE_KEY, board).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
  $.ui.status(shown ? statusText(board) : undefined)
  $.ui.invalidate('ui.render')
  if (board.passes !== before.passes) stamp($)
  if (board.drain?.outcome !== before.drain?.outcome) saveRetro($, retro)
  if (autoOpen && board.drain?.outcome === 'running' && before.drain?.outcome !== 'running') {
    // opened unasked, so it waits for a wide terminal and never takes the keyboard
    void $.ui.open({ id: PANE, title: 'agile console' }).catch(() => undefined)
  }
}

function saveRetro($: EngineInterface, next: Retro) {
  const synced = board.drain ? retroDrain(next, board.drain.pass, board.drain.outcome) : next
  if (synced === retro) return
  retro = synced
  void $.store.set(scope + RETRO_KEY, retro).catch(err => $.ui.log(`agile-mods: store write failed: ${err}`))
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
    scope = `${r.cwd}:`
    const host = hostOf($)
    const stored = loadBoard(await $.store.get(scope + STORE_KEY).catch(() => undefined))
    if (stored) board = stored
    const storedRetro = loadRetro(await $.store.get(scope + RETRO_KEY).catch(() => undefined))
    if (storedRetro) retro = storedRetro
    await guardsStart(host, r.cwd)
    // agile-10-implement's story-points-field and cloudId, pinned in the consumer repo's AGENTS.md or CLAUDE.md
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      const config = await $.fs.read(`${r.cwd}/${file}`).catch(() => '')
      pointsField = pointsField === POINTS_FIELD ? (pointsFieldOf(config) ?? pointsField) : pointsField
      cloudId ??= cloudIdOf(config)
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
    $.clock.every(TICK_MS, () => void tick($).catch(() => undefined))
    return r
  })

  on('command.run', { command: 'agile-board' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'reset') {
      save($, EMPTY)
      saveRetro($, EMPTY_RETRO)
      guardsReset(hostOf($))
      refusals = []
      allowed = 0
      return { text: 'agile board and retro counts cleared' }
    }
    if (arg === 'retro') return { text: retroText(retro, board, await $.clock.now()) ?? 'no loop data recorded yet' }
    if (arg === 'hide' || arg === 'show') {
      shown = arg === 'show'
      $.ui.status(shown ? statusText(board) : undefined)
      $.ui.invalidate('ui.render')
      return { text: shown ? 'agile status and alerts shown' : 'agile status and alerts hidden' }
    }
    const wanted = arg ? tabOf(arg) : tab
    if (!wanted) return { text: `unknown tab "${arg}": board, flow, drain, guards, links, or show, hide, retro, reset` }
    tab = wanted
    paneAt = await $.clock.now()
    void tick($, true).catch(() => undefined)
    const pane = await $.ui.open({ id: PANE, title: 'agile console', focus: true, closeOnEscape: true })
    $.ui.invalidate('ui.render')
    return pane.isPlaced ? {} : { text: `the agile console needs a wider terminal (${pane.reason}); widen it and run /agile-board again` }
  })

  on('command.run', { command: 'receipts' }, async ($, e) => ({ text: await receiptsCommand(hostOf($), e.args.trim().toLowerCase()) }))

  on('tool.call', async ($, e, next) => {
    const host = hostOf($)
    const args = argsOf(e)
    const deny = await guardsBefore(host, e.tool, args, e.agentId)
    if (deny) {
      const type = e.agentId ? await agentTypeOf(host, e.agentId) : undefined
      refusals = keepRefusal(refusals, { at: await $.clock.now(), rule: ruleOf(deny), text: deny, ...(type && { agent: type.split(':').at(-1) }) })
      $.ui.toast(deny.replace(/^agile-mods:\s*/, 'agile guard: '), { timeoutMs: 8000 })
      $.ui.invalidate('ui.render')
      return { deny }
    }
    allowed += 1

    const now = await $.clock.now()
    if (typeof args.cloudId === 'string' && /^mcp__.+__/.test(e.tool)) cloudId ??= args.cloudId
    save($, withKeys(observeStart(board, e.tool, args, now), keysOf(e.tool, args)))
    saveRetro($, retroStart(retro, e.tool, args, now))
    const r = await next(e)
    const done: Finished = {
      denied: r.deny !== undefined,
      isError: r.isError === true,
      text: r.deny !== undefined || r.isError ? undefined : r.text,
    }
    await guardsAfter(host, e.tool, args, e.agentId, done.text)
    if (writes(e.tool, args) || (e.tool === 'Skill' && loopRunning())) soon($)
    saveRetro($, retroEnd(retro, e.tool, done.text))
    await receiptsAfter(host, e.tool, args, done)
    $.ui.invalidate('ui.render')

    if (e.tool === 'Skill' && done.text !== undefined && /(^|:)agile-15-retro$/.test(String(args.skill))) {
      const data = retroText(retro, board, await $.clock.now())
      if (data && r.deny === undefined && !r.isError) return { ...r, context: [...(r.context ?? []), data] }
    }
    return r
  }).catch(($, e, next) => {
    // the hook threw, timed out, or was skipped on re-entry: a call a guard covers is refused rather
    // than let through unchecked; any other call goes on
    if (next.called) return next(e)
    return guardedCall(e.tool, argsOf(e)) ? { deny: 'agile-mods: the guard could not check this call, so it refuses it. Retry it.' } : next(e)
  })

  // the main loop went idle: a drain with work left whose pass moved nothing is STUCK
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || !loopRunning()) return r
    await syncGh($).catch(() => undefined)
    const now = await $.clock.now()
    save($, sampled(judged(board, now, true), now))
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
    paneAt = await $.clock.now()
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
