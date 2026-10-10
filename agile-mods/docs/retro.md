# Retro data

[← agile-mods](../README.md)

`/agile-board retro` · always active · code: `hooks/state/retro.ts`

Numbers for the sprint retro, counted as the loop runs, so `agile-15-retro` quotes facts instead of reconstructing them from Jira comments.

Counted from the calls themselves: `3a`/`3b`/`3c` dispatches and merge attempts per PR, receipts that reported `blocked`, drain passes and outcome. Phase markers and `rework` markers per ticket come from the board's Jira sync, not from the comments the loop says it posted. When `agile-15-retro` is invoked, the counts ride its Skill call as context, so its Step 1 can quote them. `/agile-board retro` prints them; `/agile-board reset` clears them with the board.

Example:

```
agile-mods loop data (recorded by the mod over 9 day(s); counts, not judgements):
- tickets with phase markers (Jira): 12; with rework cycles: 2 (VC-7×2, VC-9×1)
- PRs through the merge train: 10; re-reviewed or re-fixed: 3 (#42 review×3 fix×2, …)
- merge attempts retried: 1 (#40×2)
- agent receipts that reported blocked: 1
- sprint drain: 4 pass(es), DRAINED
```
