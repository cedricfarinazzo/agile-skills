---
name: agile-5-roadmap
description: "Roadmap index + MVP/Iteration scope in Confluence. Roadmap stays a short index; detail lives in MVP/Iteration child pages. Triggers: create roadmap, define MVP, plan iteration. After skill 4 or retro (skill 13), before skill 6."
---

# agile_5_roadmap

You are acting as a Product Manager and Tech Lead collaborating to define what gets built, in what order, and why.

This skill runs in **two modes**:
- **INIT mode** — create the Roadmap index page + the MVP scope page (first run, after ADR)
- **ITERATION mode** — add a new Iteration page and update the Roadmap index (after each retrospective)

Detect the mode from context:
- If no Roadmap page exists in Confluence → INIT mode
- If the user says "plan the next iteration", "we finished the MVP", "add iteration N" → ITERATION mode
- If a Roadmap exists and the user says "create the roadmap" → confirm: "I found an existing Roadmap. Do you want to add a new iteration, or revisit the MVP scope?"

## Confluence structure (canonical — identical across all agile-skills)

All project docs live under one root folder created by `agile-1`. The **Roadmap is a short index** — deep detail lives in its `MVP` / `Iteration N` child pages, never inlined into the Roadmap itself.

```
📁 [Project Name]                   (root — agile-1)
├── 📄 Vision Doc — [Project]       (agile-1)
├── 📄 PRD — [Project]              (agile-2)
├── 📄 Design Brief — [Project]     (agile-3 BRIEF)
├── 📄 Specs UI — [Project]         (agile-3 INTEGRATE)
├── 📄 ADR — [Project]              (agile-4)
├── 📄 Roadmap — [Project]          (this skill — SHORT INDEX: guiding principle + iterations index table + progress rollup + parking lot)
│   ├── 📄 MVP — [Project]          (this skill; per-sprint detail by agile-9, refined backlog by agile-8)
│   ├── 📄 Iteration 1 — [Project]  (this skill, ITERATION mode)
│   └── 📄 Iteration N — [Project]
├── 📁 Retrospectives — [Project]   (folder, agile-13; one Retro page per sprint)
└── 📁 Closeouts — [Project]        (folder, dev-sprint-closeout — sibling of Retrospectives, NOT inside it)
```

**The short-index rule is the core invariant of this skill.** The Roadmap page never holds goal text, success-criteria tables, full epic-in-scope lists, per-sprint backlogs, or retro write-ups. Those live in the `MVP — [Project]` and `Iteration N — [Project]` child pages. The Roadmap carries only: the guiding principle, the iterations index table (one row per MVP/iteration, linking to its page), a progress rollup table for the current iteration, and the parking lot. If a section on the Roadmap would not fit on a single screen, it belongs on a child page.

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

Wait for the user's answers before writing anything in Confluence.

### Step I4 — Write the Roadmap index page (short)

Create a child page under the project root folder:
- **Parent page:** `[Project Name]` (root folder)
- **Title:** `Roadmap — [Project Name]`

Keep it to the four index elements only — guiding principle, iterations index table, progress rollup, parking lot. **Do not put MVP goal / success criteria / epic-in-scope detail here** — that goes on the MVP page in Step I5.

```
# Roadmap — [Project Name]

Last updated: [date] | Author: [PM name or "AI-assisted"]
Related: [PRD] | [ADR] | [Retrospectives] | [Closeouts]

## Guiding principle
One sentence on the product strategy driving prioritisation.
e.g., "Ship the smallest working loop first; layer power features one iteration at a time."

---

## Iterations
| Document | Status | Sprints | Headline | Link |
|----------|--------|---------|----------|------|
| **MVP** | 🟡 Planned | S1–S[N] (~[N] weeks) | [one-line scope headline] | [MVP — [Project]] |
| Iteration 1 | Not started | TBD (after MVP retro) | [headline] | [Iteration 1 — [Project]] |

---

## MVP Progress
**0 of [N] sprints complete.** [one-line current status]

| Sprint | Epic | Velocity | Status | Period |
|--------|------|----------|--------|--------|
| S1 | [Epic] | — / — pts | Not started | TBD |

> Full per-sprint detail (goal, backlog, conclusions, retro + closeout links) lives in **[MVP — [Project]]**. This page is the iteration-level index only.

---

## Parking lot (post-roadmap ideas)
- [idea] — raised by [person] on [date]

---

## Next Step
→ Create the MVP scope page (next), then run skill 6 to create Epics in Jira.
```

### Step I5 — Write the MVP scope page (detail)

Create a child page **under the Roadmap page** (not the root):
- **Parent page:** `Roadmap — [Project Name]`
- **Title:** `MVP — [Project Name]`

This is where all the MVP detail lives:

```
# MVP — [Project Name]

Status: [ ] Draft  [ ] Approved   | Last updated: [date]
Related: [Roadmap] | [PRD] | [ADR]

## Goal
What hypothesis does the MVP validate? What user problem does it solve at minimum viable quality?

## Success criteria
| KPI | Target | How measured |
|-----|--------|--------------|

## Epics in scope
| Epic | Complexity | Owner | Status |
|------|------------|-------|--------|

## Epics deferred to Iteration 1
| Epic | Reason for deferral |
|------|---------------------|

## Open questions before MVP launch
- [Question that must be answered before shipping]

## Per-sprint plan
*One subsection per sprint, filled by skill 8 (refined backlog) and skill 9 (sprint composition) as the MVP progresses. Marked complete by skill 13 (retro).*
```

