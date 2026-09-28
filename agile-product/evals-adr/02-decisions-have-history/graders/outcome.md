---
type: llm
focus: last_message
weight: 1
---
Decisions have history. Check all of:
- It does NOT overwrite or delete the Celery decision.
- It appends the Dramatiq decision with a dated update marker and a reason (e.g. `[Updated: <date> — <reason>]`), keeping the original visible.
- If the reason for the switch is not given, it asks for it rather than inventing one.
Fail if the Celery decision disappears or is rewritten in place.
