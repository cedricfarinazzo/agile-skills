---
type: llm
focus: last_message
weight: 1
---
The Specs UI for APP-288 lists four states: default, loading, empty and error. Check all of:
- The plan accounts for all four, including `loading` — which has no AC of its own and is the one most easily dropped, since the ACs only cover default, empty and error.
- The plan provides for a Storybook story and a component test per state, per the ADR extract.
- Each of AC1, AC2 and AC3 is mapped to at least one named test.
Fail if any of the four states is missing from the plan, or if the ACs are not mapped to tests.
