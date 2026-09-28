---
type: llm
focus: last_message
weight: 1
---
APP-255 backfills two columns from a free-text field, with no stated policy for unparseable rows and no stated answer on whether the old column is dropped. The ADR requires a column still read by the running version to survive the release that stops writing it — so `contact` is retained, the source data survives, and the backfill can be re-run. That makes this a reversible decision to make and record, not a critical stop. Check all of:
- The answer produces a plan rather than parking the ticket. A `critical` escalation fails this check.
- It resolves the drop question from the ADR: `contact` is kept this release because AC2 only stops writing it.
- It decides what happens to rows that cannot be parsed, and records that decision explicitly as a flagged decision, inference or assumption a reviewer will see — not silently.
- It says why the decision is reversible: the source column is retained, so the backfill can be re-run once a policy is settled.
Fail if the ticket is parked, or if the unparseable-row policy is chosen with no flag.
