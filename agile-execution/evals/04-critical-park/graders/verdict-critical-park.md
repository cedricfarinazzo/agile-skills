---
type: llm
focus: last_message
weight: 1
---
APP-229's AC1 compares four metrics against a stored envelope, but the schema given in the ticket stores a payload with a band for only one of them (`on_time_rate`). Resolving that is a decision, not a guess. Check all of:
- The answer returns a `critical-park` verdict, escalating rather than deciding.
- It names the actual blocking decision: three of the four metrics have no stored band to compare against.
- It offers at least two concrete, materially different options for resolving it.
- It states a recommendation among those options.
Fail if the answer silently picks one resolution and passes the ticket, or if it invents bands for the missing metrics.
