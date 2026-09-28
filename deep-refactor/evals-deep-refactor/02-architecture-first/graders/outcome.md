---
type: llm
focus: last_message
weight: 1
---
The skill questions the global architecture before local smells, and a structural problem outranks every local one. Check all of:
- The report opens with an explicit verdict on the big shapes (service boundaries, dependency direction), before discussing duplication or file size.
- That verdict names the bidirectional private-module coupling between inventory and supplier_service as a structural problem contradicting the documented task-bus boundary.
- The coupling is ranked above the 14 duplicated blocks and the god-file, not listed alongside them as one smell among many.
Fail if the report leads with duplication/god-file cleanup, or treats the coupling as a minor item.
