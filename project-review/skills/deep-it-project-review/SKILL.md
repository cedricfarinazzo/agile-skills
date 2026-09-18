---
name: deep-it-project-review
description: "Autonomously perform a deep, evidence-backed technical review of a software or IT project across applicable architecture, code, security, delivery, operations, and lifecycle domains without modifying project files. Triggers: deep IT project review, technical project review, architecture audit, repository assessment, assess this codebase, review this project."
user-invocable: true
---

# Deep IT Project Review

## Purpose

Perform an autonomous, evidence-based technical review of a software or IT project.

The review must be broad enough to catch architectural, implementation, security,
operational, reliability, delivery, documentation, governance, and lifecycle risks,
while remaining project-aware: do not apply irrelevant checks mechanically.

**Deep source-code review is mandatory whenever source code is present.**
The reviewer must inspect implementation details, trace important execution paths,
understand interactions between modules, and evaluate correctness, failure behavior,
security properties, maintainability, and testability. A review that only inspects
configuration, manifests, CI, documentation, or static-analysis summaries is incomplete.

The reviewer must inspect the project, infer its technology and operating model,
determine which review domains are applicable, investigate each applicable domain
deeply, and produce a prioritized review report with concrete evidence.

At the end of every review, the reviewer MUST write the complete final report to a
Markdown file in the review workspace. The default filename is:

`PROJECT_REVIEW.md`

If that filename would overwrite an existing project file, use a non-conflicting name
such as `PROJECT_REVIEW_<timestamp>.md` in an external or designated output directory.
The review report is the only file the reviewer is permitted to create or modify.

---

# Core principles

1. **Evidence over assumption**
   - Every finding must reference concrete project evidence when possible:
     files, code, configuration, manifests, scripts, CI/CD definitions, tests,
     documentation, dependency metadata, runtime settings, or generated analysis.
   - Clearly distinguish:
     - observed fact
     - inferred risk
     - missing evidence
     - recommendation

2. **Applicability over checklist compliance**
   - Not every domain applies to every project.
   - Before reviewing a domain, classify it:
     - `Applicable`
     - `Partially Applicable`
     - `Not Applicable`
     - `Unable to Assess`
   - Explain the reason briefly.

3. **Depth over superficial linting**
   - Do not stop at format, lint, or obvious static-analysis issues.
   - Trace architecture, execution flow, data flow, failure behavior, security
     boundaries, delivery process, and production operability.

4. **Risk-based prioritization**
   - Prioritize findings based on:
     - impact
     - likelihood
     - exploitability / failure probability
     - blast radius
     - detectability
     - remediation difficulty

5. **Strict read-only repository behavior**
   - NEVER modify project source code.
   - NEVER modify project configuration.
   - NEVER modify tests.
   - NEVER modify documentation already present in the project.
   - NEVER apply automatic fixes, formatting, migrations, refactors, dependency updates,
     lockfile updates, generated-code updates, or code transformations.
   - NEVER use commands or tool options that rewrite files.
   - NEVER run package-manager commands whose normal behavior updates manifests or lockfiles.
   - NEVER run database migrations against persistent environments.
   - NEVER deploy.
   - NEVER alter infrastructure, cloud resources, secrets, credentials, permissions,
     registries, CI/CD configuration, or remote systems.
   - The repository and project files are evidence, not an editable workspace.
   - The ONLY permitted write is the final Markdown review report, plus temporary build/test
     artifacts outside tracked source paths when required by normal tooling.

6. **No Git operations**
   - NEVER execute Git commands of any kind.
   - Do not run `git status`, `git diff`, `git log`, `git show`, `git blame`, `git branch`,
     `git checkout`, `git switch`, `git restore`, `git reset`, `git clean`, `git add`,
     `git commit`, `git merge`, `git rebase`, `git tag`, `git fetch`, `git pull`,
     `git push`, or any other `git` subcommand.
   - Do not use Git libraries or APIs as a workaround.
   - Do not modify `.git/`.
   - If history, authorship, or branch information would normally be useful, mark it as
     unavailable unless equivalent evidence exists outside Git metadata.

