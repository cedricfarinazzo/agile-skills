---
type: llm
focus: last_message
weight: 1
---
PR #449's `list_rules_with_stock` issues one `StockLevel` query per rule inside its loop — a classic N+1 on a paginated list endpoint, up to 50 extra queries per page, against an ADR that requires a bounded query count independent of page size. Check all of:
- The review raises this as a BLOCKER.
- It identifies the per-row query inside the loop as the cause, in `list_rules_with_stock`.
- It proposes a bounded fix: a join, or a single batched lookup of the page's SKU ids, rather than merely "optimise this later".
Fail if the review approves the PR, or reports the N+1 only as a warning or future improvement.
