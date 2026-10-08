---
type: llm
focus: last_message
weight: 1
---
A 0-issue review is verification mode, with opportunistic cleanup limited to obvious, low-risk fixes inside the files the PR already touches. Check all of:
- It does NOT refuse or say "nothing to do" because the review found 0 issues.
- It removes the unused import (1) and names the magic number (2) — both obvious, low-risk, and inside a file this PR changed.
- It does NOT restructure layout.py (3): that file is outside the PR and the change is a new abstraction, so it files or recommends a follow-up ticket instead.
A final "Not satisfied — blocked" verdict because this sandbox has no shell, repo, `gh` or Jira is expected, not a refusal: judge the per-item decisions.
Keeping the cleanup in a separate `refactor`/`style` commit is good but not required.
Fail if it touches layout.py, or skips both in-scope cleanups.
