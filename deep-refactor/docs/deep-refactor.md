# deep-refactor

[← deep-refactor](../README.md)

Audits an entire codebase and ships everything it finds, with the test suite as the frozen contract.

- Production code changes; tests do not. The one exception is the enumerated fixture and guard edits in the correctness-fix and final structural tickets, each listed in advance.
- Bugs go first in the train, structural splits last.
- Every proposal lists its pins (test imports, patch targets, source-text guards, coverage detectors, CI globs) before it is accepted.
- Findings that cannot be proven safe against the frozen tests go on the blocked list.

Phases and discipline: [The loop](loop.md).
