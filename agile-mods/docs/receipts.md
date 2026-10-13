# Receipt inspector

[← agile-mods](../README.md)

Every loop agent ends with a receipt: a short structured report the orchestrator acts on. The [contract](../../CLAUDE.md) says what a receipt holds and what it must not. The inspector checks each receipt as it comes back, so you don't have to read them all to spot a bad one.

A flagged receipt shows a toast and a `✖` on the Guards tab; a clean one shows `✔`.

```text
/receipts          flagged receipts
/receipts all      every receipt (the last 40)
/receipts clear    forget them
```

```text
2 of 9 receipt(s) flagged
pr-reviewer          PR #42    no reviewed sha
ticket-validator               blocked: Jira returned 403 on transition
```

| Flag | Meaning |
|---|---|
| `no receipt` | The agent returned nothing |
| `preamble` | It opens with prose ("I'll…", "Here is…") instead of its fields |
| `summary/praise section` | A `Summary`, `Overview`, `Praise` or `What went well` heading in a `pr-reviewer`, `review-lens` or `self-reviewer` receipt, which the contract forbids |
| `summary section in a strict receipt` | The same headings in any other agent's receipt, which holds structured fields only |
| `blocked: …` | The agent stopped; the orchestrator must act on the blocker |
| `unapplied_mutations: …` | A side effect (transition, comment, push) the agent could not apply |
| `no reviewed sha` | A `pr-reviewer` receipt without its `Reviewed sha:` line. The merge guard doesn't rely on it: it checks the reviewer's own reads |
| `agent errored` | The dispatch itself failed |

Only `agile-execution`, `agile-merge-review` and `agile-sprint-drain` agents are checked. `/agile-board reset` clears the list too.
