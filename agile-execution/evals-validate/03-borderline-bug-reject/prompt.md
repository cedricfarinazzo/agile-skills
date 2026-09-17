---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
---
Validate ticket APP-318 for the build pipeline.

Repo context: this checkout is `inventory-service` (`git remote get-url origin` → `git@github.com:acme/inventory-service.git`; `AGENTS.md` declares `repo: inventory-service`, `service-name: inventory`).

No Atlassian MCP is available here — do not attempt to call any Jira tool. Output the exact marker comment you would post, the verdict, and the transition you would apply.

---

**APP-318 — Bug — Flaky: `test_sweep_starts_and_tears_down_the_heartbeat` fails on an unchanged tree in CI**
Status: To Do · Labels: `backend`, `ci` · Components: inventory-api
Links: `issuelinks: []`

**Description**

`test_sweep_starts_and_tears_down_the_heartbeat` fails on an UNCHANGED backend tree in CI, roughly one run in six. It passes locally in isolation. Prior related tickets: APP-160, APP-204, APP-262.

**Acceptance criteria**

- AC1 — Reproduce it deterministically before changing anything. A fix with no reproduction is a guess. State the seed or ordering that reproduces it.
- AC2 — Fix at the source, not with a retry or `-p no:randomly`. Marking this test flaky, retrying it, or pinning worker assignment hides the pollution for every other test in that worker.
- AC3 — Pin it: add the guard that fails if it returns — an explicit reset/fixture assertion, or the ordering repro from AC1 as a test. State the `repeat:` count that proves the fix.
- AC4 — Check the neighbours. `test_sweep_lifecycle.py` and `test_heartbeat_teardown.py` patch the same module; confirm they do not carry the same defect.
