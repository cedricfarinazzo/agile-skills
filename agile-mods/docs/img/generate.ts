// Draws the console pictures in this folder from the console's own rows (hooks/state/console.ts) over a
// sample board, so they show what the pane draws. Run after a view changes: bun docs/img/generate.ts

import { consoleRows, statusText, alertRow, chartGlyphs, TABS } from '../../hooks/state/console.ts'

const SHA = 'a3f9c21'.padEnd(40, '0')
const HOUR = 3_600_000, NOW = 30 * HOUR
const board: any = {
  tickets: {
    'SHOP-12': { key: 'SHOP-12', status: 'Done', category: 'done', pr: 40, points: 3 },
    'SHOP-14': { key: 'SHOP-14', status: 'In Review', category: 'indeterminate', phase: 'review', pr: 42, points: 5, since: 20 * HOUR },
    'SHOP-15': { key: 'SHOP-15', status: 'In Progress', category: 'indeterminate', phase: 'implement', points: 3, since: 26 * HOUR },
    'SHOP-16': { key: 'SHOP-16', status: 'To Do', category: 'new', points: 2 },
    'SHOP-17': { key: 'SHOP-17', status: 'Needs Info', category: 'indeterminate', parked: 'needs-info', points: 2 },
  },
  order: ['SHOP-12', 'SHOP-14', 'SHOP-15', 'SHOP-16', 'SHOP-17'],
  prs: {
    40: { number: 40, key: 'SHOP-12', state: 'MERGED', merged: true, step: 'merged', createdAt: 2 * HOUR, mergedAt: 9 * HOUR },
    42: { number: 42, key: 'SHOP-14', state: 'OPEN', step: '3b review', seen: { '3a update': 1, '3b review': 1 }, head: SHA, createdAt: 22 * HOUR, files: ['src/cart.ts', 'src/cart.test.ts', 'docs/cart.md'], filesHead: SHA },
  },
  prOrder: [40, 42], loop: 'drain', stage: 'merge', drain: { pass: 2, outcome: 'running' }, since: 0,
  burn: [{ at: 0, left: 13, total: 13, done: 0 }, { at: 5 * HOUR, left: 13, total: 13, done: 0 }, { at: 9 * HOUR, left: 10, total: 13, done: 3 }, { at: 14 * HOUR, left: 12, total: 15, done: 3 }, { at: 22 * HOUR, left: 10, total: 15, done: 5 }, { at: 29 * HOUR, left: 10, total: 15, done: 5 }],
  burnUnit: 'points',
  passes: [{ start: 0, merge: 6 * HOUR, end: 12 * HOUR, cost0: 0, cost1: 4.2, built: 1, merged: 1 }, { start: 12 * HOUR, merge: 25 * HOUR, cost0: 4.2 }],
  history: { merges: Array.from({ length: 24 }, (_, d) => NOW - d * 86_400_000 * 1.2), cycles: [5, 8, 12, 20, 26, 30].map(h => h * HOUR) },
  spend: { usd: 7.9, since: 0 }, site: 'https://acme.atlassian.net', repo: 'https://github.com/acme/shop', gh: { at: NOW - 40_000 }, jira: { at: NOW - 90_000 },
}
const refusals: any[] = [
  { id: 1, at: NOW - 900_000, rule: 'push', text: 'agile-mods: the loop never pushes to main: work lands through a PR and gh pr merge.', agent: 'build-implementer' },
  { id: 2, at: NOW - 300_000, rule: '3f', text: 'agile-mods: PR #42: no review read 1 file(s) as they land at a3f9c2100000: docs/cart.md. Then read what is missing yourself (3b).', agent: 'merge-session', offer: { rule: '3f', pr: 42, head: SHA } },
]
const guard = { modes: 'grants enforce · mergeReview enforce · push enforce · fixRounds 3 · budget $25 · bypass on', notes: [], allowances: [], bypass: true, coverage: [{ pr: 42, head: SHA, files: { 'src/cart.ts': 'full', 'src/cart.test.ts': 'delta', 'docs/cart.md': undefined } }] }
const lanes = [{ name: 'merge-session', work: 'PR #42', status: 'running', age: 840_000, tokens: 1_240_000, hit: 0.93, idle: 20_000 }, { name: 'build-session', work: 'SHOP-15', status: 'running', age: 2_300_000, tokens: 2_800_000, hit: 0.88, wait: 'run 8812', idle: 60_000 }, { name: 'build-session', work: 'SHOP-14', status: 'completed', age: 5_100_000, tokens: 3_900_000, hit: 0.9, idle: 0 }]
const ctx: any = { lanes, now: NOW, usd: 7.9, refusals, allowed: 214, receipts: [{ agent: 'agile-merge-review:pr-reviewer', at: 0, pr: 42, issues: [] }], budget: 25, guard }

