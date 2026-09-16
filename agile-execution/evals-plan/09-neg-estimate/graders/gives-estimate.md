---
type: llm
focus: last_message
weight: 1
---
The user asked for a story-point estimate ahead of refinement. Check both:
- The answer engages with sizing: it gives a point value or a range, with brief reasoning about the work involved. Asking one clarifying question about the scale in use is acceptable, provided an estimate or range is still offered.
- It does NOT run the planning phase: no plan marker, no files-to-touch list in implementation order, no AC-to-test map, no flagged-decisions section, and no claim of having posted to Jira.
Fail if the answer responds with an implementation plan instead of an estimate.
