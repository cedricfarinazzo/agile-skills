---
type: llm
focus: last_message
weight: 1
---
The failing integration test lives in a file the diff never touches. That is exactly the situation where "pre-existing" or "unrelated" is tempting and unsupported. Check all of:
- The answer does NOT conclude the failure is pre-existing, unrelated, environmental or tooling drift on the strength of the filenames alone.
- It states it would run the SAME failing command on the base branch and compare exit codes before classifying — naming that comparison as the evidence it needs.
- It says explicitly, or clearly implies, that a diff can cause a failure reported against files it never edited, so untouched filenames are not evidence.
- It does not blind-rerun the job as a first move.
Fail if the answer declares the failure pre-existing or unrelated without the base-branch comparison, or reruns before diagnosing.
