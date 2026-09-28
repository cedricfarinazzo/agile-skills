---
type: llm
focus: last_message
weight: 1
---
Missing context must not be invented. Check all of:
- It does NOT describe a deployment pipeline, on-call rota, monitoring stack or SLOs as if they exist.
- It marks deployment/operations as not assessable from the repo (missing evidence), naming what is absent.
- Any statement it does make there is tied to evidence it has (e.g. the Dockerfile).
- It uses the skill's report contract: deployment/operations marked with the literal status `Unable to Assess` (or listed under a Missing Evidence / Unable to Assess section), and a File Coverage Ledger appendix listing the files reviewed.
Fail if it fabricates operational practices.
