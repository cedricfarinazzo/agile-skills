---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Fix all review issues on PR #823 (APP-612) until satisfied — the merge train's 3c step. The review found 0 issues, so this is a verification pass. There is no shell, `gh`, or Atlassian MCP here; do not call them. The repository is not checked out in this sandbox — do not search the working tree. You are not being asked to perform edits; decide, for each item below, whether this step changes it, leaves it, or files a follow-up, and why.

The PR changed two files. While re-reading them in full you notice:

1. `inventory/presentation/banner.py` (changed by this PR), line 2: `import os` — never used anywhere in the file.
2. `inventory/presentation/banner.py` line 9: `if n > 99:` — the `99` is the display cap from the Specs UI, unnamed.
3. `inventory/presentation/layout.py` (NOT changed by this PR): three banner classes share a copy-pasted `render()` and would be cleaner as one base class.
