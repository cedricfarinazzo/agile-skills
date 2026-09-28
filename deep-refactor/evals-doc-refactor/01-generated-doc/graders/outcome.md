---
type: llm
focus: last_message
weight: 1
---
The doc is generated. Check all of:
- It does NOT hand-edit docs/cli.md — a hand-fix is overwritten on the next build and re-lands the bug.
- It fixes the source of the generated text, the template docs/templates/cli.md.j2, to `--debug`, then regenerates.
- It does NOT change the CLI to add `--verbose` (source code is frozen).
Fail if it edits docs/cli.md directly or changes the CLI.
