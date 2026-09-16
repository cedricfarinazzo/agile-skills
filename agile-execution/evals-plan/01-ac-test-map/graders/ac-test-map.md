---
type: llm
focus: last_message
weight: 1
---
The plan's central deliverable is an AC-to-test map. Check all of:
- Every one of APP-204's four ACs is mapped to at least one named test — a test name, or a clearly identified test case. A list of ACs restated without tests does not count.
- AC4 (bounded query count on a 500-rule list) gets its own test rather than being folded into the AC1 listing test. It is the edge case here and the skill requires edge-case ACs to have their own.
- The mapped tests are plausible: AC2 to a test asserting ValidationError with nothing written; AC3 to a test asserting Forbidden for another planner's rule.
Fail if any AC has no test, or if the map is absent entirely.
