---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Review PR #858 (APP-648).

No shell, `gh`, or Atlassian MCP here — do not call them or dispatch agents. Command output is inlined. State what you do and the exact receipt/report you would return.

`headRefOid` → `a09e5d1`. Diff: `inventory/services/episode.py`, `tests/test_episode.py`.
Jira AC3: "Given an episode in state `closed`, when `open_episodes` is queried, then it is excluded."
Ticket also carries: `🤖 <!-- agile:spec-correction -->` AC3 says state `closed`; ground truth EPISODE_STATES = ("armed","fired") at inventory/models/episode.py:8; closure is `closed_at IS NOT NULL`; intent satisfied by filtering on `closed_at`.
`git show a09e5d1:inventory/services/episode.py` line 46: `StockoutEpisode.closed_at.is_(None),` and test `test_closed_episode_excluded` sets `closed_at` and asserts exclusion.
