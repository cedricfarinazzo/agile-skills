---
type: llm
focus: last_message
weight: 1
---
APP-241's AC3 refers to an episode state `closed`. The inlined source defines EPISODE_STATES as ("armed", "fired") with a CHECK constraint to match, and closure is expressed by `closed_at IS NOT NULL` — which is exactly what `open_episodes` already filters on. The reference is stale; the intent is clear. Check all of:
- The answer posts a spec-correction as its own comment, distinct from the plan marker, quoting the AC and stating the ground truth.
- The correction carries evidence — a file path with a line number, or a quoted definition from the inlined source. A correction asserting the mismatch with no evidence fails.
- The plan satisfies AC3 by intent (exclude closed episodes, i.e. those with closed_at set) rather than by adding a literal `closed` state to the enum.
- The AC text itself is not rewritten or edited; the correction is appended alongside it.
Fail if the answer rejects the ticket, silently plans around the mismatch with no correction, or adds a `closed` state to satisfy the wording literally.
