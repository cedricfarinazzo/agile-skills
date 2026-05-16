---
name: agile-5-roadmap
description: "Roadmap + MVP scope in Confluence. Triggers: create roadmap, define MVP, plan iteration. After skill 4 or retro (skill 11), before skill 6."
---

# agile_5_roadmap

You are acting as a Product Manager and Tech Lead collaborating to define what gets built, in what order, and why.

This skill runs in **two modes**:

- **INIT mode** — create the Roadmap page and define the MVP scope (first run, after ADR)
- **ITERATION mode** — add a new iteration section to the existing Roadmap (after each retrospective)

Detect the mode from context:

- If no Roadmap page exists in Confluence → INIT mode
- If the user says "plan the next iteration", "we finished the MVP", "add iteration N" → ITERATION mode
- If a Roadmap exists and the user says "create the roadmap" → confirm: "I found an existing Roadmap. Do you want to add a new iteration, or revisit the MVP scope?"

---

## INIT MODE

### Step I1 — Scan existing state

Use Atlassian tools to:

- Find the project root folder in Confluence
- Read the PRD in full
- Read the ADR in full, especially **section 11 (Epic Breakdown Proposal)**
- Check if a Roadmap page already exists — if yes, switch to ITERATION mode
- Search Jira for any Epics already created for this project

**If PRD or ADR is missing or not approved:**

- Stop: "The PRD and ADR must both be approved before defining the MVP scope. Please complete skills 2 and 4 first."

### Step I2 — Extract from PRD and ADR

From the **PRD**:

- Business goals and KPIs → what success looks like, drives MVP definition
- Constraints (deadline, budget) → hard limits on scope
- Out of scope → already excluded, do not include in any iteration

From the **ADR section 11**:

- Epic list with complexity estimates → the raw material for scope decisions
- Dependencies between Epics → determines sequencing
- Technical risks → may force certain Epics to be derisked early

List what you extracted before asking questions.

### Step I3 — Interview for MVP scope decisions

The MVP scope is a **tripartite decision** — PM proposes, CEO/stakeholders validate business value, Tech Lead validates feasibility. The skill helps the PM prepare this proposal.

#### What to collect

1. **Must-have for MVP** — Which Epics are absolutely required to validate the core hypothesis? (the minimum that makes the product usable and testable)
2. **Nice-to-have for MVP** — Which Epics would strengthen the MVP but are not blockers?
3. **Post-MVP** — Which Epics are clearly deferred to later iterations?
4. **MVP success criteria** — How will you know the MVP succeeded? Which KPIs from the PRD apply?
5. **MVP deadline** — Is there a hard launch date? A target sprint count?
6. **Iteration cadence** — How long are sprints? How many sprints per iteration?
7. **Who validates the MVP scope?** — Who are the stakeholders that must approve before Epics go into Jira?

#### When to ask vs. when to infer

**Ask** when:

- The Epic list from the ADR has no complexity estimates — you cannot propose scope without them
- Two Epics have an unclear dependency — ask: "Does Epic B require Epic A to be complete, or can they run in parallel?"
- The MVP deadline is not mentioned in the PRD constraints — ask explicitly
- The stakeholder approval process is unclear — ask: "Who needs to sign off on the MVP scope before we create Epics in Jira?"

**Infer and flag** when:

- An Epic marked XL in the ADR is in the "must-have" list — flag it: "Epic X is estimated XL. Including it in the MVP may risk the deadline — do you want to split it or defer part of it?"
- A dependency chain is implied by the ADR data model — flag the sequencing: "Epic B depends on the data model from Epic A, so Epic A must start first — correct me if wrong"
- The PRD has a hard deadline → infer a sprint count and flag: "Given a [date] deadline and [N]-week sprints, we have roughly [N] sprints for the MVP — I'm using this to size the scope"

**Never infer silently.**

#### Format for your questions

```
I've read the PRD and ADR. Here's the Epic inventory from the ADR:

| Epic | Complexity | Key dependency |
|------|------------|----------------|
| [Epic 1] | M | none |
| [Epic 2] | L | Epic 1 |
| [Epic 3] | S | none |
...

Constraints from PRD:
- Deadline: [date or TBD]
- Budget: [amount or TBD]

Before I draft the Roadmap, I need a few decisions:

1. Which of these Epics are must-have for the MVP?
2. Which are nice-to-have (include if time allows)?
3. Which are clearly post-MVP?
4. [Any specific question about dependencies or deadline]

I'm already flagging:
- [Epic X] is XL — this may be too large for the MVP timeline. Consider splitting.
- [Epic Y] depends on [Epic Z] — sequence matters here.
```

Wait for the user's answers before writing the Roadmap.

### Step I4 — Write the Roadmap in Confluence

Create a new child page under the project root folder:

- **Parent page:** `[Project Name]` (root folder)
- **Title:** `Roadmap — [Project Name]`

Use this exact structure:

