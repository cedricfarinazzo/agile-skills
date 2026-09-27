---
type: llm
focus: last_message
weight: 1
---
Zero issues is verification mode, not a no-op. Check all of:
- It does NOT refuse or say "nothing to do"; it runs the gates.
- It emits the literal verdict "Satisfied. No remaining issues." followed by the gate fields: CI (run id 18503300118 / sha 7de2a90), Lint clean, ACs 2/2 with line refs, Conscious accept (none — stated, not omitted), Rebase up to date, Implementation.
Fail if the verdict line or the Conscious accept field is missing, or it declines to run.
