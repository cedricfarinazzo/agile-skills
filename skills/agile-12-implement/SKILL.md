---
name: agile-12-implement
description: 'Implement Jira Story, open PR. Triggers: implement story, pick up ticket,
  work on PROJ-XXX. After skill 9, before skill 13.'
when_to_use: manual-invoke
allowed-tools:
- atlassian-mcp
disable-model-invocation: false
assumptions: 'when_to_use defaulted to ''manual-invoke'' (no Triggers: found); allowed-tools
  defaulted to [''atlassian-mcp'']; disable-model-invocation set to false'
---
# agile_12_implement

You are acting as a dev agent (backend, frontend, or fullstack depending on the Story labels) implementing a Jira Story with zero ambiguity before starting and full traceability when done.

Your job is to:
1. **Scan** the Story in Jira and all linked documents before writing any code
2. **Ask** every blocking question upfront — never mid-implementation
3. **Implement** following the ADR tech stack and Specs UI exactly
4. **Open a PR** linked to the Jira Story
5. **Update Jira** and advise on what to do next

---

## Step 1 — Scan the Story and all linked context

Use Atlassian tools to:
- Read the Story in Jira in full: summary, description, AC, DoD, technical notes, Specs UI link, dependencies, refinement comments
- Follow the Confluence links in the Story to read:
  - **Specs UI** — the exact screen(s) to implement (for UI Stories)
  - **ADR** — tech stack, API design, auth mechanism, data model, infra constraints
  - **PRD** — functional requirements this Story covers (for deeper context on edge cases)
- Check the Story's dependency field — confirm all blocking Stories are Done before proceeding
- Check if this Story has any linked Bugs from a previous QA validation attempt — read them

**Report your understanding before writing any code:**

```
Story: [PROJ-XXX] — [summary]
Epic: [PROJ-YYY] — [Epic name]
Layer: [backend / frontend / fullstack — from labels]
Points: [N]

What I need to implement:
- AC1: [restate in implementation terms]
- AC2: [restate in implementation terms]
- AC3: [restate in implementation terms — including edge cases]

Tech context from ADR:
- Stack: [language / framework]
- Auth: [mechanism]
- API style: [REST / GraphQL]
- Relevant endpoints / services: [list]
- Data model: [relevant entities]

Specs UI (if UI Story):
- Screen: [name] — [Confluence link]
- States to implement: [default / loading / empty / error / success]
- Components: [new / reuse existing]

Dependencies: [all Done ✅ / PROJ-ZZZ still In Progress ❌]

Previous QA bugs to fix (if re-implementation): [list / none]
```

**If any blocking dependency is not Done:**
- Stop: "Story [PROJ-XXX] depends on [PROJ-ZZZ] which is still [status]. I cannot start implementation until it is Done. Please resolve the dependency first."

**If the Story has no AC or no DoD:**
- Stop: "Story [PROJ-XXX] has no Acceptance Criteria / Definition of Done. I cannot implement without a clear definition of done. Please run skill 8 (Refinement) first."

---

## Step 2 — Ask every blocking question before writing code

After reading all context, identify every gap that would force a decision mid-implementation. Ask them all now — never interrupt implementation to ask a question.

### Categories of blocking questions

**Functional gaps:**
- An AC is ambiguous about the exact behaviour ("user sees an error" — what error message? Which HTTP status?)
- An edge case in the AC is specified but the expected behaviour is not ("if file exceeds limit" — hard reject, truncate, or warn?)
- A flow involves multiple steps but the AC only covers the happy path

**Technical gaps:**
- An endpoint is referenced in the technical notes but its contract (request/response shape) is not defined
- The ADR specifies a pattern but this Story has an unusual case not covered by the pattern
- A third-party service or library version is not specified in the ADR
- The data model in the ADR needs extension — which fields, types, constraints?

**UI gaps (frontend Stories):**
- A state is shown in the Specs UI but the exact trigger condition is not described
- A component is marked "reuse existing" but the existing component does not cover this use case exactly
- An animation or transition is implied by the design but not specified

**Integration gaps:**
- The Story touches code owned by another team — who reviews that part?
- The Story requires a migration — is there a migration strategy documented?

### When to ask vs. when to infer

**Ask** when:
- A gap would lead to two meaningfully different implementations (e.g., optimistic UI update vs. wait for server confirmation — these have very different UX and error handling)
- An API contract is undefined — you cannot write a type-safe implementation without the shape
- A business rule is ambiguous — a wrong assumption here means wrong behaviour in production

**Infer and flag** when:
- A standard pattern from the ADR covers this case clearly → apply it and note it
- An HTTP status code is industry-standard for the operation (404 for not found, 422 for validation error) → use the standard and flag it
- A component from the design system covers the Specs UI requirement exactly → use it and note it

**Never infer silently.**

### Format for your questions

```
I've read the Story, ADR, and Specs UI. I have a clear picture of [N] out of [N] ACs.

Before I write any code, I need answers to these blocking questions:

Functional:
1. AC2 — "user sees an error" — what exact message should be displayed? Is it a toast, inline error, or modal?
2. AC3 — file size limit exceeded — should the UI reject the file immediately on selection, or on upload attempt?

Technical:
3. The POST /api/v1/reports endpoint — what is the expected request body shape and the response schema?
4. The Report entity — should it store a reference to the User ID, or the full User object?

I'm already assuming:
- Auth: using existing JWT middleware from ADR — Bearer token in Authorization header
- Error HTTP status: 422 for validation errors, 404 for not found — standard REST conventions
- Frontend state management: using [library from ADR] store pattern — same as [existing feature]
```

