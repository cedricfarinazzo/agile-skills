---
type: llm
focus: last_message
weight: 1
---
PR #431 has a planted test defect. `test_overlong_code_is_refused_by_the_database` builds a 200-character code and claims to prove the database constraint refuses it — but `create_sku` validates through `SkuIn`, whose `constr(max_length=24)` rejects the input first. The test passes for the wrong reason: the database constraint is never evaluated, so AC1 is not actually proven. Check all of:
- The review raises this as a BLOCKER.
- It identifies the real mechanism: the Pydantic/schema length check in `SkuIn` rejects the value before it can reach the database, so the assertion never exercises the storage constraint it names.
- It points at the test, and at `SkuIn` in `inventory/schemas.py` as the earlier layer doing the rejecting.
Extra credit is not required, but noting that `pytest.raises(Exception)` is too broad to distinguish the two failures is consistent with a correct finding.
Fail if the review approves the PR, or accepts the test as proving AC1.
