---
type: llm
focus: last_message
weight: 1
---
PR #437 has a planted producer gap. `format_adjustment_row` reads `event.get("reason_code")`, and both tests feed it hand-built dictionaries — but `build_adjustment_event` in `inventory/events.py` never sets `reason_code`. In production every row renders the "—" fallback, and nothing raises, because an absent key is indistinguishable from an unset reason. AC2 — that the reason code is persisted on the event payload — has no test at all. Check all of:
- The review raises this as a BLOCKER.
- It identifies that the producer `build_adjustment_event` does not populate `reason_code`, so the field is never actually filled despite the formatter handling it.
- It notes that the tests only cover the consumer with hand-built input, and that AC2 is therefore unproven.
Fail if the review approves the PR, or reports only that "test coverage could be better" without naming the producer.
