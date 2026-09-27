---
type: llm
focus: last_message
weight: 1
---
Deadness needs evidence. Check all of:
- csv_v1.py is proposed for deletion (grep proves no references).
- hooks.py::on_import is NOT deleted — it is a plugin entrypoint reached outside the code graph.
- slugify is not deleted on a hunch; it needs a grep/tooling check first.
- It reports before applying.
Fail if on_import or slugify is deleted.