7. **Build/test/run is allowed when safe**
   - The reviewer MAY compile, build, test, start, or execute the project when doing so
     is reasonably safe and useful for review.
   - Prefer isolated/local execution.
   - Avoid commands that mutate source files, persistent databases, external services,
     cloud resources, or production-like environments.
   - Use dry-run/read-only modes where available.
   - Treat generated build outputs, caches, coverage data, temporary logs, and test artifacts
     as disposable analysis artifacts.
   - Keep such artifacts outside tracked source paths where practical.
   - If normal build/test execution would modify project files, do not run it; explain why.

8. **Do not fabricate missing context**
   - If runtime, cloud, production, organizational, or compliance evidence is absent,
     explicitly mark the area `Unable to Assess`.

---

# Review workflow

Execute the review in the following phases.

## Phase 0 — Project discovery

Inspect the project before making judgments.

Determine:

- project type
- primary languages
- frameworks
- build system
- package managers
- repository layout
- runtime
- deployment model
- CI/CD system
- infrastructure model
- databases
- messaging systems
- cloud providers
- containers / Kubernetes
- APIs
- frontend / backend / mobile components
- observability stack
- security tooling
- test frameworks
- documentation structure
- third-party integrations
- AI / agent components
- regulated or sensitive data indicators

Inspect common files where present:

