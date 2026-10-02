# <img src=".claude-plugin/icon.svg" width="40" alt="" align="top"> session-audit

Read-only, out-of-cycle audit of what a Claude Code session that ran agile-skills cost and what it shipped. It profiles spend per skill and per subagent, compares two runs normalised by merged PRs and added lines, checks the gates still held, and ranks the skill or agent edits that would cut spend.

It edits nothing. Its output is a report.

## Install

```text
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install session-audit@agile-skills
```

## Skill

| Skill | Purpose | Triggers |
|---|---|---|
| `session-audit` | Cost and efficiency audit of one run, or a before/after comparison of two | "audit this session's cost", "compare before and after sessions", "is the new version more efficient", "where do the tokens go", "subagent cost breakdown" |

Invoke it as `/session-audit:session-audit`.

## Bundled script

`skills/session-audit/scripts/session_usage.py` reads transcripts offline and prints the usage profile. It sends nothing anywhere.

```bash
python3 session_usage.py find <title-or-session-id>
python3 session_usage.py report --run before=a.jsonl --run after=b.jsonl,c.jsonl [--agents] [--price opus=<in>,<out>]
```

- A run may span several transcripts; messages shared by a resumed or forked session are counted once.
- Subagent transcripts are read from `<session>/subagents/` beside each file.
- `--shipped NAME=<merged PRs>,<added lines>` adds the efficiency table: cost and units per merged PR and per added line, with the gain between runs.
- Default prices are assumptions; pass `--price` for real ones.

Tests: `python3 -m pytest session-audit/skills/session-audit/scripts`.

## Needs

`gh` in the consumer repo to measure work shipped (merged PRs, added lines). Without it the skill falls back to tickets moved to Done and says the measure is coarser. No Jira or Confluence access is required.

## Where it fits

Out of cycle. Run it after a drain, an implement pass or a merge train, or to compare two plugin versions on similar work. It does not replace the retro or the sprint closeout.
