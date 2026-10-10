import type { AgentInfo } from 'claude-code'

/** A PR as `gh pr list --json number,title,headRefName,headRefOid,state,createdAt,mergedAt,url` reports it. */
export type PrRow = { number: number; title?: string; headRefName?: string; headRefOid?: string; state?: string; createdAt?: string; mergedAt?: string | null; url?: string }

/** A workflow run as `gh run list --json databaseId,headSha,status,conclusion,workflowName,createdAt` reports it. */
export type RunRow = { databaseId?: number; headSha?: string; status?: string; conclusion?: string; workflowName?: string; createdAt?: string }

/** The files changed from one commit to another (`gh api .../compare/<a>...<b>`); `status` is GitHub's (`ahead`, `identical`, `diverged`, `behind`). */
export type Compare = { status: string; files: string[] }

/**
 * The engine calls the hooks make, bound from `$` in register.tsx (one hooks module per plugin, and
 * `$` stays in that file). Every program the mods run, and every MCP call, is one named call here,
 * written out in full in register.tsx; each resolves undefined when the program or server fails.
 */
export type Host = {
  now: () => Promise<number>
  /** The branch checked out in `dir` (`git rev-parse --abbrev-ref HEAD`). */
  branch: (dir: string) => Promise<string | undefined>
  /** The repo's latest 100 PRs, any state (`gh pr list`). */
  prs: () => Promise<PrRow[] | undefined>
  /** The repo's latest 100 workflow runs (`gh run list`). */
  runs: () => Promise<RunRow[] | undefined>
  /** One PR's live head and state (`gh pr view <n>`). */
  prView: (pr: number) => Promise<{ headRefOid: string; state: string } | undefined>
  /** Where a bare `git push` in `dir` sends the checked-out branch (`git rev-parse @{push}`), without the remote. */
  pushBranch: (dir: string) => Promise<string | undefined>
  /**
   * Whether `ref` adds nothing on top of `head` but merges and commits `origin/<baseRef>` already has
   * (`git rev-list --no-merges <head>..<ref> ^origin/<baseRef>` is empty): an update from the base.
   */
  onlyMerges: (dir: string, head: string, ref: string, baseRef: string) => Promise<boolean | undefined>
  /** The open PR whose head is `branch` (`gh pr list --head <branch>`): null when there is none. */
  prOfBranch: (branch: string) => Promise<{ number: number; headRefOid: string; baseRefName: string } | null | undefined>
  /** Every workflow run on one commit (`gh run list --commit <sha>`). */
  runsOn: (sha: string) => Promise<RunRow[] | undefined>
  /** The PR's files present at its head (`gh api .../pulls/<n>/files`, removed files left out). */
  prFiles: (pr: number) => Promise<string[] | undefined>
  /** The files changed from `base` to `head` (`gh api .../compare/<base>...<head>`). */
  compare: (base: string, head: string) => Promise<Compare | undefined>
  /** One page (50 issues) of a JQL search on the session's Atlassian MCP server; the parsed JSON answer. */
  jira: (cloudId: string, jql: string, fields: string[], page?: string) => Promise<unknown>
  agents: () => Promise<AgentInfo[]>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  log: (text: string) => void
  toast: (text: string, timeoutMs?: number) => void
}

/** A finished `tool.call` as the hooks read it: the text the model got, or undefined on a deny or error. */
export type Finished = { text: string | undefined; isError: boolean; denied: boolean }

export const argsOf = (e: object) => e as unknown as Record<string, unknown>
