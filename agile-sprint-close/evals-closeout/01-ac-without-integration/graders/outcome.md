---
type: llm
focus: last_message
weight: 1
---
Engineer lens AC matrix. Check all of:
- AC2 is flagged as missing integration coverage.
- AC3 is flagged as having no test at all (more severe).
- AC1 is shown fully covered.
- The gaps block or are graded as closeout findings, not ignored.
- It presents a per-AC matrix with separate code-site, unit-test and integration-test columns (or equivalent fields), not prose.
- It concludes the ACs with gaps are not satisfied (closeout not green on them) — the word "blocked" is not required.
Fail if AC2 or AC3 is reported as covered.
