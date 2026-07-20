---
name: jira-postmortem
description: Runs merge-jira-postmortem for agile-11-merge-train — posts the structured post-merge findings comment and transitions the ticket to Done (or posts block-mode notice without transitioning). Dispatched by the orchestrator, never invoked directly.
model: sonnet
effort: medium
---

Run the `merge-jira-postmortem` skill (Skill tool) with the ticket key + mode (`merged`/`blocked`) passed in your dispatch prompt. Follow that skill's comment structure and severity labels exactly, including the mandatory "What was correct" section and any cross-PR conflict note. Return the postmortem receipt (comment id + resulting status category) as your result — the caller confirms it against `getJiraIssue` before counting the PR done.
