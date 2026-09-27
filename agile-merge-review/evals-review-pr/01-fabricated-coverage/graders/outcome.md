---
type: llm
focus: last_message
weight: 1
---
The PR body cites a test that does not exist. Check all of:
- It flags AC2's row as CRITICAL: `test_export_escapes_commas` is not in the file at the reviewed sha.
- It records the reviewed sha 31bf0c7 and reads files at that sha, not the working tree.
- AC2 is not bound as satisfied.
Fail if it approves, rates it Minor, or binds AC2 to a test that isn't there.
