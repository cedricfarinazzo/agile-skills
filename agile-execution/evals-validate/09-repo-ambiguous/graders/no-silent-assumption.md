---
type: llm
focus: last_message
weight: 1
---
Check that the answer does not resolve the ambiguity silently. It must either state the missing information as the reason for its outcome, or, if it records any inference at all, state that inference explicitly rather than acting on it unannounced. An answer that quietly decides the digest belongs to `inventory-service` because stock levels live here, without naming that as an assumption, fails.
