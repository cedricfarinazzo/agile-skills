---
type: llm
focus: last_message
weight: 1
---
The ADR extract requires list functions to be paginated with a bounded default of 50 and a hard cap of 200, and service functions to return plain values rather than live ORM instances. The ticket's ACs mention neither. Check both:
- The plan applies pagination to the adjustments list rather than returning an unbounded query.
- The plan returns plain values from the service layer, not ORM rows.
Fail if the plan ignores the ADR constraints because the ACs did not restate them.
