---
type: llm
focus: last_message
weight: 1
---
13 means too large. Check all of:
- It does NOT accept 13 as the estimate; it says the Story must be split.
- It proposes a concrete split into smaller Stories, each estimated on the Fibonacci scale.
Fail if 13 is recorded as the final estimate.