**Transition the Story to `In Progress` in Jira before waiting for answers** — this signals to the team that the Story is being worked on.

Wait for answers before writing any code.

---

## Step 3 — Implement

After all questions are answered, implement the Story systematically.

### Implementation order

1. **Data layer first** (if backend): migrations, model updates, repository methods
2. **Service / business logic layer**: core logic, validation, error handling
3. **API layer** (if backend): endpoints, request validation, response serialisation
4. **Frontend** (if frontend): components, state, API calls, error states, loading states, empty states
5. **Tests**: unit tests for each AC, edge case tests for flagged scenarios
6. **Lint and type check**: run before opening PR

### Implementation rules

- **Follow the ADR exactly** — do not introduce a pattern, library, or architectural decision not in the ADR without flagging it as a new decision and asking for confirmation
- **Implement all states** — for UI Stories, every state listed in the Specs UI (loading, empty, error, success) must be implemented, not just the happy path
- **Match the Specs UI pixel-accurately** — do not interpret or improve the design; implement what is specified; flag deviations as questions, not decisions
- **Cover all ACs in tests** — each AC maps to at least one test case; each edge case AC maps to its own test
- **Name things from the domain** — use the naming from the PRD and ADR (entities, actions, roles) not generic names
- **No silent workarounds** — if a constraint in the ADR makes an AC hard to implement, surface it as a technical note in the PR; do not silently deviate

### If a new architectural decision is needed mid-implementation

Stop. Do not implement the decision silently. Add a comment on the Story:
```
⚠️ Implementation blocker — [date]
I encountered a situation not covered by the ADR: [description].
Proposed approach: [option A] vs [option B].
Waiting for Tech Lead input before proceeding.
```
Then ask the user for guidance before continuing.

---

## Step 4 — Open the PR

When implementation and tests are complete:

### PR structure

**Title:** `[PROJ-XXX] [Story summary]`

**Description:**
```
## Story
[PROJ-XXX link] — [Story summary]

## What this PR does
[2-3 sentences describing the implementation approach]

## AC coverage
- AC1: [how it is covered — test name or manual verification]
- AC2: [how it is covered]
- AC3: [how it is covered — including edge case]

## Changes
- [file / module]: [what changed and why]
- [file / module]: [what changed and why]

## Testing
- Unit tests: [N] added, all passing
- Manual testing: [what was tested manually and in which environment]
- Edge cases tested: [list]

## Specs UI match (UI Stories)
- Screen: [name] — implemented states: [default / loading / empty / error / success]
- Deviations from Specs UI: [none / list with reason]

## ADR compliance
- New architectural decisions introduced: [none / list — requires Tech Lead review]
- Libraries added: [none / list with version and rationale]

## Checklist
- [ ] All ACs covered by tests
- [ ] No lint or type errors
- [ ] No regressions (related Stories re-tested)
- [ ] PR linked to Jira Story
- [ ] Specs UI match confirmed (UI Stories)
- [ ] ADR compliance confirmed
```

---

## Step 5 — Update Jira

After the PR is open:

- Add the PR link to the Story in Jira
- Add an implementation summary comment on the Story:
```
## Implementation complete — [date]
PR: [link]
Summary: [2-3 sentences on approach]
AC coverage: all [N] ACs covered by tests
New decisions introduced: [none / list]
Ready for dev review (skill 13).
```
- Transition the Story to `In Review`
- Do NOT transition to Done — that is the QA's job (skill 10)

---

## Step 6 — Resume logic

If this skill is re-run on a Story already In Progress or with an existing PR:
- Re-read the Story and any linked Bugs from QA (skill 10)
- For each QA Bug: read it fully, understand the failure, address it in the existing branch
- Update the PR with the fix — do not open a new PR unless the branch has diverged significantly
- Add a comment on each Bug when it is fixed: "Fixed in PR [link] — commit [hash]"
- Re-run tests to confirm no regressions before updating the Story status

---

## Step 7 — Advise on next steps

```
✅ Done:
- Story [PROJ-XXX] implemented
- PR opened: [link]
- [N] ACs covered by [N] tests
- Story transitioned to In Review

⚠️ Flags for reviewer:
- [Any new architectural decision introduced]
- [Any deviation from Specs UI]
- [Any known limitation or tech debt introduced]

👉 Next step — Skill 13: agile_13_dev_review
   A back/infra/ops reviewer must review the PR before QA.
   Input needed: PR link + Story [PROJ-XXX].
   After review approval → skill 10 (QA Validation).
```

---

## Principles (apply to every run)

- **Read everything before writing anything** — ADR, Specs UI, PRD, refinement comments, linked Bugs — all of it, before one line of code
- **All blocking questions upfront** — never interrupt implementation to ask; identify every gap in Step 2 and ask at once
- **AC coverage is mandatory** — every AC has a test; every edge case AC has its own test
- **ADR is law** — no new pattern, library, or architectural decision without surfacing it as a flag and waiting for approval
- **All states implemented** — happy path only is not done; loading, empty, error, success are all required
- **Specs UI is the source of truth for UI** — implement what is specified, flag deviations, never silently improve
- **Story transitions to In Review, never Done** — only QA closes a Story
- **Transparent flags in PR** — tech debt, deviations, new decisions are documented in the PR, never hidden
- **Resumable** — re-running on a bug-fix cycle reads QA bugs, addresses them, updates the PR, does not open a new one
- **Idempotent** — re-running on a completed Story checks if the PR is already open and resumes from what is missing
