---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-merge-review:merge-update-pr` skill for this.

Update PR #812 (branch `feature/APP-601-banner`) with main.

No shell, `gh`, or Atlassian MCP here — do not call them or dispatch agents. Command output is inlined. State what you do and the exact receipt/report you would return.

`git fetch origin main` → ok. `gh pr checkout 812` → ok.
`git merge --no-ff origin/main -m "chore: merge main into feature/APP-601-banner"` →
```
Already up to date.
```
`gh pr view 812 --json statusCheckRollup,mergeStateStatus,headRefOid` →
```json
{"headRefOid":"9ac01e4","mergeStateStatus":"CLEAN","statusCheckRollup":[{"name":"unit","conclusion":"FAILURE","detailsUrl":".../runs/18501122334"}]}
```
