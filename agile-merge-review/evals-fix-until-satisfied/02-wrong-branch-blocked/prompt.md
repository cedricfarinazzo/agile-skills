---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Fix everything from the review of PR #829 (APP-618, branch `feature/APP-618-audit`). Findings: 1 Minor — unused import at `inventory/services/audit.py:3`.

No shell, `gh`, or Atlassian MCP here — do not call them or dispatch agents. Command output is inlined. State what you do and the exact receipt/report you would return.

Your prompt names the working location as the repo root. `git -C . rev-parse --abbrev-ref HEAD` → `main`.
