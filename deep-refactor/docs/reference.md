# Reference

[← deep-refactor](../README.md)

## Ticket order

| Skill | Order | Frozen throughout |
|---|---|---|
| `deep-refactor` | bugs first, structural splits last | zero test edits |
| `test-refactor` | deletions and merges, harness, parallel-isolation, runtime cost, depth | zero production edits |
| `doc-refactor` | falsehoods, deletions, dedup, compression, gaps; file moves last | zero source edits |

## Non-vacuity proof

Every guard or test a ticket touches gets a proof it can fail: inject a defect, watch it fail, revert.

## Compression proof (doc-refactor)

Compression is proven by a **per-file** operative-token diff: commands, flags, config keys, MCP names. A token surviving in another doc is not evidence this one kept it.

## Pins by skill

| Skill | Pin inventory |
|---|---|
| `deep-refactor`, `test-refactor` | test imports, patch targets, source-text guards, coverage detectors, CI globs |
| `doc-refactor` | inbound links, site nav, `#anchor` targets, load-bearing filenames |

## Codex

All three skills run inline on Codex. See the [compatibility guide](../../docs/CODEX_COMPATIBILITY.md).
