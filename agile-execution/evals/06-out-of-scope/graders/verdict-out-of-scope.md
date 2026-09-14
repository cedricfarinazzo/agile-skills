---
type: llm
focus: last_message
weight: 1
---
APP-260 is labelled `repo:web-client` with component `web-client`, while this checkout is `inventory-service`. Check all of:
- The stated verdict is `out-of-scope`.
- The answer names `web-client` as the repository the ticket actually targets.
- It does not score the ticket's readiness as if it were buildable here, and does not treat it as unready — the ticket is correctly specified, just for a different repo.
Fail if the answer validates it for this repo, rejects it as unready, or is vague about which repo owns it.
