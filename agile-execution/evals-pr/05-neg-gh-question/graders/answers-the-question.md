---
type: llm
focus: last_message
weight: 1
---
The user asked which gh flag reads a PR body from a file. Check both:
- The answer gives the command, naming `gh pr create --base main --title "..." --body-file <path>` (or `-F`), rather than deflecting.
- It does NOT run the PR phase: no assembled PR body with AC coverage / Test tiers / ADR compliance sections, no `agile:phase=pr` marker, and no claim of having opened a PR or posted to Jira.
