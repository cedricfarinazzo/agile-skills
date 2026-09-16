---
type: llm
focus: last_message
weight: 1
---
The ADR extract is explicitly silent on the sort order for adjustment lists, and on whether adjustments from deleted SKUs stay visible. The plan must decide and record, never decide silently. Check all of:
- The plan makes a concrete choice on the sort order (for example, most recent first) rather than leaving it open or asking the user.
- That choice is explicitly recorded as a flagged decision, inference, or assumption — a labelled item a reviewer would see, not merely implied by a test name or buried in prose.
- The reason is given, even briefly (for example that the ADR is silent and this matches the surrounding convention).
Fail if the plan silently picks an order with no flag, or if it stops to ask the user which order to use.
