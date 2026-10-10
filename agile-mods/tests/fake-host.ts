import type { Host } from '../hooks/host.ts'

type Run = { exitCode: number; stdout: string }

/**
 * A Host with no engine behind it: command answers are given up front, and every call,
 * store write, toast and log is recorded for the test to read.
 *
 * @param runs answers by argv joined with spaces; the first key the command starts with wins
 */
export function fakeHost(opts: { runs?: Record<string, Run>; agents?: { id: string; type: string }[] } = {}) {
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
    agents: async () => (opts.agents ?? []) as never,
    storeGet: async key => store.get(key),
    storeSet: async (key, value) => void store.set(key, value),
    log: text => void logs.push(text),
    toast: text => void toasts.push(text),
  }
  return { host, calls, store, toasts, logs }
}
