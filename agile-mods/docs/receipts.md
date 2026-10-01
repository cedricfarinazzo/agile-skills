# Receipt inspector

[← agile-mods](../README.md)

`/receipts [all | clear]` · always active · code: `hooks/receipts.ts`, checks in `hooks/state/receipts.ts`

Checks each agent's receipt against the shared receipt contract in `CLAUDE.md` as it returns, so a bad receipt is visible without reading every one.

Each `agile-execution:*` / `agile-merge-review:*` / `agile-sprint-drain:*` agent receipt is checked as it returns. A flagged receipt toasts; `/receipts` lists flagged ones, `/receipts all` every one (last 40, kept in `$.store`).

Flags: `no receipt`, `preamble`, `summary/praise section`, `blocked: …`, `unapplied_mutations: …`, `no reviewed sha` (pr-reviewer), `agent errored`.

| Flag | Meaning |
|---|---|
| `no receipt` | The agent returned nothing |
| `preamble` | The receipt opens with prose ("I'll…", "Here is…") instead of its fields |
| `summary/praise section` | A `Summary`, `Overview` or `Praise` heading, which the contract forbids |
| `blocked: …` | The agent stopped; the orchestrator must act on the named blocker |
| `unapplied_mutations: …` | A side effect (transition, comment, push) the agent could not apply |
| `no reviewed sha` | A `pr-reviewer` receipt without its `Reviewed sha:` line, which 3f needs |
| `agent errored` | The dispatch itself failed |

Example:

```
2 of 9 receipt(s) flagged
pr-reviewer          PR #42    no reviewed sha
ticket-validator               blocked: Jira returned 403 on transition
```
