---
max_turns: 12
timeout_seconds: 420
allowed_tools: [Skill]
runs: 3
---
Implement the sprint with concurrency=3.

Repo context: `inventory-service`, project key `APP`, sprint 36 active. The project runs a single shared Docker Compose stack. CI runs integration and e2e on pull requests.

There is no shell, no `gh`, and no Atlassian MCP in this sandbox — do not call them and do not dispatch any agent. Everything you would have read is inlined. State what you would do next and why.

## Eligible tickets, already ordered, no blockers between them

APP-381, APP-382, APP-383, APP-384, APP-385 — five independent Stories.

Explain how you will run these five: how many are worked at once and what happens as each finishes, where each ticket's code lives on disk, which test tiers run locally versus in CI, and which phases are serialised regardless of the concurrency setting.