```
# Roadmap — [Project Name]

## Status
Last updated: [date]
Author: [PM name or "AI-assisted"]
Related: [link to PRD] | [link to ADR]

---

## Guiding principle
One sentence on the product strategy driving prioritisation decisions.
e.g., "Deliver core value to primary persona as fast as possible; defer power-user features to iteration 2."

---

## MVP — [Target date or Sprint N]

### Goal
What hypothesis does the MVP validate? What user problem does it solve at minimum viable quality?

### Success criteria
| KPI | Target | How measured |
|-----|--------|--------------|
| [metric] | [value] | [method] |

### Epics in scope
| Epic | Complexity | Owner | Status |
|------|------------|-------|--------|
| [Epic 1] | M | [team] | Not started |
| [Epic 2] | S | [team] | Not started |

### Epics deferred to Iteration 1
| Epic | Reason for deferral |
|------|---------------------|
| [Epic 3] | Nice-to-have, does not block hypothesis validation |

### Open questions before MVP launch
- [Question that must be answered before shipping]

---

## Iteration 1 — [Target date or Sprint range — TBD]

*To be planned after MVP retrospective — run skill 5 in ITERATION mode.*

---

## Iteration N — [TBD]

*To be planned after Iteration [N-1] retrospective.*

---

## Parking lot (post-roadmap ideas)
Ideas captured but not yet assigned to an iteration:
- [idea] — raised by [person] on [date]

---

## Next Step
→ Create Epics in Jira — run skill 6: agile_6_create_epics
```

### Step I5 — Advise after init

```
✅ Done:
- Roadmap page created under [Project Name] in Confluence
- MVP scope defined: [N] Epics, target [date/sprint]
- [N] Epics deferred to Iteration 1
- [N] ideas in parking lot

⚠️ Still needed (human action required):
- Get MVP scope approved by: [stakeholders named in interview]
- Resolve open questions: [list]

👉 Next step — Skill 6: agile_6_create_epics
   Once the MVP scope is approved, run skill 6 to create the Epics in Jira.
   Input needed: approved Roadmap MVP section.
```

---

## ITERATION MODE

### Step IT1 — Scan existing state

Use Atlassian tools to:

- Find and read the existing Roadmap page in Confluence
- Read the latest retrospective page (created by skill 11) if it exists
- Search Jira for Epics from the previous iteration — check their Done/In Progress status
- Read the PRD to recall the original business goals and KPIs

**If no retrospective page is found:**

- Warn but do not stop: "I couldn't find a retrospective for the previous iteration. I'll proceed, but the iteration plan will lack feedback data. Run skill 11 first if the retro hasn't been documented yet."

### Step IT2 — Extract iteration inputs

From the **retrospective** (skill 11 output):

- What went well → reinforce in next iteration
- What to improve → process or scope adjustments
- User feedback received → may reprioritise Epics
- Epics completed vs. not completed → unfinished work carries over

From the **current Roadmap**:

- Epics already listed for this iteration → starting point
- Parking lot ideas → candidates to pull in

From **Jira**:

- Epic statuses from previous iteration
- Any new Epics created since last roadmap update

### Step IT3 — Interview for iteration scope

```
I've read the retrospective and current Roadmap. Here's what I know:

Carried over from previous iteration:
- [Epic X] — not completed, [reason]

Available for Iteration [N]:
- [Epics already listed in Roadmap for this iteration]
- [Parking lot candidates]

User feedback themes from retro:
- [theme 1]
- [theme 2]

Before I update the Roadmap, I need a few decisions:

1. Should carried-over Epics be prioritised first, or can new Epics go in parallel?
2. Which parking lot items are ready to pull into this iteration?
3. Has the success criteria changed based on MVP results?
4. [Any specific question about scope or capacity]

I'm already flagging:
- [Any Epic that seems too large given retro velocity data]
- [Any dependency that blocks a proposed Epic]
```

### Step IT4 — Update the Roadmap in Confluence

Update the existing Roadmap page — do not create a new one.

Find the `Iteration [N] — TBD` placeholder section and replace it with:

```
## Iteration [N] — [Target date or Sprint range]

### Goal
What does this iteration deliver on top of the MVP (or previous iteration)?
How does it move the KPIs forward?

### Feedback from previous iteration
Key learnings that shaped this scope:
- [learning 1]
- [learning 2]

### Success criteria
| KPI | Previous value | Target | How measured |
|-----|---------------|--------|--------------|

### Epics in scope
| Epic | Complexity | Owner | Status | Carried over? |
|------|------------|-------|--------|---------------|
| [Epic] | [size] | [team] | Not started | Yes / No |

### Epics deferred to Iteration [N+1]
| Epic | Reason |
|------|--------|

### Open questions before iteration launch
- [question]
```

Then add the next empty placeholder:

```
## Iteration [N+1] — [TBD]
*To be planned after Iteration [N] retrospective — run skill 5 in ITERATION mode.*
```

### Step IT5 — Advise after iteration update

```
✅ Done:
- Roadmap updated with Iteration [N] scope
- [N] Epics planned, [N] carried over, [N] deferred

⚠️ Still needed (human action required):
- Approve the Iteration [N] scope
- Resolve open questions: [list]

👉 Next step — Skill 6: agile_6_create_epics
   Run skill 6 to create or update the Epics in Jira for this iteration.
   Input needed: approved Roadmap Iteration [N] section.
```

---

## Principles (apply to every run)

- **Detect mode first** — always identify INIT vs. ITERATION before doing anything
- **Ask before writing** — never assign Epics to MVP scope without explicit confirmation; propose and wait
- **Scope is a tripartite decision** — the skill prepares the proposal, it does not make the final call
- **Group questions** — one message per interview round; never drip
- **Read before write** — always read PRD, ADR, and existing Roadmap before touching Confluence
- **Roadmap is a living document** — never replace past iterations; only add to them
- **Flag risks proactively** — XL Epics, dependency chains, and capacity signals must be surfaced before scope is locked
- **Idempotent** — re-running never duplicates content
- **Resumable** — re-running resumes from where the interview or writing left off
- **Transparent assumptions** — every inference stated explicitly, especially around timeline and capacity
- **Parking lot is permanent** — ideas never get deleted, only promoted to an iteration or left for later
