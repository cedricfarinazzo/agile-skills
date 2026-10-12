import type { Compare, Host, PrRow, RunRow } from '../../hooks/host.ts'

type Run = { exitCode: number; stdout: string }

/** What the fake gh and Jira answer; a field left out answers as a failed call (undefined). */
export type Answers = {
  /** `git rev-parse` answers by argv joined with spaces; the first key the command starts with wins. */
  runs?: Record<string, Run>
  prs?: PrRow[]
  runList?: RunRow[]
  prView?: Record<number, { headRefOid: string; state: string }>
  runsOn?: Record<string, RunRow[]>
  prFiles?: Record<number, string[]>
  /** `gh pr list --head <branch>`: the open PR, null for none; a branch left out fails. */
  prOfBranch?: Record<string, { number: number; headRefOid: string; baseRefName?: string } | null>
  /** `git rev-parse @{push}` per directory. */
  pushBranch?: Record<string, string>
  /** `git rev-list --no-merges <base>..<ref>` is empty, by `<base>..<ref>`; left out: commits. */
  onlyMerges?: Record<string, boolean>
  compare?: Record<string, Compare>
  /** Line counts by `<sha>:<path>`; left out: git failed. */
  lines?: Record<string, number>
  /** File text by `<sha>:<path>`; left out: an empty file, so any output shows it. */
  show?: Record<string, string>
  /** git's own diff by `<from>..<to>`; left out: built from `changes`, one `+<path> changed` line per path (see diffOf). */
  diffText?: Record<string, string>
  /** Full shas by the abbreviation a read used; left out: not a commit here. */
  resolve?: Record<string, string>
  /** `git diff --name-status -M` by `<from>..<to>`; left out: git failed. */
  changes?: Record<string, { status: string; path: string; from?: string }[]>
  /** `git merge-base --is-ancestor` by `<from>..<to>`; left out: git failed. */
  descends?: Record<string, boolean>
  /** Trees by commit or branch; left out: git failed. */
  tree?: Record<string, string>
  jira?: unknown
  agents?: { id: string; type: string }[]
  /** Every store write fails, as a full disk would. */
  storeFails?: boolean
}

/**
 * A Host with no engine behind it: command answers are given up front, and every call, store
 * write, toast and log is recorded for the test to read.
 */
export function fakeHost(opts: Answers = {}) {
  const calls: string[] = []
  const store = new Map<string, unknown>()
  const toasts: string[] = []
  const logs: string[] = []
  const host: Host = {
    now: async () => 1_000,
    branch: async dir => {
      const line = `git -C ${dir} rev-parse --abbrev-ref HEAD`
      calls.push(line)
      const key = Object.keys(opts.runs ?? {}).find(k => line.startsWith(k))
      const run = key ? opts.runs![key] : undefined
      return run?.exitCode === 0 ? run.stdout.trim() : undefined
    },
    prs: async () => (calls.push('gh pr list'), opts.prs),
    runs: async () => (calls.push('gh run list'), opts.runList),
    prView: async pr => (calls.push(`gh pr view ${pr}`), opts.prView?.[pr]),
    runsOn: async sha => (calls.push(`gh run list --commit ${sha.slice(0, 7)}`), opts.runsOn?.[sha]),
    pushBranch: async dir => (calls.push(`git -C ${dir} rev-parse @{push}`), opts.pushBranch?.[dir]),
    onlyMerges: async (dir, head, ref, baseRef) => (calls.push(`git -C ${dir} rev-list --no-merges ${head.slice(0, 7)}..${ref} ^origin/${baseRef}`), opts.onlyMerges?.[`${head}..${ref}`] ?? false),
    prOfBranch: async branch => {
      calls.push(`gh pr list --head ${branch}`)
      const pr = opts.prOfBranch?.[branch]
      return pr ? { baseRefName: 'main', ...pr } : pr
    },
    prFiles: async pr => (calls.push(`gh api pulls/${pr}/files`), opts.prFiles?.[pr]),
    compare: async (base, head) => (calls.push(`gh api compare/${base.slice(0, 7)}...${head.slice(0, 7)}`), opts.compare?.[`${base}...${head}`]),
    lines: async (dir, sha, path) => (calls.push(`git -C ${dir} show ${sha.slice(0, 7)}:${path}`), opts.lines?.[`${sha}:${path}`]),
    show: async (dir, sha, path) => (calls.push(`git -C ${dir} show ${sha.slice(0, 7)}:${path} (text)`), opts.show?.[`${sha}:${path}`] ?? ''),
    diffText: async (dir, from, to, paths) => {
      calls.push(`git -C ${dir} diff ${from.slice(0, 7)} ${to.slice(0, 7)}`)
      const text = opts.diffText?.[`${from}..${to}`] ?? diffOf(opts.changes?.[`${from}..${to}`]?.map(c => c.path))
      if (!paths?.length) return text
      return text.split(/(?=^diff --git )/m).filter(part => paths.some(p => part.startsWith(`diff --git a/${p} `) || part.includes(` b/${p}\n`))).join('')
    },
    resolve: async (dir, rev) => (calls.push(`git -C ${dir} rev-parse ${rev}`), opts.resolve?.[rev]),
    changes: async (dir, from, to) => (calls.push(`git -C ${dir} diff --name-status ${from.slice(0, 7)} ${to.slice(0, 7)}`), opts.changes?.[`${from}..${to}`]),
    descends: async (dir, from, to) => (calls.push(`git -C ${dir} merge-base --is-ancestor ${from.slice(0, 7)} ${to.slice(0, 7)}`), opts.descends?.[`${from}..${to}`]),
    tree: async (dir, ref) => (calls.push(`git -C ${dir} rev-parse ${ref.slice(0, 7)}^{tree}`), opts.tree?.[ref]),
    jira: async () => {
      calls.push('jira search')
      if (opts.jira === undefined) throw new Error('no Atlassian MCP server connected')
      return opts.jira
    },
    agents: async () => (opts.agents ?? []) as never,
    storeGet: async key => store.get(key),
    storeSet: async (key, value) => {
      if (opts.storeFails) throw new Error('disk full')
      store.set(key, value)
    },
    log: text => void logs.push(text),
    toast: text => void toasts.push(text),
  }
  return { host, calls, store, toasts, logs }
}

/** A diff as git prints it, one changed line per path: what a test passes as the reviewer's output. */
export const diffOf = (paths: string[] = []) => paths.map(p => `diff --git a/${p} b/${p}\n--- a/${p}\n+++ b/${p}\n@@ -1 +1 @@\n-old ${p}\n+new ${p}\n`).join('')
