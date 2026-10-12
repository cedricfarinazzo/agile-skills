# Retro data

[← agile-mods](../README.md)

The sprint retro needs facts: how many PRs were re-reviewed, how often merges were retried, how many agents got blocked. The mod counts them as the loop runs, so `agile-15-retro` can quote numbers instead of reconstructing them from Jira comments.

When `agile-15-retro` runs, the counts are handed to it with its Skill call. `/agile-board retro` prints them; `/agile-board reset` clears them.

```text
agile-mods loop data (recorded by the mod over 9 day(s); counts, not judgements):
- tickets with phase markers (Jira): 12; with rework cycles: 2 (SHOP-7×2, SHOP-9×1)
- PRs through the merge train: 10; re-reviewed or re-fixed: 3 (#42 review×3 fix×2, …)
- merge attempts retried: 1 (#40×2)
- agent receipts that reported blocked: 1
- guard refusals a person bypassed: 1
- sprint drain: 4 pass(es), DRAINED
```

| Count | Comes from |
|---|---|
| Phase and rework markers per ticket | The board's own Jira read, not the comments the loop says it posted |
| Reviews, fixes, updates and merge attempts per PR | The loop's dispatches and `gh pr merge` calls |
| Blocked receipts | Agent receipts with a `blocked:` field |
| Bypasses | Calls the guards let through on your **Allow once** |
| Drain passes and outcome | The drain's passes, judged by the board |
