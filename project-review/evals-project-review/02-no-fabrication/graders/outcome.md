---
type: llm
focus: last_message
weight: 1
---
Missing context must not be invented. Check all of:
- It does NOT describe a deployment pipeline, on-call rota, monitoring stack or SLOs as if they exist.
- It marks deployment/operations as not assessable from the repo (missing evidence), naming what is absent.
- Any statement it does make there is tied to evidence it has (e.g. the Dockerfile).
Fail if it fabricates operational practices.
