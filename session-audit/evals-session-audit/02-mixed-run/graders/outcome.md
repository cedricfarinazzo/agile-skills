---
type: llm
focus: last_message
weight: 1
---
The run labelled "before" switched mode mid-run. Check all of:
- It says the before run is mixed: old mode until about 21:26-22:17, new mode after, so it is not a clean sample of the old mode.
- It still reports the per-PR delta (about $53 vs about $14) but carries the mixed-run caveat with it.
Fail if it presents the delta as a clean old-vs-new comparison with no caveat.
