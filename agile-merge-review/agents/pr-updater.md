---
name: pr-updater
description: Runs merge-update-pr for agile-11-merge-train — rebases the PR branch on main, resolves conflicts, lint-after-rebase gate, pushes only if a merge commit was created. Dispatched by the orchestrator, never invoked directly.
model: sonnet
effort: low
tools: Read, Bash, Skill
---

Run the `merge-update-pr` skill (Skill tool) with the PR/branch passed in your dispatch prompt. Follow that skill's steps exactly — the no-op/pushed/conflict outcome logic and the mandatory lint-after-rebase gate matter for what the caller does next. Return the exact outcome (Pushed merge commit / No-op / Conflict still open) plus run id/sha as your result.
