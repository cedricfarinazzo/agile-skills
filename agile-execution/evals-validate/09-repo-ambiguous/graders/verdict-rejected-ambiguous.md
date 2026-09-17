---
type: llm
focus: last_message
weight: 1
---
APP-277 has no labels, no components, and technical notes stating that which service owns the digest has not been decided. Nothing resolves its target repo. Check all of:
- The answer does NOT assume the ticket belongs to this repo and proceed to build it.
- It reaches a rejection / needs-info outcome, treating the unresolved target as a missing-spec problem.
- It names the unresolved ownership explicitly: the ticket does not say which service hosts, renders, or sends the digest, and the repo cannot be derived from labels, components, or notes.
Fail if the answer picks a repo by inference and passes the ticket.
