---
type: llm
focus: last_message
weight: 1
---
The verdict must carry a per-lens finding. Check both:
- All six lenses appear: architecture, security, performance, infra/ops, code quality, and AC/DoD.
- Each carries either a concrete citation into the reviewed files (a file with a line number or a named function), or an explicit "N/A because ..." with a reason. A bare ✅ with no citation and no reason fails.
Fail if fewer than six lenses are reported, or if any lens is a bare tick.
