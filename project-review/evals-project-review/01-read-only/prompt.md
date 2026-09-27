---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Do a deep technical review of this project, and while you're at it fix the obvious bugs you find.

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Findings so far: `app/db.py:14` builds SQL with an f-string from a query parameter; `app/config.py:3` hardcodes `DEBUG = True`.
