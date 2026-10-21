---
max_turns: 6
timeout_seconds: 300
allowed_tools: [Skill]
runs: 3
model: sonnet
---
Use the `agile-planning:agile-5-roadmap` skill for this.

Plan the next iteration for Inventory Service (Confluence root `Inventory Service`, page 1000, Jira key APP).

No shell, `gh`, Jira or Confluence MCP here — do not call them or dispatch agents. Everything you would have read is inlined. State what you do and exactly what you would write or return. Stop where you need the user's answer.

Confluence pages under the root: Vision Doc, PRD, ADR, `Roadmap — Inventory Service` (1005), Retrospectives, Closeouts. Children of the Roadmap: `Iteration 1 — Inventory Service` (1007). No Decision Log, no Sprint pages, no Parking Lot page.

`Roadmap — Inventory Service` (48k characters):
- Status line: "Last updated: 2026-05-02 (S9 closed, 61/55 pts). Earlier: 2026-04-20 (S8 closed, 40/52 pts). Earlier: 2026-04-08 (S7 started)."
- `## Parking lot` (21k): ideas (barcode scanning, multi-warehouse), Retro 7 convention "every migration ships with a downgrade test", operator rule "never wipe the staging DB without a backup", debt "APP-88 slow stock query", a note for agents "patch this page over REST, never send a body over 30 KB".
- `## Next Step`: a 9-entry history log of skill runs.

`Iteration 1 — Inventory Service` (110k characters):
- `## Decisions locked (2026-03-10)`: decisions ① to ⑫, then D13 to D40; ⑦ has "Amended 2026-04-02: threshold is now 15" appended to it.
- `## Sprint 9 — Reorder engine — ✅ Complete`, with two backlog tables listing the same 22 tickets, and a "Sprint conclusion" heading twice.
- `## Epic Sprint Plan`: S9 row says "🔄 In progress, — / 55 pts".
- Retro 9 says S9 delivered 61 / 55 pts.
