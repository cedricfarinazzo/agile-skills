---
type: llm
focus: last_message
weight: 1
---
The verdict must bind every acceptance criterion to the code satisfying it. Check both:
- AC1 and AC2 are each mapped to a specific location — a file plus a line number or a named function or test.
- The bindings are plausible: AC1 to the plural/singular branch in `get_t` and the tests asserting "1 SKU below threshold" and "2 SKUs below threshold"; AC2 to the zero branch and the test asserting "All stock above threshold".
Fail if the ACs are declared satisfied with no per-AC location.
