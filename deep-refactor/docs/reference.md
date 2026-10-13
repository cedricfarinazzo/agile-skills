# Reference

[← deep-refactor](../README.md)

## Ticket order

| Skill | Order | Frozen throughout |
|---|---|---|
| `deep-refactor` | bugs first, structural splits last | tests, except the edits enumerated in the correctness-fix and structural tickets |
| `test-refactor` | deletions and merges, harness, parallel-isolation, runtime cost, depth | production code, except a defect fix filed as its own PR |
| `doc-refactor` | falsehoods, deletions, dedup, compression, gaps; file moves last | zero source edits |

## Non-vacuity proof

Every guard or test a ticket touches gets a proof it can fail: inject a defect, watch it fail, revert.

## Compression proof (doc-refactor)

Compression is proven by a **per-file** operative-token diff: commands, flags, config keys, MCP names. A token surviving in another doc is not evidence this one kept it.

## Pins by skill

| Skill | Pin inventory |
|---|---|
| `deep-refactor` | test imports, patch targets, source-text guards, coverage detectors, CI globs |
| `test-refactor` | what depends on the tests: coverage detectors keyed on static test imports, CI selection globs and naming conventions, per-file coverage-omit rules, meta-tests that scan test source, docs that reference test names |
| `doc-refactor` | inbound links, site nav, `#anchor` targets, load-bearing filenames |

## Codex

All three skills run inline on Codex. See the [compatibility guide](../../docs/CODEX_COMPATIBILITY.md).
