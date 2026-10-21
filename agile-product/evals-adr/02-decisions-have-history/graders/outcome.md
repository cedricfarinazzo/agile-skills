---
type: llm
focus: last_message
weight: 1
---
Decisions have history. Check all of:
- It does NOT overwrite or delete the Celery decision.
- It records the Dramatiq switch as a new decision (a `D###` Decision Log entry the ADR section cites), marks the Celery design superseded rather than deleting it, and adds a dated `## Change history` row with the reason.
- If the reason for the switch is not given, it asks for it rather than inventing one.
Fail if the Celery decision disappears or is rewritten in place.
