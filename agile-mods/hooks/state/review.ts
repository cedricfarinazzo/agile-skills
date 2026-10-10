// Pure review coverage behind the 3f reviewed-tree gate. A review is the set of files a reviewer
// read at a sha, taken from the `git show <sha>:<path>` commands it ran, never from its receipt.

/** Paths read in full, by the sha they were read at (as written in the command, 7 to 40 hex). */
export type Reads = Record<string, string[]>

const MAX_SHAS = 60
const MAX_PATHS = 2000
const SHOW = /^git\s+(?:-C\s+\S+\s+)?(?:--no-pager\s+)?(?:show|cat-file\s+-p)\s+(.+)$/
const SPEC = /^([0-9a-f]{7,40}):(.+)$/
/** A pipe into anything but these drops part of the file, so the read does not count. */
const WHOLE = /^(cat(\s+-n)?|nl|tee\s+\S+)$/

/**
 * Shell syntax the parser does not model (quotes, expansion, redirection, subshells, `||`, `;`, a
 * newline, background `&`): a command using any of it counts no read. `;` and a newline run the next
 * command after a failed one, so only `&&`, which stops at the first failure, joins reads.
 */
const UNMODELLED = /["'`$\\<>()#{}\n;]|\|\||(?<!&)&(?!&)/

export const sameSha = (a: string, b: string) => a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a))

/**
 * Every `<sha>:<path>` a shell command shows in full. Only plain `git show` / `git cat-file -p`
 * commands joined by `&&` count, each optionally piped into `cat`, `nl` or `tee`; every word after
 * the subcommand must be a spec. Anything the shell could read differently from this parser counts
 * nothing, so a read is never credited that the reviewer did not see.
 */
export function readsOf(command: string): { sha: string; path: string }[] {
  if (UNMODELLED.test(command)) return []
  const out: { sha: string; path: string }[] = []
  for (const part of command.split('&&')) {
    const [head, ...pipes] = part.split('|').map(s => s.trim())
    if (!head || pipes.some(p => !WHOLE.test(p))) return []
    const show = head.match(SHOW)
    if (!show) return []
    for (const word of show[1]!.split(/\s+/)) {
      const spec = word.match(SPEC)
      if (!spec || /[*?\[]/.test(spec[2]!)) return []
      out.push({ sha: spec[1]!, path: spec[2]!.replace(/^\.\//, '') })
    }
  }
  return out
}

/** Adds what one finished command read; the same object when it read nothing new. */
export function withReads(reads: Reads, command: string): Reads {
  let next = reads
  for (const { sha, path } of readsOf(command)) {
    const known = next[sha] ?? []
    if (known.includes(path)) continue
    const { [sha]: _, ...rest } = next
    next = { ...rest, [sha]: [...known, path].slice(-MAX_PATHS) }
  }
  const shas = Object.keys(next)
  return shas.length > MAX_SHAS ? Object.fromEntries(shas.slice(-MAX_SHAS).map(s => [s, next[s]!])) : next
}

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
