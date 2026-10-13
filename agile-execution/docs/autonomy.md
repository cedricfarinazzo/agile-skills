# Autonomy

[← agile-execution](../README.md)

Invoking `agile-10-implement` authorises the whole pipeline for every eligible ticket. There is no confirmation mid-loop.

## What it decides itself

Reversible choices: naming, structure, test approach, standard ADR patterns. Each is documented and flagged in the PR so the reviewer sees it.

## What parks a ticket

A **critical decision**: irreversible or high blast radius, **and** not derivable from the ADR, PRD or Specs. Examples: a destructive migration, an auth or security change, breaking a shared contract, a new paid or infra dependency, data-loss risk.

The loop parks that one ticket, asks one consolidated question, and keeps working the others. At the top level a park and a whole-run stop (other than "no work available") each send one push notification; progress never does.

## Other exits (skip one ticket, keep the run)

| Exit | Result |
|---|---|
| Ticket targets another repo | Skipped as out-of-scope |
| Under-specified: readiness score under 6, no acceptance criteria, no DoD, or a blocking unknown | Back to Needs Info with what is missing. With `needs-info-status-name` unset it stays in `To Do` labelled `needs-info` |
| Self-review not converging after more than 3 review→fix cycles | PR left open with a 🤖 blocked comment; ticket skipped |

## A wrong ticket is corrected in the open

An acceptance criterion that names a file, test or symbol that does not exist is not a rejection, and its literal text is not authoritative. `implement-plan` finds ground truth, posts a `🤖 <!-- agile:spec-correction -->` comment with evidence, and satisfies the criterion by intent. The merge-side reviewer verifies against that correction and treats an unexplained deviation with no correction as Critical.

## Whole-run stops

The run itself stops, and reports, when no work is available (a clean stop with an empty report), a ticket cannot be loaded (auth, deleted, wrong project or `cloudId`), there is a dependency cycle, `git push` or `gh pr create` fails for auth or permissions, or two consecutive tickets hit the same unrelated CI infrastructure failure.
