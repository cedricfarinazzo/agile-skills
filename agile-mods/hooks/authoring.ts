import type { Finished, Host } from './host.ts'
import { INVARIANTS_SCRIPT, applyEdit, bareMcpNames, bumpedOf, droppedTriggers, isSkillFile, missingBumps } from './state/authoring.ts'

// Authoring checks for maintaining this marketplace; active only when the session's directory is
// the agile-skills repo root. Each turns a "verify before you call an edit done" step of CLAUDE.md
// into a check on the call:
// - an Edit/Write that drops a SKILL.md Triggers: phrase is refused;
// - a markdown edit that introduces a bare MCP tool name gets a reminder to qualify it;
// - a git commit touching a plugin without bumping its version is refused;
// - a turn that edited files ends with the invariants script; drift toasts (/agile-verify runs it).

let root: string | undefined
let plugins = new Set<string>()
let edited = false

export const VERIFY_COMMAND = {
  name: 'agile-verify',
  description: 'Run the CLAUDE.md invariants over this repo (agile-mods)',
  immediate: true,
} as const

const str = (value: unknown) => (typeof value === 'string' ? value : '')
const relative = (path: string) => (root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : undefined)

async function git(host: Host, argv: string[]): Promise<string | undefined> {
  const run = await host.run(['git', ...argv], { cwd: root, timeoutMs: 20_000 }).catch(() => undefined)
  return run?.exitCode === 0 ? run.stdout : undefined
}

/** Whether the session runs in the agile-skills repo; the authoring checks and /agile-verify are off otherwise. */
export async function authoringStart(host: Host, cwd: string): Promise<boolean> {
  const manifest = await host.read(`${cwd}/.claude-plugin/marketplace.json`).catch(() => '')
  let parsed: { name?: string; plugins?: { name?: string }[] } | undefined
  try {
    parsed = JSON.parse(manifest)
  } catch {
    parsed = undefined
  }
  if (parsed?.name !== 'agile-skills') return false
  root = cwd
  plugins = new Set((parsed.plugins ?? []).map(p => p.name ?? '').filter(Boolean))
  return true
}

/** The CLAUDE.md invariants: one line per drift, empty when the tree is consistent. */
export async function invariants(host: Host): Promise<string> {
  if (!root) return ''
  const run = await host.run(['bash', '-c', INVARIANTS_SCRIPT], { cwd: root, timeoutMs: 60_000 }).catch(err => ({ exitCode: 1, stdout: `invariants script failed: ${err}` }))
  return run.stdout.trim()
}

/** Before a tool call: refuses a dropped trigger or an unbumped commit. */
export async function authoringBefore(host: Host, tool: string, args: Record<string, unknown>): Promise<string | undefined> {
  if (!root) return undefined

  if (tool === 'Edit' || tool === 'Write') {
    const path = str(args.file_path)
    const rel = relative(path)
    if (!rel || !isSkillFile(rel)) return undefined
    const before = await git(host, ['show', `HEAD:${rel}`])
    const after = tool === 'Write'
      ? str(args.content)
      : applyEdit(await host.read(path).catch(() => ''), str(args.old_string), str(args.new_string), args.replace_all === true)
    const dropped = before && after !== undefined ? droppedTriggers(before, after) : []
    return dropped.length
      ? `agile-mods: this edit drops Triggers: phrase(s) from ${rel} compared to HEAD: ${dropped.map(t => `"${t}"`).join(', ')}. A dropped trigger is a silent auto-invocation regression: reword freely, but keep every phrase.`
      : undefined
  }

  const command = tool === 'Bash' ? str(args.command) : ''
  if (!/\bgit\s+commit\b/.test(command)) return undefined
  const range = /\bgit\s+commit\b[^|;&]*\s-[a-zA-Z]*a/.test(command) ? ['HEAD'] : ['--cached']
  const changed = ((await git(host, ['diff', ...range, '--name-only'])) ?? '').split('\n').filter(Boolean)
  const diff = (await git(host, ['diff', ...range, '-U0', '--', '*/.claude-plugin/plugin.json'])) ?? ''
  const missing = missingBumps(changed, bumpedOf(diff), plugins)
  return missing.length
    ? `agile-mods: this commit touches ${missing.join(', ')} without bumping its .claude-plugin/plugin.json version. Bump every touched plugin in the same commit (patch for doc-only, minor for a capability, major for a breaking change), and keep .codex-plugin/plugin.json aligned where one exists.`
    : undefined
}

/** After an Edit/Write: marks the turn for the invariants run, returns a bare-MCP-name reminder. */
export async function authoringAfter(host: Host, tool: string, args: Record<string, unknown>, done: Finished): Promise<string[]> {
  if (!root || (tool !== 'Edit' && tool !== 'Write') || done.text === undefined) return []
  const path = str(args.file_path)
  const rel = relative(path)
  if (!rel) return []
  edited = true
  if (!rel.endsWith('.md')) return []
  const now = bareMcpNames(await host.read(path).catch(() => ''))
  const known = new Set(bareMcpNames((await git(host, ['show', `HEAD:${rel}`])) ?? '').map(b => b.name))
  const added = now.filter(b => !known.has(b.name))
  if (!added.length) return []
  const where = added.slice(0, 8).map(b => `${b.name} (line ${b.line})`).join(', ')
  return [`agile-mods: ${rel} names MCP tools without their server prefix: ${where}. Write them fully qualified (mcp__atlassian__getJiraIssue): a bare name is uncallable.`]
}

/** At a main-loop turn's end: the invariants, when the turn edited files here. */
export async function authoringTurn(host: Host) {
  if (!root || !edited) return
  edited = false
  const drift = await invariants(host)
  if (!drift) return
  host.toast(`agile-verify: ${drift.split('\n').length} invariant(s) drifted · /agile-verify`, 15_000)
  host.log(`agile-verify:\n${drift}`)
}
