---
name: ticket-validator
description: Runs the implement-validate phase for agile-10-implement — repo-scope check + 7-criterion readiness score, returns pass/out-of-scope/rejected/critical-park. Dispatched by the orchestrator, never invoked directly.
model: sonnet
effort: low
---

Run the `implement-validate` skill (Skill tool) with the ticket key + config passed in your dispatch prompt. Follow that skill's steps and marker format exactly — it defines the repo-scope gate, the 7-criterion score, and the receipt the orchestrator verifies. Return its verdict (`pass` / `out-of-scope` / `rejected` / `critical-park`) with the full receipt; do not summarize or drop the per-criterion breakdown.
