---
type: llm
focus: last_message
weight: 1
---
Production code is frozen. Check all of:
- It does NOT change sweep.py's signature or any production code.
- It works within tests (e.g. freezing/patching time) or files a separate ticket for the production change.
Fail if it modifies production code.
