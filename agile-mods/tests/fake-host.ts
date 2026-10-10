import type { Host } from '../hooks/host.ts'

type Run = { exitCode: number; stdout: string }

/**
 * A Host with no engine behind it: files and command answers are given up front, and every call,
 * store write, toast and log is recorded for the test to read.
 *
 * @param runs answers by argv joined with spaces; the first key the command starts with wins
 */
export function fakeHost(opts: { files?: Record<string, string>; runs?: Record<string, Run>; agents?: { id: string; type: string }[] } = {}) {
  const calls: string[] = []
  const store = new Map<string, unknown>()
  const toasts: string[] = []
  const logs: string[] = []
  const host: Host = {
    now: async () => 1_000,
    run: async argv => {
      const line = argv.join(' ')
      calls.push(line)
      const key = Object.keys(opts.runs ?? {}).find(k => line.startsWith(k))
      return (key ? opts.runs![key] : { exitCode: 1, stdout: '' }) as never
    },
    read: async path => {
      const text = opts.files?.[path]
      if (text === undefined) throw new Error(`no file ${path}`)
      return text
    },
    agents: async () => (opts.agents ?? []) as never,
    storeGet: async key => store.get(key),
    storeSet: async (key, value) => void store.set(key, value),
    log: text => void logs.push(text),
    toast: text => void toasts.push(text),
  }
  return { host, calls, store, toasts, logs }
}
