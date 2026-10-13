// Draws the overview pictures in this folder: the cycle, a drain run and the merge train.
// The drain text is the skill's own example (agile-sprint-drain SKILL.md, Report); the step names are the
// train's 3a-3g. Run after a flow changes: bun docs/img/generate.ts
import { writeFileSync } from 'node:fs'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const P = { bg: '#1e1e2e', box: '#313244', line: '#585b70', fg: '#cdd6f4', d: '#7f849c', c: '#89dceb', g: '#a6e3a1', y: '#f9e2af', r: '#f38ba8', b: '#89b4fa', m: '#f5c2e7' }
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, DejaVu Sans Mono, monospace'
const FONT = `font-family="${MONO}" font-size="14"`
const wrap = (w: number, h: number, body: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${FONT} xml:space="preserve">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="${P.line}"/></marker>${defs}</defs>
<rect width="${w}" height="${h}" rx="10" fill="${P.bg}"/>
${body}
</svg>
`
const box = (x: number, y: number, w: number, h: number, title: string, sub: string[], color: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${P.box}" stroke="${color}" stroke-width="1.5"/>` +
  `<text x="${x + 12}" y="${y + 22}" fill="${color}" font-weight="bold">${esc(title)}</text>` +
  sub.filter(Boolean).map((s, i) => `<text x="${x + 12}" y="${y + 42 + i * 18}" fill="${P.fg}" font-size="12">${esc(s)}</text>`).join('')
const arrow = (x1: number, y1: number, x2: number, y2: number, dash = false) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${P.line}" stroke-width="1.5"${dash ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#a)"/>`
const label = (x: number, y: number, t: string, c = P.d) => `<text x="${x}" y="${y}" fill="${c}" font-size="12">${esc(t)}</text>`

// cycle.svg: the plugins in order, the autonomous core, the loop back to the roadmap
function cycle() {
  const W = 920, H = 380
  let b = ''
  const row1 = [
    ['agile-product', ['1 Vision Doc', '2 PRD', '3 Design Brief', '4 ADR'], P.b],
    ['agile-planning', ['5 Roadmap', '6 Epics', '7 Stories', '8 Refinement', '9 Sprint planning'], P.m],
  ] as const
  b += box(20, 20, 200, 108, row1[0][0], [...row1[0][1]], row1[0][2])
  b += box(260, 20, 200, 126, row1[1][0], [...row1[1][1]], row1[1][2])
  b += arrow(220, 74, 258, 74) + arrow(460, 74, 498, 74)
  b += box(500, 20, 400, 150, 'agile-sprint-drain  (autonomous)', ['alternates build and merge to a fixed point', '', '', ''], P.g)
  b += box(516, 70, 168, 84, 'agile-execution', ['10 Implement', 'ticket → open PR'], P.c)
  b += box(716, 70, 168, 84, 'agile-merge-review', ['11 Merge train', 'open PR → main'], P.c)
  b += arrow(684, 98, 714, 98) + arrow(714, 126, 686, 126)
  b += box(260, 220, 640, 90, 'agile-sprint-close', ['12 Tech-debt sweep   →   13 Closeout   →   14 QA validation   →   15 Retro'], P.y)
  b += arrow(700, 172, 700, 218)
  b += label(710, 200, 'DRAINED')
  b += `<path d="M260 265 H 240 V 90 H 258" fill="none" stroke="${P.line}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a)"/>`
  b += label(24, 215, 'retro feeds the next', P.d) + label(24, 233, 'iteration (5 Roadmap)', P.d)
  b += label(20, 350, 'out of cycle: deep-refactor · project-review · session-audit   ·   Claude Mods: agile-mods', P.d)
  return wrap(W, H, b)
}

// drain.svg: the banner stream of one drain
function drain() {
  type L = [string, string?][]
  const lines: L[] = [
    [['══ drain pass 1 ══', P.c], ['   eligible:5  wip:0/2  admit:2', P.fg]],
    [['▶ ', P.c], ['agile-10-implement keys=PROJ-101,PROJ-102', P.fg]],
    [['✓ PROJ-101 → In Review', P.g], ['  ', P.fg], ['✓ PROJ-102 → In Review', P.g]],
    [['▶ ', P.c], ['agile-11-merge-train (PR #88, #89)', P.fg]],
    [['✓ PROJ-101 PR #88 merged → Done', P.g], ['  ', P.fg], ['✓ PROJ-102 PR #89 merged → Done', P.g]],
    [['══ drain pass 2 ══', P.c], ['   eligible:6  wip:0/2  admit:2', P.fg], ['   (3 newly unblocked by pass-1 merges)', P.d]],
    [['…', P.d]],
    [['══ DRAINED ══', P.g], ['   12 tickets Done, 0 remaining', P.fg]],
  ]
  const CW = 8.4, LH = 22, PAD = 22, W = 800, H = lines.length * LH + 84
  let y = 60, b = `<circle cx="20" cy="16" r="5" fill="${P.r}"/><circle cx="36" cy="16" r="5" fill="${P.y}"/><circle cx="52" cy="16" r="5" fill="${P.g}"/>` +
    `<text x="${W / 2}" y="20" fill="${P.d}" text-anchor="middle" font-size="12">/agile-sprint-drain:agile-sprint-drain concurrency=2</text>`
  for (const l of lines) {
    let x = PAD
    for (const [t, c] of l) { b += `<text x="${x}" y="${y}" fill="${c}"${t.startsWith('══') ? ' font-weight="bold"' : ''}>${esc(t)}</text>`; x += [...t].length * CW }
    y += LH
  }
  b += label(PAD, y + 14, 'the loop repeats until both queues are empty (DRAINED) or only human-blocked work remains (STUCK)')
  return wrap(W, H, b)
}

// merge-train.svg: 3a-3g for one PR, with the reviewed-sha gate that loops back to CI
function train() {
  const W = 900, H = 330
  const steps: [string, string, string][] = [
    ['3a', 'update', 'rebase on main'],
    ['3b', 'review', 'read every file at the reviewed sha'],
    ['3c', 'fix', 'Critical + Minor, lint before push'],
    ['3e', 'CI', 'fresh run on the head'],
    ['3f', 'merge', 'pinned to the reviewed sha'],
    ['3g', 'postmortem', 'comment + Done'],
  ]
  let b = '', x = 20
  const bw = 130, gap = 18, y = 60
  steps.forEach(([id, name, sub], i) => {
    b += `<rect x="${x}" y="${y}" width="${bw}" height="112" rx="8" fill="${P.box}" stroke="${i === 4 ? P.g : P.c}" stroke-width="1.5"/>`
    b += `<text x="${x + 10}" y="${y + 22}" fill="${P.d}" font-size="12">${id}</text><text x="${x + 10}" y="${y + 44}" fill="${P.fg}" font-weight="bold">${esc(name)}</text>`
    const words = sub.split(' '); let line = '', ly = y + 64
    for (const w of words) { if ((line + ' ' + w).trim().length > 15) { b += `<text x="${x + 10}" y="${ly}" fill="${P.fg}" font-size="11">${esc(line)}</text>`; line = w; ly += 14 } else line = (line + ' ' + w).trim() }
    b += `<text x="${x + 10}" y="${ly}" fill="${P.fg}" font-size="11">${esc(line)}</text>`
    if (i < steps.length - 1) b += arrow(x + bw, y + 46, x + bw + gap - 2, y + 46)
    x += bw + gap
  })
  // gate: landing tip must equal the reviewed sha, else delta review -> back to CI
  const gx = 20 + 4 * (bw + gap) + bw / 2
  b += `<path d="M${gx} ${y + 112} V ${y + 150} H ${20 + 3 * (bw + gap) + bw / 2} V ${y + 114}" fill="none" stroke="${P.y}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a)"/>`
  b += label(20 + 3 * (bw + gap) + 4, y + 170, 'landing tip ≠ reviewed sha: review the delta, back to CI', P.y)
  // escape hatch
  b += `<path d="M${20 + 2 * (bw + gap) + bw / 2} ${y} V ${y - 22} H ${20 + 5 * (bw + gap) + bw / 2} V ${y - 2}" fill="none" stroke="${P.r}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a)"/>`
  b += label(20 + 2 * (bw + gap) + 4, y - 30, '3d: too broken to fix in one pass → postmortem (blocked), no merge', P.r)
  b += label(20, y + 230, 'one PR at a time: each merge changes main, so the next PR rebases on the new tip and re-runs CI', P.d)
  b += label(20, y + 250, 'a PR gets at most 2 review rounds per run and 3 fix rounds across runs; a 4th goes to a human', P.d)
  return wrap(W, H, b)
}

const out = (n: string, s: string) => writeFileSync(new URL(n, import.meta.url), s)
out('cycle.svg', cycle())
out('drain.svg', drain())
out('merge-train.svg', train())
