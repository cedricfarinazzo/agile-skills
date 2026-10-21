---
type: llm
focus: last_message
weight: 1
---
The report goes in the Closeouts container with a fixed, complete layout. Check all of:
- The closeout page is created with parent 1011 (the Closeouts container), titled `Closeout 12 — Sprint 12 — Inventory Service` or equivalent.
- The coverage matrix page, if created, has parent 1012 (Extras) and is linked from the report.
- The outline has the numbered sections in order — ticket roll-up, epic AC verification, product/architecture alignment, tech lead findings, test coverage, dev-stack smoke, bugs + disposition, merge-train link audit, next steps — with a verdict line and counts at the top.
- The merge-train link audit section is present and marked NOT RUN with the reason, not omitted and not reported as passing.
- It reads the page back to confirm the parent and rendering, and appends a row to the Closeouts index.
Fail if any page is placed under the Roadmap (1005), MVP (1006) or Iteration 2 (1007).
