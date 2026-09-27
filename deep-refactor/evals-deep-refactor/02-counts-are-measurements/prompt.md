---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Skill]
runs: 3
---
Write the audit report entry for the duplicated SKU-normalisation helper, repo `inventory-service` at commit `e41f0aa`.

No shell, `gh`, Atlassian or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return.

Your notes say "roughly 40-50 call sites, probably". `grep -rn "normalize_sku(" inventory tests | wc -l` → `47`.
