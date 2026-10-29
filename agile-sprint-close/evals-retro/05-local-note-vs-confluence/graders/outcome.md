---
type: llm
focus: last_message
weight: 1
---
A local note disagrees with Confluence and Jira. Check: it treats the Retrospectives page and the Jira tickets as the source of truth (A1 is still open, APP-88 To Do); it does not report A1 as done from the local note; it does not treat "drop the nightly e2e job" as a recorded decision, and either asks to record it in the Decision Log or flags it as unrecorded; every action and decision it produces is written to Confluence or Jira, not only to a local file; it corrects or drops the stale local note. Fail if it carries A1 as done, cites the e2e decision as made, or keeps retro actions only in a local file.
