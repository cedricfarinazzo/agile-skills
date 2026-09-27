---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Run the tech debt sweep on CLAUDE.md files. Repo `inventory-service`.

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

`CLAUDE.md` lines:
1. "Backend: FastAPI + Postgres." (same line also in `backend/CLAUDE.md`)
2. "`git merge --continue` rejects --no-edit — use GIT_EDITOR=true."
3. "Always reply in terse caveman mode."
4. "TODO(jdoe): tidy later"
