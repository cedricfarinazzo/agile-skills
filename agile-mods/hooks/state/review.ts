// Pure review coverage behind the 3f reviewed-tree gate. A review is the set of files a reviewer
// read at a sha, taken from the `git show <sha>:<path>` and `git diff <a>..<b>` commands it ran,
// never from its receipt.

/** Paths read in full, by the full sha they were read at. */
export type Reads = Record<string, string[]>
/** Line ranges read of a file too large for one command, by sha then path; END ends at the file's end. */
export type Parts = Record<string, Record<string, [number, number][]>>
/** Diffs read, by the sha diffed to: each the sha diffed from and the paths it covered ('*': every path). */
export type Diffs = Record<string, { from: string; paths: string[] | '*' }[]>
/** The end of a `tail -n +A` range: a number, since the store keeps JSON and JSON has no Infinity. */
export const END = Number.MAX_SAFE_INTEGER

const MAX_SHAS = 60
const MAX_PATHS = 2000
const HEX = /^[0-9a-f]{7,40}$/
const SHOW = /^git\s+(?:-C\s+(\S+)\s+)?(?:--no-pager\s+)?(?:show|cat-file\s+-p)\s+(.+)$/
const DIFF = /^git\s+(?:-C\s+(\S+)\s+)?(?:--no-pager\s+)?diff\s+(.+)$/
// a sha of 7 to 40 hex: the guard resolves it to the full sha in the repository the read ran in
const SPEC = /^([0-9a-f]{7,40}):(.+)$/
/** A pipe into anything but these drops part of the output, so the read does not count. */
const WHOLE = /^(cat(\s+-n)?|nl|tee\s+\S+)$/
/** Flags that keep every changed line of a diff. */
const DIFF_KEEPS = /^(-U\d+|--unified=\d+|-p|--patch|--no-color|--color=never|--no-ext-diff)$/
/** Flags that print a diff without its lines, or with some of them hidden. */
const DIFF_HIDES = /^(--stat\S*|--shortstat|--numstat|--name-only|--name-status|--summary|--dirstat\S*|-w|--ignore-\S+|-b|--diff-filter\S*|-S\S*|-G\S*|--quiet|--exit-code)$/
/** Shell syntax the parser does not model inside one command: quotes, expansion, redirection, subshells, comments. */
const UNMODELLED = /["'`$\\<>()#{}]/

/** One line range kept by a pipe: `sed -n A,Bp`, `head -n N` (or `head -N`), `tail -n +A`. */
function rangeOf(pipe: string): [number, number] | undefined {
  let m = pipe.match(/^sed\s+-n\s+(\d+),(\d+)p$/)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= Number(m[2])) return [Number(m[1]), Number(m[2])]
  // `head -n -N` prints all but the last N lines, so only a positive count is a range
  m = pipe.match(/^head\s+(?:-n\s*(\d+)|-(\d+))$/)
  if (m) return [1, Number(m[1] ?? m[2])]
  m = pipe.match(/^tail\s+-n\s*\+(\d+)$/)
  if (m) return [Number(m[1]), END]
  return undefined
}

export const sameSha = (a: string, b: string) => a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a))

/** A file read, as the command wrote it: the sha may be abbreviated; `dir` is where it ran (`cd`, `-C`). */
export type Spec = { sha: string; path: string; range?: [number, number]; dir?: string }
/** A diff read: every changed line from `from` to `to`, for `paths` or every path. */
export type DiffRead = { from: string; to: string; paths?: string[]; dir?: string }
/** What one command read, and why each part that names a sha did not count. */
export type Parsed = { reads: Spec[]; diffs: DiffRead[]; skipped: string[] }

type Segment = { text: string; join: '' | ';' | '&&' | '||' }

/**
 * A line split where the shell runs one command after another: at `;`, `&&`, `||` and newlines
 * outside quotes, `$(…)`, `(…)` and backticks. Undefined when the line backgrounds a command, holds a
 * heredoc or leaves a quote open, since then the output cannot be tied to a command.
 */
