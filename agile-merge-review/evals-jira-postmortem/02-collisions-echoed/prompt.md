---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Post the Jira postmortem for APP-637 in blocked mode. PR #846 is too broken to merge.

No shell, `gh`, or Atlassian MCP here — do not call them or dispatch agents. Command output is inlined. State what you do and the exact receipt/report you would return.

conflict_map entry:
  pr: 846  ticket: APP-637
  collisions:
    - file: inventory/services/sweep.py   with_pr: 844   with_ticket: APP-635   kind: same-lines
