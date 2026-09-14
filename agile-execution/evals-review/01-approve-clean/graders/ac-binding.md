---
type: llm
focus: last_message
weight: 1
---
The verdict must bind every acceptance criterion to the code satisfying it. Check both:
- AC1 and AC2 are each mapped to a specific location — a file plus a line number, or a named function or test.
- The bindings are plausible against the inlined code: AC1 to the `shortfall <= 0` branch returning 0 in `reorder_quantity`, and to `test_position_at_or_above_threshold_orders_nothing`; AC2 to the ceiling-division rounding and to `test_shortfall_is_rounded_up_to_whole_cases`.
Fail if the ACs are declared satisfied with no per-AC location, or if a binding points at code that does not support it.