function segmentsOf(command: string): Segment[] | undefined {
  if (/<</.test(command)) return undefined
  const out: Segment[] = []
  let cur = ''
  let join: Segment['join'] = ''
  let quote: '' | "'" | '"' | '`' = ''
  let depth = 0
  const push = (next: Segment['join']) => {
    out.push({ text: cur.trim(), join })
    cur = ''
    join = next
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]!
    if (quote) {
      if (c === '\\' && quote !== "'") {
        cur += c + (command[++i] ?? '')
        continue
      }
      if (c === quote) quote = ''
      cur += c
      continue
    }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    else if (c === '\\') {
      cur += c + (command[++i] ?? '')
      continue
    }
    if (!depth && !quote) {
      const two = command.slice(i, i + 2)
      if (two === '&&' || two === '||') {
        push(two)
        i++
        continue
      }
      if (c === ';' || c === '\n') {
        push(';')
        continue
      }
      // a lone & backgrounds the command before it; &> and >& are redirections, left to UNMODELLED
      if (c === '&' && command[i - 1] !== '>' && command[i + 1] !== '>') return undefined
    }
    cur += c
  }
  if (quote) return undefined
  push('')
  return out.filter(s => s.text)
}

/** A command that always succeeds and prints nothing a reviewer reads: separators between reads. */
const QUIET = /^(echo(\s+('[^']*'|"[^"$`\\]*"|[\w=.:\/+-]+))*|true|:)$/
const CD = /^cd\s+([^\s"'`$\\<>()#{};&|]+)$/
const ASSIGN = /^(?:export\s+)?([A-Za-z_]\w*)=(\S*)$/

/** Every file a command read, in full or as one line range, and every diff it read; a part naming a sha that did not count says why. */
export function parseReads(command: string): Parsed {
  const parsed: Parsed = { reads: [], diffs: [], skipped: [] }
  // `sed -n '1,400p'` quotes only digits, so it reads the same unquoted
  command = command.trim().replace(/(\|\s*sed\s+-n\s+)(['"])(\d+,\d+p)\2/g, '$1$3')
  const segments = segmentsOf(command)
  if (!segments) {
    if (/\bgit\b[^\n]*\b(show|cat-file|diff)\b/.test(command)) parsed.skipped.push('the line backgrounds a command, holds a heredoc or leaves a quote open: run each read as its own plain command')
    return parsed
  }
  const vars = new Map<string, string>()
  let dir: string | undefined
  // whether every command since the last `;` is one that succeeds: a read after `&&` runs only then
  let sure = true
  for (const seg of segments) {
    if (seg.join === ';' || seg.join === '') sure = true
    let text = seg.text
    const cd = text.match(CD)
    if (cd) {
      dir = cd[1]!.startsWith('/') || !dir ? cd[1]! : `${dir}/${cd[1]!}`
      continue
    }
    const assign = text.match(ASSIGN)
    if (assign) {
      if (HEX.test(assign[2]!)) vars.set(assign[1]!, assign[2]!)
      else vars.delete(assign[1]!)
      continue
    }
    if (QUIET.test(text)) continue
    // a sha set in a variable earlier on the line: `$S` and `${S}` read as that sha
    text = text.replace(/\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => vars.get(a ?? b) ?? m)
    const names = /\bgit\b.*\b(show|cat-file|diff)\b/.test(text) && /[0-9a-f]{7}/.test(text)
    const read = readOf(text, dir)
    if (typeof read === 'string') {
      if (names) parsed.skipped.push(`\`${seg.text.slice(0, 80)}\` ${read}`)
      sure = false
      continue
    }
    if (seg.join === '||' || !sure) {
      parsed.skipped.push(`\`${seg.text.slice(0, 80)}\` runs only when the command before it ${seg.join === '||' ? 'fails' : 'succeeds'}: run it on its own`)
      continue
    }
    parsed.reads.push(...read.reads)
    parsed.diffs.push(...read.diffs)
  }
  return parsed
}

/** One command as a read: its files and diffs, or why it is not one. */
function readOf(text: string, dir: string | undefined): { reads: Spec[]; diffs: DiffRead[] } | string {
  if (UNMODELLED.test(text)) return 'is not a plain read (quotes, $, redirection or a subshell): run git show <sha>:<path> on its own'
  const [head, ...pipes] = text.split('|').map(s => s.trim())
  const ranges = pipes.map(rangeOf)
  const range = ranges.find(Boolean)
  if (ranges.filter(Boolean).length > 1 || pipes.some((p, i) => !ranges[i] && !WHOLE.test(p))) {
    return 'pipes the read through a filter that drops lines: pipe only into one sed -n A,Bp, head -n N or tail -n +A'
  }
  const show = head!.match(SHOW)
  if (show) {
    const words = show[2]!.split(/\s+/)
    if (range && words.length !== 1) return 'cuts a range out of several files: read one file per range'
    const reads: Spec[] = []
    for (const word of words) {
      const spec = word.match(SPEC)
      if (!spec || /[*?\[]/.test(spec[2]!)) return 'names something other than <sha>:<path>'
      reads.push({ sha: spec[1]!, path: spec[2]!.replace(/^\.\//, ''), ...(range && { range }), ...((show[1] ?? dir) && { dir: show[1] ?? dir }) })
    }
    return { reads, diffs: [] }
  }
  const diff = head!.match(DIFF)
  if (diff) {
    if (range) return 'cuts a range out of a diff: read the whole diff, or one diff per path'
    const words = diff[2]!.split(/\s+/)
    const dash = words.indexOf('--')
    const opts = dash < 0 ? words : words.slice(0, dash)
    const paths = dash < 0 ? undefined : words.slice(dash + 1)
    const hidden = opts.find(w => DIFF_HIDES.test(w))
    if (hidden) return `uses ${hidden}, which hides changed lines: a diff counts only with every line shown`
    if (opts.some(w => w.startsWith('-') && !DIFF_KEEPS.test(w))) return 'uses a diff option the guard does not read: use git diff <reviewed sha>..<head> [-- <path>…]'
    const revs = opts.filter(w => !w.startsWith('-'))
    const pair = revs.length === 1 ? revs[0]!.match(/^([0-9a-f]{7,40})\.\.([0-9a-f]{7,40})$/) : revs.length === 2 && HEX.test(revs[0]!) && HEX.test(revs[1]!) ? [, revs[0], revs[1]] : null
    if (!pair) return 'does not diff two shas: use git diff <reviewed sha>..<head> (two dots, two shas)'
    if (paths && (!paths.length || paths.some(p => /[*?\[]/.test(p)))) return 'limits the diff with a pattern: name each path'
    const where = diff[1] ?? dir
    return { reads: [], diffs: [{ from: pair[1]!, to: pair[2]!, ...(paths && { paths: paths.map(p => p.replace(/^\.\//, '')) }), ...(where && { dir: where }) }] }
  }
  return 'is not a read'
}

/** The full reads of a command, sha as written: for tests and callers that need no resolving. */
export const readsOf = (command: string): Omit<Spec, 'dir'>[] => parseReads(command).reads.map(({ dir: _, ...r }) => r)

/** Output past the Bash tool's limit reaches the model as a short preview, so nothing in it was read in full. */
export const MAX_OUTPUT = 30_000
/** The size a chunk aims at, under MAX_OUTPUT with room for line numbers. */
export const CHUNK = 25_000
const PERSISTED = /<persisted-output>|Output too large/
export const truncated = (output: string) => output.length > MAX_OUTPUT || PERSISTED.test(output)

/**
 * The reads a git error in the output voids: each whose path or sha a `fatal:` or `error:` line
 * names, or every read when an error names none of them.
 */
export function failedIn(output: string, parsed: Parsed): Parsed {
  const errors = output.split('\n').filter(l => /^(fatal|error): /.test(l))
  if (!errors.length) return parsed
  const named = (sha: string, path: string) => errors.some(l => l.includes(path.split('/').at(-1)!) || l.includes(sha.slice(0, 7)))
  const all = errors.some(l => !parsed.reads.some(r => named(r.sha, r.path)) && !parsed.diffs.some(d => l.includes(d.from.slice(0, 7)) || l.includes(d.to.slice(0, 7))))
  const reads = parsed.reads.filter(r => !all && !named(r.sha, r.path))
  const diffs = parsed.diffs.filter(d => !all && !errors.some(l => l.includes(d.from.slice(0, 7)) || l.includes(d.to.slice(0, 7))))
  const lost = parsed.reads.length + parsed.diffs.length - reads.length - diffs.length
  return { reads, diffs, skipped: [...parsed.skipped, ...(lost ? [`git reported an error (${errors[0]!.slice(0, 80)}), so ${lost} read(s) in the command did not count`] : [])] }
}

const capShas = <T,>(next: Record<string, T>) => {
  const shas = Object.keys(next)
  return shas.length > MAX_SHAS ? Object.fromEntries(shas.slice(-MAX_SHAS).map(s => [s, next[s]!])) : next
}

/** Adds full reads (sha resolved); the same object when nothing is new. */
export function addReads(reads: Reads, specs: Spec[]): Reads {
  let next = reads
  for (const { sha, path, range } of specs) {
    if (range) continue
    const known = next[sha] ?? []
    if (known.includes(path)) continue
    const { [sha]: _, ...rest } = next
    next = { ...rest, [sha]: [...known, path].slice(-MAX_PATHS) }
  }
  return next === reads ? reads : capShas(next)
}

/** Adds line ranges (sha resolved); the same object when there are none. */
export function addParts(parts: Parts, specs: Spec[]): Parts {
  let next = parts
  for (const { sha, path, range } of specs) {
    if (!range) continue
    const files = next[sha] ?? {}
    next = { ...next, [sha]: { ...files, [path]: [...(files[path] ?? []), range].slice(-200) } }
  }
  return next === parts ? parts : capShas(next)
}

/** Adds diff reads (shas resolved); the same object when nothing is new. */
export function addDiffs(diffs: Diffs, list: DiffRead[]): Diffs {
  let next = diffs
  for (const { from, to, paths } of list) {
    const known = next[to] ?? []
    const covered = paths ?? '*'
    if (known.some(d => d.from === from && (d.paths === '*' || (covered !== '*' && covered.every(p => (d.paths as string[]).includes(p)))))) continue
    next = { ...next, [to]: [...known, { from, paths: covered }].slice(-50) }
  }
  return next === diffs ? diffs : capShas(next)
}

/** Full reads of a command whose shas are already full, for tests: the same rules as the hook. */
export function withReads(reads: Reads, command: string, output: string): Reads {
  if (truncated(output)) return reads
  return addReads(reads, failedIn(output, parseReads(command)).reads.filter(r => r.sha.length === 40))
}

/** Whether line ranges cover lines 1 to `lines` with no gap. */
export function covers(ranges: [number, number][], lines: number): boolean {
  let upTo = 0
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    if (a > upTo + 1) return false
    upTo = Math.max(upTo, b)
  }
  return upTo >= lines
}

/** The ranges read of a file at a sha matching `sha` (full or abbreviated). */
export const partsAt = (parts: Parts, sha: string, path: string) =>
  Object.keys(parts).filter(s => sameSha(s, sha)).flatMap(s => parts[s]![path] ?? [])

/** The shas a read was recorded at that match `sha` (full or abbreviated either way). */
export const readShas = (reads: Reads, sha: string) => Object.keys(reads).filter(s => sameSha(s, sha))

/** Whether any review read was recorded at `sha`: a full read, a range, or a diff ending there. */
export const reviewedAt = (reads: Reads, parts: Parts, diffs: Diffs, sha: string) =>
  readShas(reads, sha).length > 0 || Object.keys(parts).some(s => sameSha(s, sha)) || Object.keys(diffs).some(s => sameSha(s, sha))

/**
 * Line ranges that each print at most `limit` characters: the chunk plan for a file too large for
 * one read. A single line longer than the limit is a chunk of its own.
 */
export function planChunks(text: string, limit = CHUNK): [number, number][] {
  const lines = text.split('\n')
  if (text.endsWith('\n')) lines.pop()
  const out: [number, number][] = []
  let start = 1
  let size = 0
  lines.forEach((l, i) => {
    const n = l.length + 1
    if (size && size + n > limit) {
      out.push([start, i])
      start = i + 1
      size = 0
    }
    size += n
  })
  if (lines.length) out.push([start, lines.length])
  return out
}

export const chunkText = (sha: string, path: string, plan: [number, number][]) =>
  `git show ${sha}:${path} | sed -n ${plan.map(([a, b]) => `${a},${b}p`).join(' · ')}`

/** One changed path between two trees (`git diff --name-status -M`): A added, M modified, D deleted, R renamed from `from`. */
export type Change = { status: string; path: string; from?: string }

/** What the coverage check asks git, cached by the caller. */
export type Know = {
  /** The paths that differ from one tree to another; undefined when git cannot say. */
  changes: (from: string, to: string) => Promise<Change[] | undefined>
  /** The line count of a file at a sha; undefined when git cannot say. */
  lines: (sha: string, path: string) => Promise<number | undefined>
}

/** How a file counts as read at a sha: in full, by ranges, unchanged since a read, or by a diff since one. */
export type How = 'full' | 'ranges' | 'carried' | 'delta'

const DEPTH = 5
const SOURCES = 8

/**
 * How `path` counts as read at `sha`, or undefined. In full or in ranges at that sha; unchanged from
 * a sha where it counts (the trees agree, whatever the history); or changed, with a diff from such a
 * sha read for it. A file added since is shown whole by the diff; a renamed one counts when the diff
 * showed it whole or its old path counts.
 */
export function howRead(state: { reads: Reads; parts: Parts; diffs: Diffs }, know: Know, sha: string, path: string, depth = 0, seen = new Set<string>()): Promise<How | undefined> {
  const key = `${sha}:${path}`
  if (seen.has(key)) return Promise.resolve(undefined)
  // the same question at the same depth has the same answer: asked once per Know and state
  const byState = memos.get(know) ?? new WeakMap<object, Map<string, Promise<How | undefined>>>()
  memos.set(know, byState)
  const memo = byState.get(state) ?? new Map<string, Promise<How | undefined>>()
  byState.set(state, memo)
  const at = `${key}@${depth}`
  if (!memo.has(at)) memo.set(at, howReadOnce(state, know, sha, path, depth, new Set(seen).add(key)))
  return memo.get(at)!
}

const memos = new WeakMap<Know, WeakMap<object, Map<string, Promise<How | undefined>>>>()

async function howReadOnce(state: { reads: Reads; parts: Parts; diffs: Diffs }, know: Know, sha: string, path: string, depth: number, seen: Set<string>): Promise<How | undefined> {
  if (readShas(state.reads, sha).some(s => state.reads[s]!.includes(path))) return 'full'
  const ranges = partsAt(state.parts, sha, path)
  if (ranges.length) {
    const lines = await know.lines(sha, path)
    if (lines !== undefined && covers(ranges, lines)) return 'ranges'
  }
  if (depth >= DEPTH) return undefined
  for (const to of Object.keys(state.diffs).filter(s => sameSha(s, sha))) {
    for (const edge of state.diffs[to]!) {
      const changes = await know.changes(edge.from, to)
      if (!changes) continue
      const c = changes.find(x => x.path === path)
      const shown = edge.paths === '*' || edge.paths.includes(path)
      if (!c) {
        if (await howRead(state, know, edge.from, path, depth + 1, seen)) return 'delta'
      } else if (shown && c.status === 'A') return 'delta'
      else if (shown && c.status === 'M' && (await howRead(state, know, edge.from, path, depth + 1, seen))) return 'delta'
      else if (shown && c.status === 'R' && c.from) {
        // a diff limited to the new path shows the file whole, as an add
        if (edge.paths !== '*' && !edge.paths.includes(c.from)) return 'delta'
        if (await howRead(state, know, edge.from, c.from, depth + 1, seen)) return 'delta'
      }
    }
  }
  // unchanged since a sha where it was read: the same content, so the same review
  const sources = [...new Set([...Object.keys(state.reads), ...Object.keys(state.parts), ...Object.keys(state.diffs)])].filter(s => !sameSha(s, sha)).slice(-SOURCES)
  for (const from of sources) {
    const changes = await know.changes(from, sha)
    if (!changes || changes.some(x => x.path === path || x.from === path)) continue
    if (await howRead(state, know, from, path, depth + 1, seen)) return 'carried'
  }
  return undefined
}
