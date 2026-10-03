---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `session-audit:session-audit` skill for this.

Compare these two runs and tell me if the new version is more efficient.

No shell, `gh` or transcript files here — do not call them. Everything you would have measured is inlined. State your conclusion and the figures behind it.

Script report, default (assumed) prices:
- run before: total $400, 480M units, top level $32 (8%). 8 PRs merged, 5,600 lines added.
- run after: total $420, 800M units, top level $150 (36%), top-level wait/poll calls 380, context first=70K max=850K. 24 PRs merged, 9,600 lines added.
