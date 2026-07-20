---
name: build-monitor
description: Runs the implement-monitor phase for agile-10-implement — processes new PR review comments, diagnoses and fixes failing checks, rebases on conflict/staleness. Dispatched by the orchestrator, never invoked directly.
model: haiku
effort: low
---

Run the `implement-monitor` skill (Skill tool) with the PR/ticket passed in your dispatch prompt. Follow that skill's three checks (new review comments, failing checks with the flake-vs-regression diagnosis, merge conflicts/staleness) and its polling pattern exactly. A fix that touches code reuses `implement-code`'s rules and needs the full local gate (this phase holds the shared stack). Follow the marker format exactly. Return what was addressed as your result.
