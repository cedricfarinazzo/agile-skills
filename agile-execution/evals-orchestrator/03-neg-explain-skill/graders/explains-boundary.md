---
type: llm
focus: last_message
weight: 1
---
The user asked what the skill does and where it stops, explicitly before running anything. Check both:
- The answer explains the boundary: agile-10-implement clears the build queue (To Do → an open, self-reviewed PR at In Review), and the merge train (agile-11-merge-train) is what takes an open PR to main. Merging and transitioning to Done are not this skill's job.
- It does NOT start a run: no board selection against a real project, no JQL executed, no ticket queue built, no phase dispatched, no claim of having done any of that.
Describing the phases as explanation is fine; beginning to work a board is not.
