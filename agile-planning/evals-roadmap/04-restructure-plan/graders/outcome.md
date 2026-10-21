---
type: llm
focus: last_message
weight: 1
---
A drifted tree is restructured losslessly before new planning lands in it. Check all of:
- It detects the drift (changelog in the status line, history log in Next Step, mixed parking lot, decisions in two id schemes, duplicated backlog, contradictory S9 status) and proposes RESTRUCTURE before writing the new iteration.
- The plan maps content to the canonical pages: Sprint 9 becomes its own Sprint page with one merged backlog table; decisions get D### ids with ① to ⑫ kept as aliases and the ⑦ amendment as its own entry in a Decision Log; ideas go to a Parking Lot page, the convention and operator rule to Working Agreements, APP-88 to the Debt Register, the agent note to the repo's CLAUDE.md/AGENTS.md (not Confluence).
- The S9 contradiction is resolved from an authoritative source (61 / 55 from the retro or Jira), with the stale value noted, not silently chosen.
- It archives or records the old versions and plans a check that every ticket key, decision id, link, number and date survives.
- It presents the plan and waits for approval before writing anything.
Fail if it writes the new iteration into the drifted pages without proposing the restructure, or if its plan drops any of the listed content.
