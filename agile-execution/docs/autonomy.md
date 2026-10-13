# Autonomy

[← agile-execution](../README.md)

Invoking `agile-10-implement` authorises the whole pipeline for every eligible ticket. There is no confirmation mid-loop.

## What it decides itself

Reversible choices: naming, structure, test approach, standard ADR patterns. Each is documented and flagged in the PR so the reviewer sees it.

## What parks a ticket

A **critical decision**: irreversible or high blast radius, **and** not derivable from the ADR, PRD or Specs. Examples: a destructive migration, an auth or security change, breaking a shared contract, a new paid or infra dependency, data-loss risk.

The loop parks that one ticket, asks one consolidated question, and keeps working the others. At the top level a park sends one push notification; progress never does.

## Other exits (skip one ticket, keep the run)

| Exit | Result |
|---|---|
| Ticket targets another repo | Skipped as out-of-scope |
| Under-specified (acceptance criteria, DoD, Specs or ADR missing) | Back to Needs Info |
| Self-review not converging in 3 cycles | Left as an unconverged review for the merge side |

## A wrong ticket is corrected in the open

An acceptance criterion that names a file, test or symbol that does not exist is not a rejection, and its literal text is not authoritative. `implement-plan` finds ground truth, posts a `🤖 <!-- agile:spec-correction -->` comment with evidence, and satisfies the criterion by intent. The merge-side reviewer verifies against that correction and treats an unexplained deviation with no correction as Critical.
