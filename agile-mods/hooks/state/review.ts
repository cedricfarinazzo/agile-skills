// Pure review coverage behind the 3f reviewed-tree gate. A review is the set of files a reviewer
// read at a sha, taken from the `git show <sha>:<path>` commands it ran, never from its receipt.

/** Paths read in full, by the sha they were read at (as written in the command, 7 to 40 hex). */
export type Reads = Record<string, string[]>
/** Line ranges read of a file too large for one command, by sha then path; `Infinity` ends at the file's end. */
export type Parts = Record<string, Record<string, [number, number][]>>

const MAX_SHAS = 60
const MAX_PATHS = 2000
const SHOW = /^git\s+(?:-C\s+\S+\s+)?(?:--no-pager\s+)?(?:show|cat-file\s+-p)\s+(.+)$/
// a full sha only: an abbreviated one could name an object another repository was made to match
const SPEC = /^([0-9a-f]{40}):(.+)$/
/** A pipe into anything but these drops part of the file, so the read does not count. */
const WHOLE = /^(cat(\s+-n)?|nl|tee\s+\S+)$/
/** One pipe that keeps a line range: `sed -n A,Bp`, `head -n N` (or `head -N`), `tail -n +A`. */
function rangeOf(pipe: string): [number, number] | undefined {
  let m = pipe.match(/^sed\s+-n\s+(\d+),(\d+)p$/)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= Number(m[2])) return [Number(m[1]), Number(m[2])]
  // `head -n -N` prints all but the last N lines, so only a positive count is a range
  m = pipe.match(/^head\s+(?:-n\s*(\d+)|-(\d+))$/)
  if (m) return [1, Number(m[1] ?? m[2])]
  m = pipe.match(/^tail\s+-n\s*\+(\d+)$/)
  if (m) return [Number(m[1]), Infinity]
  return undefined
}

/**
 * Shell syntax the parser does not model (quotes, expansion, redirection, subshells, `||`, `;`, a
 * newline, background `&`): a command using any of it counts no read. `;` and a newline run the next
 * command after a failed one, so only `&&`, which stops at the first failure, joins reads.
 */
const UNMODELLED = /["'`$\\<>()#{}\n;]|\|\||(?<!&)&(?!&)/
/** A leading `cd <dir> &&` or `cd <dir>;`: it picks the repository, and the full sha still names the object. */
const CD = /^cd\s+[^\s"'`$\\<>()#{};&|]+\s*(?:&&|;)\s*/

export const sameSha = (a: string, b: string) => a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a))

/**
 * Every `<sha>:<path>` a shell command shows, in full or (one file, piped first into `sed -n A,Bp`,
 * `head -n N` or `tail -n +A`) as a line range. Only plain `git show` / `git cat-file -p`
 * commands joined by `&&`, after an optional leading `cd <dir>`, count, each optionally piped into `cat`, `nl` or `tee`; every word after
 * the subcommand must be a spec. Anything the shell could read differently from this parser counts
 * nothing, so a read is never credited that the reviewer did not see.
 */
export function readsOf(command: string): { sha: string; path: string; range?: [number, number] }[] {
  command = command.trim().replace(CD, '')
  if (UNMODELLED.test(command)) return []
  const out: { sha: string; path: string; range?: [number, number] }[] = []
  for (const part of command.split('&&')) {
    const [head, ...pipes] = part.split('|').map(s => s.trim())
    if (!head) return []
    // a single line-range pipe, first, makes a ranged read of one file; anything else after it must keep every line
    const range = pipes.length ? rangeOf(pipes[0]!) : undefined
    if (pipes.slice(range ? 1 : 0).some(p => !WHOLE.test(p))) return []
    const show = head.match(SHOW)
    if (!show) return []
    const words = show[1]!.split(/\s+/)
    if (range && words.length !== 1) return []
    for (const word of words) {
      const spec = word.match(SPEC)
      if (!spec || /[*?\[]/.test(spec[2]!)) return []
      out.push({ sha: spec[1]!, path: spec[2]!.replace(/^\.\//, ''), ...(range && { range }) })
    }
  }
  return out
}

/** Output past the Bash tool's limit reaches the model as a short preview, so nothing in it was read in full. */
export const MAX_OUTPUT = 30_000
const PERSISTED = /<persisted-output>|Output too large/

/**
 * Adds what one finished command read; the same object when it read nothing new.
 *
 * @param output the text the model got back; a read whose output was cut or persisted counts nothing
 */
export function withReads(reads: Reads, command: string, output: string): Reads {
  if (output.length > MAX_OUTPUT || PERSISTED.test(output)) return reads
  let next = reads
  for (const { sha, path, range } of readsOf(command)) {
    if (range) continue
    const known = next[sha] ?? []
    if (known.includes(path)) continue
    const { [sha]: _, ...rest } = next
    next = { ...rest, [sha]: [...known, path].slice(-MAX_PATHS) }
  }
  const shas = Object.keys(next)
  return shas.length > MAX_SHAS ? Object.fromEntries(shas.slice(-MAX_SHAS).map(s => [s, next[s]!])) : next
}

/** Adds the line ranges one finished command read; the same object when it read none. Same output rule as withReads. */
export function withParts(parts: Parts, command: string, output: string): Parts {
  if (output.length > MAX_OUTPUT || PERSISTED.test(output)) return parts
  let next = parts
  for (const { sha, path, range } of readsOf(command)) {
    if (!range) continue
    const files = next[sha] ?? {}
    next = { ...next, [sha]: { ...files, [path]: [...(files[path] ?? []), range].slice(-200) } }
  }
  const shas = Object.keys(next)
  return shas.length > MAX_SHAS ? Object.fromEntries(shas.slice(-MAX_SHAS).map(s => [s, next[s]!])) : next
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

/** A sha other than the head that some file of the PR was read at: a candidate earlier review. */
export const earlierShas = (reads: Reads, head: string, files: string[]) =>
  Object.keys(reads).filter(s => !sameSha(s, head) && reads[s]!.some(p => files.includes(p)))

/**
 * The PR files no review read in their landing form. A file counts as read when it was shown at the
 * head, or at an earlier sha the head descends from with the file unchanged since.
 *
 * @param files the PR's files present at the head
 * @param deltas for each earlier sha, the files changed from it to the head; undefined when the
 *   head does not descend from it (a rebase or force push), which voids those reads
 */
export function unreadFiles(reads: Reads, head: string, files: string[], deltas: Record<string, string[] | undefined>): string[] {
  const atHead = new Set(readShas(reads, head).flatMap(s => reads[s]!))
  return files.filter(f => {
    if (atHead.has(f)) return false
    return !Object.entries(deltas).some(([sha, changed]) => changed !== undefined && !changed.includes(f) && reads[sha]?.includes(f))
  })
}
