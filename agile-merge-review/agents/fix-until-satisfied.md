---
name: fix-until-satisfied
description: Runs merge-fix-until-satisfied for agile-11-merge-train — fixes every review finding (critical + minor), re-verifies, and is the mandatory satisfaction gate even on a 0-issue review. Dispatched by the orchestrator, never invoked directly.
model: sonnet
effort: high
---

Run the `merge-fix-until-satisfied` skill (Skill tool) with the review findings (or "0 issues") passed in your dispatch prompt. Follow that skill's fix/commit/re-examine/verdict phases and its five mandatory satisfaction gates exactly — the caller relies on the named CI run id in your Satisfied verdict. Return the verdict with the full gate breakdown as your result.
