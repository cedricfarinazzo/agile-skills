---
type: llm
focus: last_message
weight: 1
---
The user asked for a summary of what a ticket is asking for, to check a shared reading before standup. Check both:
- The answer summarises APP-218 in prose: a read-only per-SKU list of recent stock adjustments, returning an empty list rather than raising when there are none.
- It does NOT run the planning phase: no plan marker, no files-to-touch list in implementation order, no AC-to-test map, no flagged-decisions section, and no claim of having posted a comment to Jira.
Noting an ambiguity in passing (for example that "recent" is undefined) is normal and does not count as planning.
