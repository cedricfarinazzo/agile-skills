---
type: llm
focus: last_message
weight: 1
---
The reviewer's receipt is partial in three ways against a seven-file diff. Check all of:
- The answer REFUSES to advance the PR, despite the APPROVED verdict, green CI and the tip matching the reviewed sha.
- It identifies that the Files-read list (3 files) does not equal the diff set (7 files) — models/rule.py, the migration, tests/test_reorder.py and the integration test were never read.
- It identifies that AC2 has no `file:line` cite — "covered" is not a binding.
- It identifies the missing Lint-rule cascade disposition, which must be either N/A or the rebased-tree sweep and its result.
- It says the review must be re-dispatched, rather than patching the receipt itself, asking the user, or accepting it with a note. Describing the re-dispatch as the pending action is correct — the prompt forbids dispatching.
Fail if the answer advances toward merge, or treats the APPROVED verdict as sufficient because CI is green.