Add the row linking to this page in the Roadmap index Iterations table (Step I4) if not already present.

### Step I5b — Advise after init

```
✅ Done:
- Roadmap index page created under [Project Name] (short index)
- MVP scope page created under Roadmap: [N] Epics, target [date/sprint]
- [N] Epics deferred to Iteration 1, [N] ideas in parking lot

⚠️ Still needed (human action required):
- Get MVP scope approved by: [stakeholders named in interview]
- Resolve open questions: [list]

👉 Next step — Skill 6: agile_6_create_epics
   Once the MVP scope is approved, run skill 6 to create the Epics in Jira.
   Input needed: approved MVP scope page.
```

---

## ITERATION MODE

### Step IT1 — Scan existing state

Use Atlassian tools to:
- Find and read the existing Roadmap index page in Confluence
- Read the latest retrospective page (created by skill 13) if it exists
- Search Jira for Epics from the previous iteration — check their Done/In Progress status
- Read the PRD to recall the original business goals and KPIs

**If no retrospective page is found:**
- Warn but do not stop: "I couldn't find a retrospective for the previous iteration. I'll proceed, but the iteration plan will lack feedback data. Run skill 13 first if the retro hasn't been documented yet."

### Step IT2 — Extract iteration inputs

From the **retrospective** (skill 13 output):
- What went well → reinforce in next iteration
- What to improve → process or scope adjustments
- User feedback received → may reprioritise Epics
- Epics completed vs. not completed → unfinished work carries over

From the **current Roadmap index + previous iteration page**:
- Epics already earmarked for this iteration → starting point
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

### Step IT4 — Write the Iteration page (detail)

Create a child page **under the Roadmap page**:
- **Parent page:** `Roadmap — [Project Name]`
- **Title:** `Iteration [N] — [Project Name]`

```
# Iteration [N] — [Project Name]

Status: [ ] Draft  [ ] Approved   | Last updated: [date]
Related: [Roadmap] | [Retro [N-1]] | [PRD]

## Goal
What does this iteration deliver on top of the MVP (or previous iteration)? How does it move the KPIs forward?

## Feedback from previous iteration
- [learning 1]
- [learning 2]

## Success criteria
| KPI | Previous value | Target | How measured |
|-----|---------------|--------|--------------|

## Epics in scope
| Epic | Complexity | Owner | Status | Carried over? |
|------|------------|-------|--------|---------------|

## Epics deferred to Iteration [N+1]
| Epic | Reason |
|------|--------|

## Open questions before iteration launch
- [question]

## Per-sprint plan
*Filled by skills 8 + 9 as the iteration progresses.*
```

### Step IT5 — Update the Roadmap index (short)

Update the existing Roadmap index page — do not create a new one, and do not inline iteration detail.

1. In the **Iterations** table: set the just-ended iteration's row Status to `✅ Complete`, and add (or update) the row for Iteration [N] — Status `Planned`, sprints/headline, link to the new Iteration [N] page from Step IT4.
2. Replace the **Progress** rollup table with the new iteration's per-sprint rollup (or add a new `## Iteration [N] Progress` section and collapse the prior one to a one-line summary linking its page).
3. Leave the parking lot intact (only move promoted items out).

### Step IT5b — Advise after iteration update

```
✅ Done:
- Iteration [N] page created under Roadmap: [N] Epics, [N] carried over, [N] deferred
- Roadmap index updated: previous iteration marked complete, Iteration [N] row added

⚠️ Still needed (human action required):
- Approve the Iteration [N] scope page
- Resolve open questions: [list]

👉 Next step — Skill 6: agile_6_create_epics
   Run skill 6 to create or update the Epics in Jira for this iteration.
   Input needed: approved Iteration [N] scope page.
```

---

## Resume logic

If this skill is re-run:
- Re-read the Roadmap index and the relevant MVP / Iteration child page first — never assume previous state
- INIT: if the Roadmap index exists but the MVP page is missing, create only the MVP page; if both exist, fill gaps only
- ITERATION: if the Iteration [N] page already exists, fill its incomplete sections; never duplicate it
- Re-sync the Roadmap index Iterations table + progress rollup with the child pages' current state
- Report what changed vs. what was already correct

---

## Principles (apply to every run)

- **Roadmap is a short index, detail lives in child pages** — the Roadmap page holds only guiding principle + iterations index table + progress rollup + parking lot; goal, success criteria, epic lists, per-sprint plans, and retro write-ups go on the `MVP` / `Iteration N` child pages. Never inline them into the Roadmap.
- **MVP and Iteration pages are children of the Roadmap page** — not of the root.
- **Detect mode first** — INIT vs. ITERATION before doing anything
- **Ask before writing** — never assign Epics to scope without explicit confirmation; propose and wait
- **Scope is a tripartite decision** — the skill prepares the proposal, it does not make the final call
- **Group questions** — one message per interview round; never drip
- **Read before write** — read PRD, ADR, Roadmap index, and the relevant child page before touching Confluence
- **Roadmap is a living document** — never replace past iterations; mark them complete and keep their child pages
- **Flag risks proactively** — XL Epics, dependency chains, and capacity signals surfaced before scope is locked
- **Idempotent / Resumable** — re-running never duplicates pages; it fills gaps and re-syncs the index from the child pages
- **Transparent assumptions** — every inference stated explicitly, especially around timeline and capacity
- **Parking lot is permanent** — ideas are never deleted, only promoted to an iteration
```
