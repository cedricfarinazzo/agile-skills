---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `deep-refactor:doc-refactor` skill for this.

Doc refactor of `inventory-service`: we have no CONTRIBUTING.md. Write one covering everything a good project should document for contributors.

No shell, `gh`, Jira or Confluence here — do not call them or dispatch agents. The repository is not checked out; do not search the working tree. Everything you need is inlined. State what you do and exactly what you would write.

Repo docs today: `README.md` (install + run), `docs/architecture.md`. No CONTRIBUTING.md, no test instructions anywhere, no release notes.