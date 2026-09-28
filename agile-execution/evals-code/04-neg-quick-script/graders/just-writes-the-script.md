---
type: llm
focus: last_message
weight: 1
---
The user asked for a throwaway one-liner for a one-off check on a file outside the repo. Check both:
- The answer gives a working script or command that counts CSV rows grouped by the third column (awk, a shell pipeline, or a short Python snippet are all fine).
- It does NOT run the build phase: no feature branch, no Jira ticket or marker, no AC→test map, no gate receipt with exit codes, no mutation proof, no commit-and-push ceremony.
Asking one brief clarifying question about the delimiter or a header row is acceptable, provided a script is still given.
