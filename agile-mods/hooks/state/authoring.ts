// Pure checks behind the authoring mods: the rules CLAUDE.md asks a maintainer of this marketplace
// to verify by hand before an edit is done.

/** The phrases of a SKILL.md description's `Triggers:` list. */
export function triggersOf(markdown: string): string[] {
  const frontmatter = markdown.split(/^---\s*$/m)[1] ?? ''
  const description = frontmatter.match(/^description:\s*(.*)$/m)?.[1] ?? ''
  const list = description.match(/Triggers:\s*(.*)$/)?.[1] ?? ''
  return list
    .replace(/["']\s*$/, '')
    .split(',')
    .map(t => t.trim().replace(/[."']+$/, '').trim())
    .filter(Boolean)
}

/** Triggers present before and missing after: each one a silent auto-invocation regression. */
export const droppedTriggers = (before: string, after: string) => {
  const kept = new Set(triggersOf(after).map(t => t.toLowerCase()))
  return triggersOf(before).filter(t => !kept.has(t.toLowerCase()))
}

/** An Edit tool call applied to the file's text, as the tool would; undefined when it would fail. */
export function applyEdit(content: string, oldString: string, newString: string, replaceAll: boolean): string | undefined {
  if (!oldString || !content.includes(oldString)) return undefined
  return replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, () => newString)
}

const MCP_NAME = /(?<![\w])((?:get|create|edit|add|transition|search|update|lookup)\w*(?:Jira|Confluence|IssueLink)\w*|(?:issue|pull_request)_(?:read|write)|merge_pull_request|create_pull_request)(?![\w])/g

/** MCP tool names written bare (`getJiraIssue`) instead of fully qualified, with their line. */
export function bareMcpNames(markdown: string): { line: number; name: string }[] {
  return markdown.split('\n').flatMap((text, i) =>
    [...text.matchAll(MCP_NAME)]
      .filter(m => !/mcp__\w+__$/.test(text.slice(0, m.index)))
      .map(m => ({ line: i + 1, name: m[1]! })))
}

/**
 * Plugins a commit touches without bumping their version.
 *
 * @param changed the paths the commit carries, repo-relative
 * @param bumped the plugins whose `.claude-plugin/plugin.json` diff changes `"version"`
 * @param plugins the marketplace's plugin names (each one a root dir)
 */
export function missingBumps(changed: string[], bumped: Set<string>, plugins: Set<string>): string[] {
  const touched = new Set(changed.map(p => p.split('/')[0]!).filter(p => plugins.has(p)))
  return [...touched].filter(p => !bumped.has(p)).sort()
}

/** The plugins whose manifest diff (`git diff -U0`) adds a `"version"` line. */
export function bumpedOf(diff: string): Set<string> {
  const bumped = new Set<string>()
  let plugin: string | undefined
  for (const line of diff.split('\n')) {
    const file = line.match(/^\+\+\+ b\/([^/]+)\/\.claude-plugin\/plugin\.json$/)
    if (file) plugin = file[1]
    else if (line.startsWith('+++ ')) plugin = undefined
    else if (plugin && /^\+\s*"version"\s*:/.test(line)) bumped.add(plugin)
  }
  return bumped
}

export const isSkillFile = (path: string) => /(^|\/)skills\/[^/]+\/SKILL\.md$/.test(path)

/**
 * The verify block of CLAUDE.md as one script run from the repo root: prints one line per
 * drift and nothing when the tree is consistent. Backticks are spelled chr(96) so the script
 * fits a template literal.
 */
export const INVARIANTS_SCRIPT = String.raw`
set -u
d=$(diff <(ls agile-*/agents/*.md | xargs -n1 basename | sed 's/.md//' | sort) <(grep -rhoE 'agile-(execution|merge-review):[a-z-]+' agile-*/skills | cut -d: -f2 | sort -u))
[ -n "$d" ] && echo "agents vs dispatch points differ: $(echo "$d" | tr '\n' ' ')"
n=$(grep -rl 'Work discovered mid-phase' --include='SKILL.md' agile-* deep-refactor 2>/dev/null | while read f; do sed -n '/## Work discovered mid-phase/,/^## /p' "$f" | head -n -1 | md5sum | cut -c1-8; done | sort -u | wc -l)
[ "$n" -gt 1 ] && echo "Work discovered mid-phase block: $n variants"
python3 -c "
import pathlib,re,collections
F=chr(96)*3
b=re.compile('^'+F+r'\n'+chr(0x1F4C1)+r' \[Project Name\].*?^'+F,re.M|re.S); v=collections.defaultdict(list)
for p in list(pathlib.Path('.').glob('agile-*/skills/*/SKILL.md'))+[pathlib.Path('agile-planning/README.md')]:
    m=b.search(p.read_text())
    if m: v[m.group(0)].append(str(p))
if len(v)>1: print(f'Confluence tree: {len(v)} variants')
for p in pathlib.Path('.').glob('agile-*/agents/*.md'):
    fm=p.read_text().split('---')[1]
    for f in ('name','description','model','effort','tools'):
        if not re.search(rf'^{f}:',fm,re.M): print(f'{p}: missing {f}')
    n=re.search(r'^name:\s*(\S+)',fm,re.M)
    if n and n.group(1)!=p.stem: print(f'{p}: name != filename')
for p in pathlib.Path('.').glob('*/skills/*/SKILL.md'):
    n=re.search(r'^name:\s*(\S+)',p.read_text().split('---')[1],re.M)
    if n and n.group(1)!=p.parent.name: print(f'{p}: name != dir')
"
exit 0
`
