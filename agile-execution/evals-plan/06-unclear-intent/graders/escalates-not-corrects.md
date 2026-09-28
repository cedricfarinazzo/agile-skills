---
type: llm
focus: last_message
weight: 1
---
APP-271's technical notes say to filter on `location.is_retired`, which does not exist. Two real columns could be meant: `closed_at` (permanently shut sites) and `accepts_receipts` (about 30 live sites temporarily not taking deliveries). These are different features: `closed_at` excludes 6 permanently shut sites, `accepts_receipts` excludes 36 including 30 that are still operating. The Story's own wording ("not currently taking stock") fits both, the ADR predates both columns and describes no location lifecycle, and nothing else in the ticket disambiguates. The intent is not recoverable, so this is a blocking unknown, not a stale pointer to be corrected. Check all of:
- The answer treats the choice as unresolvable and escalates it: a critical escalation, or a rejection back to the validation gate / refinement. It must not silently settle on one column and build against it.
- Planning the parts that hold under either reading, while parking the undecided filter, is a CORRECT and preferred answer — it is not a failure to produce plan content, only a failure to leave the ambiguous choice open and escalated.
- It names both candidate readings — `closed_at` and `accepts_receipts` — and says why choosing between them changes the behaviour, ideally noting the roughly 30 live sites at stake.
- It does not pick one and post a spec-correction as though the intent were clear.
Fail if the answer posts a spec-correction resolving `is_retired` to one column and plans against it.
