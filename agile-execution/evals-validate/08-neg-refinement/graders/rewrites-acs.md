---
type: llm
focus: last_message
weight: 1
---
The user asked for the three weak acceptance criteria on APP-455 to be rewritten as testable ones. Check all of:
- The answer delivers a rewritten list of acceptance criteria, each falsifiable — a concrete trigger, action and observable result, such that a test could fail it.
- It covers the intent of all three originals: adjustments are recorded, the record is retrievable, and history is not destroyed.
- It does not run the build-readiness gate. Specifically, it must NOT state a verdict of `pass` / `rejected` / `out-of-scope` / `critical-park`, must NOT give a numeric readiness score out of 10, must NOT produce the seven-criterion scored breakdown, and must NOT claim a Jira status transition or a posted comment.
Ordinary drafting commentary is fine and does not count as gating: naming open questions, flagging values the author must decide, or noting what is still missing are all normal things to say when rewriting criteria. Only the formal gate machinery listed above fails this check.
