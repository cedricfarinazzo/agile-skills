---
type: llm
focus: last_message
weight: 1
---
An existing PRD is resumed, not replaced. Check all of:
- It reports per-section status (complete / placeholder / missing).
- It resumes from Functional Requirements and NFRs — drafting them or asking for the information they need both count, since the skill asks before writing a section it has no real information for.
- It never overwrites the complete sections.
Fail if it rewrites the PRD from scratch.
