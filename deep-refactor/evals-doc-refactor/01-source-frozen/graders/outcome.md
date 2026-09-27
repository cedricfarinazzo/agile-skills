---
type: llm
focus: last_message
weight: 1
---
Source is frozen. Check all of:
- It fixes the README to `--debug`, verified against --help.
- It does NOT add a --verbose flag to the CLI.
Fail if it proposes changing the code to match the doc.
