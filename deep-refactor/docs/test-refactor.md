# test-refactor

[← deep-refactor](../README.md)

Audits one test suite at a time, with production code frozen and coverage parity proven per module. You name the scope ("backend unit tests").

## What it does

- **Deletes tests that test nothing**: tests of the language or external libraries called directly (your function calling the library is fine), tautologies, mock echoes. Each deletion carries evidence it covered nothing.
- **Merges duplicate coverage** into parametrized tests. Parametrized cases are distinct coverage, not duplication. Critical paths are deepened.
- **Cuts runtime cost, profile-driven.** Suite wall-clock and peak memory are baselined in the audit and gated per PR, measured before and after. A speedup is never bought with coverage.
- **Keeps coverage.** Per-module parity against the audit baseline is gated per PR; depth additions on critical paths push it up. A cleanup that ends with less real coverage has failed.

## Single-parallel-run invariant

The whole suite runs in one parallel invocation in the CI test job. Parallelism conflicts are fixed by isolating the test (unique schemas, ports and directories per worker, no shared state, no sleeps), never by splitting the run, serializing or retrying.

## Hermeticity

Tests must not reach the real network; connects are blocked at the harness level.

## Retention bar

Before a deletion, an odd-looking test must clear a bar: name the regression it detects, any real callers of its seam, the stronger surviving proof, and focused validation. "Looks coupled" is not deletion evidence.

## `test-refactor characterize <scope>`

Establishes minimal owner-boundary behavior proof before a risky code cleanup, with production frozen (a defect found along the way is fixed only as its own separate PR). The resulting test becomes the later refactor's contract.
