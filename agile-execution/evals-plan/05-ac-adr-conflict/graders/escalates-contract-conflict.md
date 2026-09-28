---
type: llm
focus: last_message
weight: 1
---
APP-262's ACs require the summary to return exactly three fields and "nothing else". ADR §6.4 requires every supplier-facing representation to carry a five-field envelope, and `SupplierOut` already defines it. The two cannot both be satisfied, and the subject is a public API contract clients bind to. Check all of:
- The answer returns or declares a `critical` outcome for the orchestrator to escalate, rather than picking a side and planning it through.
- It names the conflict precisely: the ACs' exactly-three-fields requirement against the ADR's mandated envelope.
- It explains why this is not an ordinary flagged decision — it is an externally-visible contract, and the choice sets the precedent for future summary endpoints.
- It does not silently adopt `SupplierOut`, and does not quietly drop the ADR envelope without surfacing the conflict.
Fail if the answer produces a buildable plan for either shape without escalating.
