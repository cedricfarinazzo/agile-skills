---
type: llm
focus: last_message
weight: 1
---
The verdict must bind every acceptance criterion to the code satisfying it. Check both:
- AC1 and AC2 are each mapped to a specific location — a file plus a line number or a named function or test.
- The bindings are plausible: AC1 to the counting query in `get_c` and the test asserting a count of 2; AC2 to the `or 0` fallback and the test asserting 0.
Fail if the ACs are declared satisfied with no per-AC location.