- README*
- CONTRIBUTING*
- CHANGELOG*
- SECURITY*
- LICENSE*
- CODEOWNERS
- Makefile
- Taskfile*
- Dockerfile*
- docker-compose*
- compose*
- package.json
- lock files
- pom.xml
- build.gradle*
- settings.gradle*
- Cargo.toml
- go.mod
- go.sum
- requirements*.txt
- pyproject.toml
- poetry.lock
- Gemfile*
- *.csproj
- *.sln
- Jenkinsfile
- .github/workflows/*
- .gitlab-ci.yml
- azure-pipelines*
- bitbucket-pipelines*
- terraform files
- Pulumi files
- CloudFormation templates
- Helm charts
- Kubernetes manifests
- Ansible
- Packer
- OpenAPI / AsyncAPI definitions
- database migrations
- schema files
- monitoring / alerting config
- dashboards
- runbooks
- ADRs
- architecture diagrams

Create a concise **Project Profile** before detailed review.

---

# Phase 0.5 — Mandatory deep source-code reconnaissance

If source code exists, this phase is REQUIRED before domain scoring or conclusions.

The reviewer must not merely sample a few files. Build a working mental model of the
implementation and inspect the most important code paths deeply.

## Source inventory

Identify:

- application entry points
- primary packages/modules
- public APIs
- core business/domain logic
- persistence layer
- integration/adaptor layer
- authentication/authorization logic
- configuration loading
- error-handling infrastructure
- background workers / schedulers
- asynchronous consumers/producers
- concurrency-sensitive code
- security-sensitive code
- serialization/deserialization boundaries
- filesystem/network/process execution
- caching
- data validation
- critical algorithms
- test architecture

## Execution-path tracing

Trace representative high-value flows end-to-end.

Examples:

- request -> validation -> authorization -> business logic -> persistence -> response
- event -> consumer -> transformation -> side effect -> acknowledgement
- CLI invocation -> parsing -> execution -> error handling -> exit code
- scheduled job -> state read -> mutation -> external dependency -> retry/failure path
- user action -> frontend state -> API -> backend -> database
- agent input -> prompt/context -> tool selection -> tool execution -> validation -> output

For each critical path, inspect:

- entry conditions
- data transformations
- trust-boundary transitions
- validation
- authorization
- state changes
- error paths
- retries
- timeouts
- cleanup
- logging
- observability
- tests covering the behavior

## Deep implementation review

Inspect source code for:

- incorrect assumptions
- logic defects
- race conditions
- concurrency hazards
- resource leaks
- lifetime bugs
- state corruption risks
- hidden global state
- unsafe shared mutable state
- deadlocks
- infinite loops
- retry storms
- missing timeouts
- exception swallowing
- overly broad exception handling
- inconsistent error contracts
- partial-failure handling
- non-idempotent retries
- insecure deserialization
- injection vectors
- filesystem traversal
- unsafe process execution
- insecure temporary files
- unsafe parsing
- weak validation
- privilege-boundary mistakes
- accidental information disclosure
- sensitive logging
- insecure defaults
- hardcoded credentials or tokens
- dangerous debug behavior
- misuse of cryptographic APIs
- API misuse
- broken invariants
- off-by-one/boundary errors
- numeric overflow/precision issues where relevant
- timezone/date handling issues
- locale/encoding assumptions
- N+1 queries
- obvious algorithmic inefficiencies
- unnecessary memory retention
- excessive allocations on critical paths
- fragile abstractions
- duplication of business rules
- dead code
- obsolete compatibility paths
- maintainability hazards

## Source-code review depth requirement

For non-trivial repositories, the reviewer MUST:

1. inspect multiple files from each critical architectural layer;
2. inspect the implementation of critical business/security paths, not only interfaces;
3. inspect error/failure paths as well as happy paths;
4. inspect representative tests alongside the production code they validate;
5. inspect call sites for important abstractions where practical;
6. inspect code around external boundaries such as databases, APIs, queues, filesystems,
   subprocesses, authentication systems, and cloud SDKs;
7. cross-check comments and documentation against actual behavior;
8. distinguish locally observed bugs from speculative concerns;
9. cite exact files and line ranges whenever possible.

If repository size prevents exhaustive file-by-file inspection, prioritize by risk:

1. authentication / authorization / secrets / crypto
2. data mutation and persistence
3. externally reachable APIs and parsers
4. process execution / filesystem / network operations
5. concurrency and asynchronous processing
6. core business logic
7. deployment/runtime bootstrap
8. tests around the above
9. supporting utilities

Record any unreviewed areas explicitly in the final report.

---

# Phase 1 — Applicability matrix

Classify all 20 review domains.

Use this table:

| # | Domain | Applicability | Reason |
|---|---|---|---|
| 1 | Requirements | | |
| 2 | Architecture & Design | | |
| 3 | Code | | |
| 4 | Code Quality | | |
| 5 | Testing | | |
| 6 | Test Coverage | | |
| 7 | Performance | | |
| 8 | Security | | |
| 9 | Dependencies & Supply Chain | | |
| 10 | Configuration | | |
| 11 | Infrastructure & Cloud | | |
| 12 | CI/CD & Release | | |
| 13 | API & Integrations | | |
| 14 | Data & Database | | |
| 15 | Reliability & Resilience | | |
| 16 | Observability & Operations | | |
| 17 | Documentation | | |
| 18 | UX / Accessibility / Compatibility | | |
| 19 | Governance | | |
| 20 | Cost & Lifecycle | | |

Only skip a domain after documenting why it is not applicable.

---

# Phase 2 — Deep review

Review each applicable domain using the checks below.

## 1. Requirements

Review:

- functional requirements
- non-functional requirements
- acceptance criteria
- business rules
- constraints
- assumptions
- edge cases
- negative scenarios
- traceability
- security requirements
- privacy requirements
- availability requirements
- latency / performance requirements
- scalability expectations
- compatibility expectations
- retention requirements
- SLA / SLO requirements
- migration requirements
- rollback expectations

Look for:

- undocumented behavior
- ambiguity
- contradictions
- missing acceptance criteria
- requirements not covered by tests
- hidden operational assumptions

---

## 2. Architecture & Design

Review:

- architecture boundaries
- module / service boundaries
- coupling
- cohesion
- ownership boundaries
- dependency direction
- state management
- data flow
- control flow
- synchronous vs asynchronous interactions
- distributed-system assumptions
- failure boundaries
- transaction boundaries
- caching
- concurrency
- consistency model
- idempotency
- retry design
- scalability
- availability
- extensibility
- technology choices
- architectural debt
- ADR coverage

Investigate:

- single points of failure
- cyclic dependencies
- shared databases
- hidden coupling
- chatty service interactions
- inappropriate abstraction
- unnecessary complexity
- brittle central components

---

## 3. Code

This domain is mandatory whenever source code is present.

Perform a deep implementation review. Do not limit the review to representative surface
sampling when more critical implementation code is available. Trace important call chains,
inspect callers and callees where necessary, and correlate production code with its tests.

Evaluate:

- correctness
- readability
- naming
- modularity
- API use
- error handling
- exception handling
- boundary handling
- null / optional handling
- concurrency
- synchronization
- resource lifecycle
- file/socket/connection handling
- unsafe operations
- logging
- validation
- defensive programming
- secrets exposure
- dangerous defaults

Trace important flows end-to-end where practical.

Do not limit review to style.

---

## 4. Code Quality

Assess:

- code smells
- duplication
- dead code
- unreachable code
- excessive complexity
- cognitive complexity
- cyclomatic complexity
- large modules / classes / functions
- excessive nesting
- long parameter lists
- god objects
- tight coupling
- low cohesion
- deprecated APIs
- warnings
- TODO / FIXME accumulation
- technical debt markers
- generated-code handling

Use static-analysis tools when safely available.

---

## 5. Testing

Review:

- unit tests
- component tests
- integration tests
- contract tests
- API tests
- E2E tests
- system tests
- smoke tests
- regression tests
- negative tests
- security tests
- performance tests
- migration tests
- upgrade tests
- failure-path tests

Evaluate:

- meaningful assertions
- deterministic behavior
- test isolation
- fixture quality
- mocking quality
- over-mocking
- flaky-test indicators
- test maintainability
- production-like integration coverage

---

## 6. Test Coverage

Assess, where tooling allows:

- line coverage
- branch coverage
- function coverage
- condition coverage
- critical-path coverage
- failure-path coverage
- API coverage
- requirements coverage
- high-risk component coverage
- mutation coverage if available

Do not equate high coverage percentages with good testing.

Identify important behaviors that remain untested.

---

## 7. Performance

Review build-time and runtime performance.

### Build
- dependency resolution
- compilation
- test execution
- packaging
- container builds
- artifact size
- cache effectiveness
- parallelization

### Runtime
- CPU
- memory
- disk
- disk I/O
- network I/O
- file descriptors
- threads
- processes
- connection pools
- garbage collection
- startup / shutdown time

### Application
- latency
- p50 / p95 / p99 where data exists
- throughput
- serialization
- queries
- caching
- algorithmic complexity
- N+1 patterns
- blocking operations
- memory growth
- leaks

### Capacity
- load
- stress
- spike
- soak
- concurrency limits
- bottlenecks
- scaling behavior

Do not invent benchmark results.

---

## 8. Security

Review:

- threat model
- trust boundaries
- attack surface
- authentication
- authorization
- RBAC / ABAC
- least privilege
- privilege escalation
- input validation
- output encoding
- injection
- XSS
- CSRF
- SSRF
- deserialization
- path traversal
- command execution
- file upload
- session handling
- token handling
- cryptography
- TLS
- secret handling
- password storage
- API security
- network exposure
- rate limiting
- abuse prevention
- information disclosure
- security headers
- CORS
- debug endpoints
- administrative interfaces
- secure defaults
- dependency vulnerabilities
- insecure logging
- data leakage

For AI/agent systems also review:

- prompt injection
- indirect prompt injection
- tool permissions
- command/tool allowlists
- filesystem permissions
- network permissions
- context leakage
- secret exposure
- data exfiltration
- untrusted tool outputs
- unsafe autonomous loops
- insufficient human approval gates

---

## 9. Dependencies & Supply Chain

Review:

- direct dependencies
- transitive dependencies
- unused dependencies
- duplicate dependencies
- pinned versions
- lock files
- outdated libraries
- abandoned libraries
- end-of-life libraries
- known vulnerabilities
- license risks
- package provenance
- registry configuration
- dependency confusion
- typosquatting exposure
- integrity verification
- artifact signing
- build provenance
- SBOM
- release provenance
- base images
- image pinning
- reproducible builds where applicable

---

## 10. Configuration

Review:

- application config
- environment variables
- defaults
- production overrides
- validation
- feature flags
- timeouts
- retries
- logging levels
- debug configuration
- resource limits
- credentials
- secret references
- environment drift
- config versioning
- unsafe defaults

For agents:

- agent permissions
- command access
- tool access
- network access
- filesystem access
- execution identity
- retry loops
- timeouts
- resource limits
- telemetry
- update mechanism
- sandboxing

---

## 11. Infrastructure & Cloud

If applicable, review:

- infrastructure topology
- compute sizing
- storage
- networking
- DNS
- load balancing
- ingress
- egress
- firewalls
- security groups
- TLS
- IAM
- autoscaling
- quotas
- high availability
- multi-AZ / multi-region
- resource isolation
- infrastructure patching

### IaC
- Terraform / Pulumi / CloudFormation / similar
- state handling
- state security
- version pinning
- drift
- module quality
- destructive changes
- encryption
- naming / tagging
- policy-as-code

### Containers / Kubernetes
- base images
- image size
- root execution
- capabilities
- seccomp
- resource requests / limits
- probes
- RBAC
- network policies
- secrets
- pod security
- disruption budgets
- affinity
- autoscaling
- admission policy
- persistent volumes

---

## 12. CI/CD & Release

Review:

- pipeline architecture
- permissions
- secrets
- runner isolation
- build reproducibility
- dependency caching
- artifact retention
- quality gates
- security gates
- parallelization
- failure handling
- retries
- deployment approvals
- environment promotion
- rollback
- roll-forward
- migration ordering
- canary
- blue/green
- rolling deployment
- feature flags
- versioning
- release notes
- changelog
- signed artifacts
- release integrity

Identify privileged CI/CD paths.

---

## 13. API & Integrations

Review:

- API consistency
- REST / RPC / GraphQL semantics
- naming
- versioning
- pagination
- filtering
- status codes
- errors
- schema validation
- OpenAPI / AsyncAPI accuracy
- authentication
- authorization
- rate limits
- timeouts
- retries
- idempotency
- backward compatibility
- external dependency handling

For messaging:

- topic / queue design
- delivery guarantees
- ordering
- deduplication
- idempotent consumers
- poison messages
- DLQ
- replay
- schema evolution
- retention
- backpressure

---

## 14. Data & Database

Review:

- data model
- schema
- constraints
- normalization / denormalization
- indexes
- query efficiency
- migrations
- transactions
- isolation levels
- locks
- deadlocks
- connection pools
- replication
- partitioning
- backups
- consistency
- integrity
- retention
- deletion
- archiving
- sensitive data
- encryption
- access control
- data lineage
- data ownership
- migrations and reconciliation

---

## 15. Reliability & Resilience

Review:

- single points of failure
- redundancy
- graceful degradation
- retries
- retry storms
- backoff
- jitter
- timeouts
- circuit breakers
- bulkheads
- idempotency
- failover
- recovery
- dependency failures
- partial failures
- backpressure
- queue buildup
- overload behavior
- data-loss scenarios
- regional failure scenarios
- chaos-testing evidence

Assess RTO and RPO if applicable.

---

## 16. Observability & Operations

Review:

- logging
- structured logging
- log levels
- correlation IDs
- traces
- metrics
- business metrics
- dashboards
- alerts
- alert routing
- false-positive risk
- false-negative risk
- runbooks
- health endpoints
- readiness
- liveness
- startup probes
- synthetic monitoring
- retention
- cardinality
- sensitive-data logging
- incident readiness
- operational debugging

If SLOs exist, examine:

- SLIs
- SLO definitions
- error budgets
- burn-rate alerts
- alert alignment

---

## 17. Documentation

Review:

- README
- onboarding
- developer setup
- architecture
- ADRs
- APIs
- configuration
- deployment
- operations
- runbooks
- troubleshooting
- incident procedures
- security documentation
- backup / restore
- DR
- migration documentation
- release process
- user documentation
- diagrams
- freshness / accuracy

Cross-check documentation against actual implementation.

---

## 18. UX / Accessibility / Compatibility

Apply when there is a user-facing interface.

Review:

- user flows
- navigation
- consistency
- loading states
- empty states
- failure states
- validation messages
- error messages
- responsiveness
- keyboard navigation
- semantic markup
- screen-reader support
- contrast
- focus management
- ARIA use
- zoom behavior
- browser support
- device support
- OS support
- runtime compatibility
- internationalization
- localization
- timezone handling
- Unicode
- RTL support where relevant

---

## 19. Governance

Review where applicable:

- privacy
- data minimization
- retention
- deletion
- consent
- auditability
- access reviews
- separation of duties
- compliance requirements
- security policy alignment
- OSS licensing
- vendor dependencies
- third-party risk
- evidence retention
- change approval
- ownership
- CODEOWNERS
- incident governance
- vulnerability disclosure
- regulatory obligations

Do not claim compliance certification unless evidence proves it.

---

## 20. Cost & Lifecycle

Review:

### FinOps
- overprovisioning
- idle resources
- autoscaling
- storage growth
- network cost
- logging cost
- observability cost
- database cost
- SaaS cost
- licensing
- cost attribution
- cost anomalies
- unnecessary environments

### Maintainability
- upgradeability
- replaceability
- modularity
- technical debt
- deprecated technology
- EOL runtimes
- unsupported libraries
- obsolete infrastructure

### End-of-life
- decommission process
- data migration
- data deletion
- IAM cleanup
- infrastructure cleanup
- DNS cleanup
- certificates
- secrets
- backups
- contract termination
- archival

---

# Phase 3 — Automated analysis

Where tools and project technology allow, run appropriate safe analysis.

Examples include:

- build commands
- test suites
- coverage tools
- linters
- type checkers
- static analyzers
- dependency audits
- vulnerability scanners
- secret scanners
- IaC scanners
- container scanners
- license scanners

Prefer tools already configured by the project.

Do not install large or invasive tooling unless justified.

All automated analysis must obey the read-only rules:

- no autofix
- no formatter write mode
- no dependency updates
- no lockfile regeneration
- no source generation into tracked project paths
- no migration application
- no Git operations
- no commands that modify repository contents

If a tool cannot be guaranteed read-only, do not run it.

Record:

- command run
- exit code
- important output
- limitations

Never hide failing checks.

---

# Phase 4 — Cross-domain analysis

After reviewing individual domains, look for systemic issues spanning multiple areas.

Examples:

- architecture creating reliability risk
- configuration creating security risk
- test gaps around high-risk modules
- CI/CD permissions exposing supply-chain risk
- observability gaps preventing SLO enforcement
- undocumented migrations creating release risk
- dependencies creating both security and lifecycle risk
- performance problems caused by data-model choices
- cloud architecture creating unnecessary cost
- operational complexity caused by architectural choices

These systemic findings are often more important than isolated lint issues.

---

# Finding model

Every finding must use the following structure.

## Finding ID
Unique identifier such as:

`SEC-001`, `ARCH-003`, `TEST-002`, `OPS-004`

## Title
Short, concrete description.

## Domain
One of the 20 review domains.

## Severity

Use:

- `Critical`
- `High`
- `Medium`
- `Low`
- `Info`

### Severity guidance

**Critical**
- immediate compromise, catastrophic data loss, production-wide outage,
  or similarly severe impact is plausible

**High**
- serious security, reliability, integrity, or operational impact

**Medium**
- meaningful defect, maintainability issue, test gap, operational risk,
  or likely future failure

**Low**
- limited-risk defect, improvement, cleanup, or minor inconsistency

**Info**
- observation, strength, optional improvement, or context

## Confidence

- `High`
- `Medium`
- `Low`

## Evidence

Reference exact:

- file
- path
- line where possible
- configuration
- command output
- test result
- dependency
- manifest
- behavior

## Observation

Describe what was found.

## Risk

Describe why it matters.

## Recommendation

Provide concrete remediation.

Prefer actionable recommendations such as:

- exact configuration change
- architectural change
- test to add
- guardrail to introduce
- tool/check to enable
- metric to monitor

## Effort

Estimate:

- `XS` — minutes
- `S` — hours
- `M` — 1–3 days
- `L` — several days
- `XL` — architectural / multi-team

Do not confuse effort with priority.

---

# Positive findings

Also record important strengths.

Examples:

- strong test isolation
- clean module boundaries
- reproducible builds
- good secret handling
- robust rollback strategy
- strong observability
- secure CI configuration

Do not manufacture praise.

---

# Priority model

Use this remediation priority:

`P0`
- immediate action required

`P1`
- should be addressed before next production release

`P2`
- should be scheduled soon

`P3`
- improvement / technical debt

Priority must consider severity, confidence, reach, and remediation cost.

---

# Final report structure

Produce the final result in this exact order.

# Deep Project Review

## 1. Executive Summary

Include:

- project type
- technologies
- overall risk themes
- number of findings by severity
- most important strengths
- most important weaknesses
- major review limitations

Avoid giving a meaningless aggregate score unless explicitly requested.

---

## 2. Project Profile

Summarize discovered:

- languages
- frameworks
- build
- deployment
- infrastructure
- data stores
- CI/CD
- tests
- observability
- architecture style

---

## 3. Applicability Matrix

Include all 20 domains.

---

## 4. Critical / High Findings

Show these first.

Use a table:

| ID | Severity | Domain | Finding | Priority | Effort |
|---|---|---|---|---|---|

Then provide detailed evidence and recommendations.

---

## 5. Domain-by-Domain Review

For each applicable domain:

### <Domain>

**Status:** Reviewed / Partial / Unable to Assess

**What was reviewed**

**Strengths**

**Findings**

**Missing evidence**

**Recommendations**

---

## 6. Automated Checks

List:

| Check | Command / Tool | Result | Notes |
|---|---|---|---|

---

## 7. Cross-Domain Risks

Describe systemic risks.

---

## 8. Remediation Plan

Group actions:

### P0 — Immediate
### P1 — Before next release
### P2 — Planned remediation
### P3 — Improvement backlog

For each action include:

- finding IDs
- owner type
- effort
- dependency on other fixes

Owner types may include:

- Development
- Architecture
- Security
- Platform
- SRE
- QA
- Data
- Product
- Governance

---

## 9. Missing Evidence / Unable to Assess

Explicitly list areas that could not be validated.

Examples:

- production metrics unavailable
- cloud account unavailable
- architecture documentation missing
- no performance environment
- no threat model
- no cost data
- no production incident history

---

## 10. Suggested Follow-up Reviews

Recommend targeted reviews only where justified, for example:

- penetration test
- load test
- chaos test
- database performance review
- IAM review
- cloud security review
- threat-model workshop
- accessibility audit
- DR exercise

---

# Review behavior

The reviewer must:

- investigate before concluding
- prefer primary project evidence
- avoid repeating the same issue in multiple domains
- cross-reference related findings instead
- focus on material issues
- include file paths and line numbers when possible
- distinguish confirmed vulnerabilities from theoretical risks
- distinguish missing safeguards from proven defects
- clearly identify assumptions
- clearly identify limitations
- avoid false precision
- avoid arbitrary numeric quality scores
- avoid recommending unnecessary rewrites
- prefer incremental remediation when reasonable

---

# Depth requirements

A review is not complete merely because all categories were mentioned.

For a non-trivial project, the reviewer should aim to inspect:

- repository structure
- dependency manifests
- build system
- CI/CD
- critical business logic
- error handling
- tests
- security boundaries
- persistence
- APIs
- deployment definitions
- runtime configuration
- observability
- operational documentation

Prioritize critical execution paths and security / reliability boundaries over
uniform random file sampling.

---

# Phase 5 — Write the Markdown report

The review is not complete until the final report has been written to a `.md` file.

Default output:

`PROJECT_REVIEW.md`

Requirements:

- write the complete report, not a summary
- include every section defined in "Final report structure"
- include evidence paths and line references where available
- include the applicability matrix
- include findings, strengths, limitations, automated checks, and remediation plan
- include the date/time of review if available
- include a short statement that the repository was treated as read-only
- include a short statement that no Git operations were performed
- include a list of build/test/run commands executed
- include any commands intentionally skipped because they could mutate project files
- include unreviewed or partially reviewed source areas

The report file is the only persistent project-review artifact that may be created.

If writing inside the repository would violate the read-only requirement or overwrite an
existing file, write the report outside the repository to a designated output location.

After writing the file, return or print its path clearly.

---

# Stop conditions

Stop only when:

1. project discovery is complete enough to understand the system;
2. all 20 domains have an applicability classification;
3. each applicable domain has been investigated;
4. critical/high findings have been validated as far as available evidence permits;
5. major cross-domain risks have been considered;
6. a prioritized remediation plan has been produced;
7. limitations and missing evidence are explicit;
8. the final report has been written to a `.md` file;
9. the report path has been clearly returned;
10. no project source/config/test/documentation file was changed;
11. no Git operation was performed.

If tooling, permissions, project size, or missing context prevent full completion,
produce the best partial review possible, write that partial review to the Markdown
report, and clearly state what remains unassessed.
