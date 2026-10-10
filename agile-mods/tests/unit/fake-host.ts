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
  jira?: unknown
  agents?: { id: string; type: string }[]
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
    jira: async () => {
      calls.push('jira search')
      if (opts.jira === undefined) throw new Error('no Atlassian MCP server connected')
      return opts.jira
    },
    agents: async () => (opts.agents ?? []) as never,
    storeGet: async key => store.get(key),
    storeSet: async (key, value) => void store.set(key, value),
    log: text => void logs.push(text),
    toast: text => void toasts.push(text),
  }
  return { host, calls, store, toasts, logs }
}
