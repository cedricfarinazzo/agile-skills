---
type: llm
focus: last_message
weight: 1
---
The verdict must bind every acceptance criterion to the code satisfying it. Check both:
- AC1 and AC2 are each mapped to a specific location — a file plus a line number or a named function or test.
- The bindings are plausible against the inlined code: AC1 to `create_rule`/`list_rules` and the test that persists and lists a rule; AC2 to the `threshold <= 0` guard in `create_rule` and the test asserting `ValidationError` with nothing written.
Fail if the ACs are declared satisfied with no per-AC location, or if a binding points at code that does not support it.
