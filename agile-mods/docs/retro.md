# Retro data

[← agile-mods](../README.md)

`/agile-board retro` · always active · code: `hooks/state/retro.ts`

Numbers for the sprint retro, counted as the loop runs, so `agile-15-retro` quotes facts instead of reconstructing them from Jira comments.

The loop is counted as it runs: phase markers and `rework` markers per ticket, `3a`/`3b`/`3c` runs and merge attempts per PR, blocked receipts, drain passes and outcome. When `agile-15-retro` is invoked, the counts ride its Skill call as context, so its Step 1 can quote them. `/agile-board retro` prints them; `/agile-board reset` clears them with the board.

Example:

```
agile-mods loop data (recorded by the mod over 9 day(s); counts, not judgements):
- tickets with phase markers: 12; with rework cycles: 2 (VC-7×2, VC-9×1)
- PRs through the merge train: 10; re-reviewed or re-fixed: 3 (#42 review×3 fix×2, …)
- merge attempts retried: 1 (#40×2)
- blocked agent receipts: 1
- sprint drain: 4 pass(es), DRAINED
```
