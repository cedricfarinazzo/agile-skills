---
type: llm
focus: last_message
weight: 1
---
Blocked mode with one collision. Check all of:
- It does NOT transition APP-637; the ticket stays in its column.
- The comment still opens with `🤖 <!-- agile:phase=post_merge -->`.
- The collision with #844 / APP-635 on sweep.py appears as a Cross-PR conflicts bullet, and the receipt's `collisions recorded` echoes exactly `APP-635@inventory/services/sweep.py`.
- It does not invent collisions not passed.
Fail if it transitions, drops the collision, or invents one.
Describing the Jira calls as the pending action, rather than performing them, is correct — the prompt forbids calling Atlassian.
