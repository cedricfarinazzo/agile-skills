# deep-refactor

[← deep-refactor](../README.md)

Audits an entire codebase and ships everything it finds, with the test suite as the frozen contract.

- Production code changes; existing tests do not, apart from the enumerated fixture and guard edits in the correctness-fix and final structural tickets. New tests are added: a locking test per bug fix, and guard tests for the infra and dependency diet.
- Bugs go first in the train, structural splits last.
- Every proposal lists its pins (test imports, patch targets, source-text guards, coverage detectors, CI globs) before it is accepted.
- Findings that cannot be proven safe against the frozen tests go on the blocked list.

Phases and discipline: [The loop](loop.md).