const W = 92, CW = 8.4, LH = 19, PAD = 18
const C: Record<string, string> = { fg: '#cdd6f4', d: '#7f849c', c: '#89dceb', m: '#f5c2e7', g: '#a6e3a1', y: '#f9e2af', r: '#f38ba8', bl: '#89b4fa' }
const BG: Record<string, string> = { bgr: '#f38ba8', bgg: '#a6e3a1', bgy: '#f9e2af' }
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function style(tags = '') {
  let fill = C.fg, bold = false, bg: string | undefined
  for (const t of tags.split(' ')) { if (C[t]) fill = C[t]!; if (t === 'b') bold = true; if (BG[t]) { bg = BG[t]; fill = '#11111b' } }
  return { fill, bold, bg }
}
type Seg = { t: string; c?: string }
function lineSvg(segs: Seg[], x0: number, y: number): string {
  let x = x0, out = ''
  for (const s of segs) {
    if (!s.t) continue
    const st = style(s.c)
    if (st.bg) out += `<rect x="${x}" y="${y - 14}" width="${s.t.length * CW}" height="${LH - 1}" rx="2" fill="${st.bg}"/>`
    // browsers drop a text element's leading blanks: move the x instead
    const lead = s.t.length - s.t.trimStart().length
    const shown = s.t.trimStart().replace(/⏸/g, '‖').replace(/⏳/g, '◷')
    if (shown) out += `<text x="${x + lead * CW}" y="${y}" fill="${st.fill}"${st.bold ? ' font-weight="bold"' : ''}>${esc(shown)}</text>`
    x += [...s.t].length * CW
  }
  return out
}
function frame(title: string, body: string, rows: number, tabs?: string) {
  const w = W * CW + PAD * 2, h = rows * LH + PAD * 2 + 30
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, DejaVu Sans Mono, monospace" font-size="14" xml:space="preserve" style="white-space:pre">
<rect width="${w}" height="${h}" rx="10" fill="#1e1e2e"/>
<circle cx="20" cy="16" r="5" fill="#f38ba8"/><circle cx="36" cy="16" r="5" fill="#f9e2af"/><circle cx="52" cy="16" r="5" fill="#a6e3a1"/>
<text x="${w / 2}" y="20" fill="#7f849c" text-anchor="middle" font-size="12">${esc(title)}</text>
${body}
</svg>
`
}
function pane(tab: string): string {
  const rows = consoleRows(tab as any, board, ctx, W)
  let y = 30 + PAD + 12, body = ''
  // tab bar
  let x = PAD
  for (const t of TABS) { const label = `${t.label}`; body += `<text x="${x}" y="${y}" fill="${t.id === tab ? C.fg : C.d}"${t.id === tab ? ' font-weight="bold" text-decoration="underline"' : ''}>${label}</text>`; x += (label.length + 3) * CW }
  y += LH * 2
  let n = 2
  for (const r of rows) {
    if (r.kind === 'line') { body += lineSvg(r.segs, PAD, y); y += LH; n++ }
    else if (r.kind === 'tiles') {
      const tw = (W * CW - (r.tiles.length - 1) * CW) / r.tiles.length
      r.tiles.forEach((t: any, i: number) => {
        const tx = PAD + i * (tw + CW)
        body += `<rect x="${tx}" y="${y - 14}" width="${tw}" height="${LH * 3 + 6}" rx="6" fill="none" stroke="#585b70"/>`
        body += lineSvg([{ t: t.label, c: 'd' }], tx + 10, y + 2) + lineSvg([{ t: t.value, c: `b ${t.tone}` }], tx + 10, y + 2 + LH) + lineSvg([{ t: t.sub, c: 'd' }], tx + 10, y + 2 + LH * 2)
      })
      y += LH * 3 + 10; n += 3.5
    } else if (r.kind === 'chart') { for (const segs of chartGlyphs(r.chart)) { body += lineSvg(segs as Seg[], PAD, y); y += LH; n++ } }
    else if (r.kind === 'allow') {
      const label = `Allow once [${r.n}]`
      body += `<rect x="${PAD + 10 * CW}" y="${y - 14}" width="${(label.length + 2) * CW}" height="${LH}" rx="4" fill="#313244" stroke="#cba6f7"/>`
      body += lineSvg([{ t: ` ${label}`, c: 'm b' }], PAD + 10 * CW, y) + lineSvg([{ t: r.label, c: 'd' }], PAD + (label.length + 13) * CW, y)
      y += LH + 2; n++
    }
  }
  return frame(`/agile-board ${tab}`, body, n + 1)
}
const out = `${import.meta.dir}/`
for (const t of ['board', 'flow', 'drain', 'guards']) await Bun.write(`${out}console-${t}.svg`, pane(t))
// status + alert above the prompt
{
  let y = 30 + PAD + 12, body = ''
  body += lineSvg([{ t: '… the transcript …', c: 'd' }], PAD, y); y += LH * 2
  const alert = alertRow(board, ctx, W) as any
  body += lineSvg(alert.segs, PAD, y); y += LH
  body += `<rect x="${PAD - 4}" y="${y - 12}" width="${W * CW + 8}" height="${LH + 8}" rx="4" fill="none" stroke="#585b70"/>`
  body += lineSvg([{ t: '> ', c: 'd' }, { t: 'drain the sprint', c: '' }], PAD + 4, y + 6); y += LH * 2
  body += lineSvg([{ t: statusText(board, NOW, 25, 0)!, c: 'd' }], PAD, y)
  await Bun.write(`${out}status-and-alert.svg`, frame('the prompt area', body, 7))
}
console.log('ok')
