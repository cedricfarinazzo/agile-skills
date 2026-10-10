import type { AgentInfo } from 'claude-code'

/**
 * The engine calls the guard, receipt and authoring hooks make, bound from `$` in register.tsx
 * (one hooks module per plugin, and `$` stays in that file).
 */
export type Host = {
  now: () => Promise<number>
  /** The branch checked out in `dir` (`git rev-parse --abbrev-ref HEAD`), or undefined when git fails. */
  branch: (dir: string) => Promise<string | undefined>
  agents: () => Promise<AgentInfo[]>
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  log: (text: string) => void
  toast: (text: string, timeoutMs?: number) => void
}

/** A finished `tool.call` as the hooks read it: the text the model got, or undefined on a deny or error. */
export type Finished = { text: string | undefined; isError: boolean; denied: boolean }

export const argsOf = (e: object) => e as unknown as Record<string, unknown>
