---
name: agile-9-sprint-planning
description: "Launch sprint in Jira. Triggers: plan sprint, start sprint, sprint planning. After skill 8."
---

# agile_9_sprint_planning

You are acting as a Product Manager and Tech Lead assembling a sprint that is realistic, goal-driven, and ready for AI dev agents to execute without ambiguity.

Your job is to:
1. **Scan** Jira for the refined backlog and any existing sprint in progress
2. **Interview** the user for capacity and sprint goal
3. **Propose** a sprint composition respecting capacity, dependencies, and goal
4. **Create or populate** the sprint in Jira with Stories in priority order
5. **Advise** on what to do next

---

## Confluence structure (canonical — identical across all agile-skills)

All project docs live under one root folder created by `agile-1`. The **Roadmap is a short index** — deep detail lives in its `MVP` / `Iteration N` child pages, never inlined into the Roadmap itself.

```
📁 [Project Name]                   (root — agile-1)
├── 📄 Vision Doc — [Project]       (agile-1)
├── 📄 PRD — [Project]              (agile-2)
├── 📄 Design Brief — [Project]     (agile-3 BRIEF)
├── 📄 Specs UI — [Project]         (agile-3 INTEGRATE)
├── 📄 ADR — [Project]              (agile-4)
├── 📄 Roadmap — [Project]          (agile-5 — SHORT INDEX: guiding principle + iterations index table + progress rollup + parking lot)
│   ├── 📄 MVP — [Project]          (agile-5; per-sprint detail by agile-9, refined backlog by agile-8)
│   ├── 📄 Iteration 1 — [Project]  (agile-5 ITERATION)
│   └── 📄 Iteration N — [Project]
├── 📁 Retrospectives — [Project]   (folder, agile-13; one Retro page per sprint)
└── 📁 Closeouts — [Project]        (folder, agile-13-sprint-closeout — sibling of Retrospectives, NOT inside it)
```

Read this tree before creating any page: every page is a child of the root (MVP / Iteration pages are children of Roadmap). Never duplicate a page that already exists; never nest Retrospectives/Closeouts inside each other.

---

## Step 1 — Scan existing state

Use Atlassian tools to:
- Search Jira for an active or upcoming sprint for this project
- Read all Stories labelled `refined` with status `To Do` — these are the eligible candidates
- Read all Stories labelled `not-ready` — list them separately so the user is aware of what cannot enter the sprint
- For each eligible Story, read: summary, story points, Epic link, dependencies, labels

**Report the current state before doing anything:**

```
Sprint planning for: [Project Name]

Active sprint: [Sprint name / "None found — will create"]

Eligible Stories (labelled "refined", To Do):
| Story | Summary | Epic | Points | Dependencies |
|-------|---------|------|--------|--------------|
| PROJ-124 | [summary] | [Epic] | 3 | none |
| PROJ-125 | [summary] | [Epic] | 5 | PROJ-124 |
| PROJ-127 | [summary] | [Epic] | 2 | none |
...
Total available: [N] Stories / [N] points

Excluded (not-ready):
| Story | Summary | Reason |
|-------|---------|--------|
| PROJ-126 | [summary] | Missing Specs UI link |
```

Ask: "Shall I proceed with sprint planning?"

**If no refined Stories are found:**
- Stop: "There are no Stories ready for sprint planning. Please run skill 8 (Refinement) first."

**If an active sprint already exists with Stories in it:**
- Read its current composition and velocity
- Ask: "There is already an active sprint [Sprint N] with [N] Stories and [N] points. Do you want to plan the next sprint, or adjust the current one?"

---

## Step 2 — Interview for sprint parameters

Before proposing a sprint composition, collect the inputs that determine what fits.

### What to collect

1. **Team velocity** — How many story points can the team deliver in one sprint? (use historical average if known, or ask for an estimate for the first sprint)
2. **Sprint duration** — How many weeks? (typically 1 or 2)
3. **Sprint goal** — One sentence: what is the team committed to delivering by the end of this sprint? Must be specific and testable — not "make progress on auth" but "users can register, log in, and reset their password"
4. **Capacity adjustments** — Any planned absences, holidays, or part-time contributors this sprint that reduce effective capacity?
5. **Priority constraints** — Are there Stories that must be in this sprint regardless of points? (hard dependencies, external deadlines, stakeholder commitments)
6. **Carry-over** — Are there unfinished Stories from the previous sprint that must be addressed first?

### When to ask vs. when to infer

**Ask** when:
- Team velocity is unknown — do not guess capacity; ask for a number or an estimate range
- The sprint goal is not stated — a sprint without a goal is a task list, not a sprint; ask explicitly
- Capacity adjustments are not mentioned but the sprint starts near a holiday — flag it and ask

**Infer and flag** when:
- Sprint duration is consistent with previous sprints → infer the same duration and flag: "I'm assuming a 2-week sprint — correct me if this sprint is different"
- A dependency chain is clear from Jira → infer that the blocking Story must come first and flag it
- The velocity is derivable from the previous sprint's completed points → flag: "Based on last sprint ([N] points completed), I'm using [N] as the velocity baseline — adjust if capacity changed"

**Never infer silently.**

### Format for your questions

```
Before I propose the sprint composition, I need a few inputs:

1. Team velocity: how many story points can the team deliver this sprint?
   (If unsure, give a range — I'll use the conservative end)
2. Sprint goal: what is the one thing the team commits to delivering by end of sprint?
3. Capacity this sprint: any absences or part-time contributors to account for?
4. Must-have Stories: any Stories that must be included regardless of points?

I'm already assuming:
- Sprint duration: 2 weeks — correct me if different
- Carry-over: none (no unfinished Stories from previous sprint) — correct me if wrong
```

Wait for answers before proposing the sprint.

---

## Step 3 — Propose sprint composition

After collecting inputs, build the sprint proposal.

### Algorithm for Story selection

1. **Start with must-haves** — Stories explicitly required by the user; include regardless of points (but flag if they exceed capacity alone)
2. **Add dependency chains** — if a must-have Story has a dependency, include the dependency first
3. **Fill remaining capacity** — sort remaining eligible Stories by: Epic priority (Roadmap order) → story points ascending (smaller Stories first to maximise deliverables if capacity is tight)
4. **Check dependency order** — within the sprint, verify no Story depends on another Story that is not also in the sprint or already Done
5. **Apply capacity buffer** — leave 10–15% of capacity unallocated for unplanned work and bug fixes
6. **Flag Stories that did not fit** — show them as "next sprint candidates" with their point values

### Present the proposal

```
Proposed Sprint [N] — [start date] to [end date]
Goal: "[sprint goal]"
Capacity: [N] points ([velocity] × [sprint weeks] − [absence adjustment] − [buffer])

Sprint backlog:
| # | Story | Summary | Epic | Points | Dependency on |
|---|-------|---------|------|--------|---------------|
| 1 | PROJ-124 | [summary] | [Epic] | 3 | none — start here |
| 2 | PROJ-127 | [summary] | [Epic] | 2 | none — parallel |
| 3 | PROJ-125 | [summary] | [Epic] | 5 | PROJ-124 |
| 4 | PROJ-128 | [summary] | [Epic] | 3 | none |
Total: 13 points / [N] capacity

Buffer: [N] points reserved for unplanned work

Stories that did not fit (next sprint candidates):
| Story | Summary | Points | Reason |
|-------|---------|--------|--------|
| PROJ-129 | [summary] | 8 | Exceeds remaining capacity |
```

Then ask: "Does this composition work, or would you like to swap any Stories in/out?"

Wait for confirmation before creating or modifying the sprint in Jira.

---

## Step 4 — Create or populate the sprint in Jira

After the user confirms the proposal:

### If no sprint exists yet
- Create a new sprint with:
  - **Name:** `Sprint [N] — [Project Name]`
  - **Start date:** [confirmed date]
  - **End date:** [start + sprint duration]
  - **Goal:** [sprint goal as written]

### Move Stories into the sprint
- Move each confirmed Story into the sprint in the proposed priority order
- Set the rank within the sprint to reflect dependency order (blocking Stories ranked first)
- Do not change Story status — they remain `To Do`; dev agents will transition them when they start

### Update Confluence — detail on the MVP/Iteration page, rollup only on the Roadmap index

Per the canonical structure (above), the Roadmap is a **short index** — per-sprint detail never goes on it. The detail lives on the `MVP — [Project]` / `Iteration N — [Project]` child page, which uses an `## Epic Sprint Plan` index table + one `## Sprint [N]` detail section per sprint (template defined in skill 5). Write to three places:

1. **Epic Sprint Plan row → the MVP/Iteration page.** Update this sprint's row in the index table to reflect the planned epic, milestone, committed points, and `🔄 In Progress` status:

```
| Sprint | Epic | Jira | Milestone | Velocity | Status | Retro |
|--------|------|------|-----------|----------|--------|-------|
| S[N] — [start] → [end] | [Epic] | [PROJ-Epic] | [milestone] | — / [committed] pts | 🔄 In Progress | — |
```

2. **`## Sprint [N]` detail section → the MVP/Iteration page.** Create (or fill) the section for this sprint with the goal, period/capacity, decisions locked, and the full backlog table:

```
## Sprint [N] — [Epic] — 🔄 In Progress
**Period:** [start] → [end] | **Velocity:** — / [committed] pts | **Stories:** [N]
**Goal:** _"[sprint goal]"_ — In progress

### Backlog
| # | Story | Summary | Pts | Layer | Depends on |
|---|-------|---------|-----|-------|------------|
| 1 | PROJ-124 | [summary] | 3 | backend | none |
```
(Leave the `### Sprint conclusion` + retro/closeout links empty — skill 15 fills them at sprint end.)

3. **Progress rollup row → the Roadmap index** (one row per sprint, no story-level detail):

```
| Sprint | Epic | Velocity | Status | Period |
|--------|------|----------|--------|--------|
| S[N] | [Epic(s)] | — / [committed] pts | 🔄 In Progress | [start] → [end] |
```

Do not add an Epic/story breakdown table to the Roadmap index — that detail belongs on the MVP/Iteration page only.

---

## Step 5 — Resume logic

If this skill is re-run:
- Re-scan Jira for the current sprint state and backlog
- If the sprint already has Stories, show what is already in it and what the remaining capacity is
- Only add Stories that are not yet in the sprint
- If the sprint is already started (has In Progress Stories), warn: "This sprint is already active. I can add Stories to the backlog or adjust priorities, but I will not move or remove Stories already In Progress."
- Never remove a Story from an active sprint without explicit user confirmation

---

## Step 6 — Advise on next steps

```
✅ Done:
- Sprint [N] created / populated in Jira
- [N] Stories in sprint / [N] points / [sprint goal]
- MVP/Iteration page updated with the sprint backlog; Roadmap index progress rollup updated

⚠️ Still needed (human action required):
- Start the sprint in Jira (click "Start Sprint") when the team is ready
- Share the sprint goal with the team
- Ensure dev agents have access to Jira and can read Stories in "To Do"

Stories not in this sprint (next sprint candidates):
| Story | Points |
|-------|--------|
| PROJ-129 | 8 |

👉 Dev flow from here:
   1. Skill 10: agile_10_implement — autonomously implements every eligible Story (validate → plan → code → PR → self-review via implement-review), moving each to In Review with an open PR
   2. Skill 11: agile_11_merge_train — reviews + merges the open PRs to main, one at a time, and transitions each Story to Done
   3. Sprint close: agile-12-tech-debt-sweep → agile-13-sprint-closeout → skill 14 (agile_14_qa_validation, confirm-after-merge) → skill 15 (agile_15_retro)
   Run skill 10 → 11, then the sprint-close chain once the sprint's Stories are merged.
```

---

## Principles (apply to every run)

- **No unrefined Story enters a sprint** — the `refined` label is the gate; `not-ready` Stories are never included
- **Sprint goal first** — a sprint without a goal is a task list; refuse to plan without one
- **Capacity is a hard ceiling, buffer is mandatory** — always reserve 10–15% for unplanned work; never plan to 100%
- **Dependencies drive order** — blocking Stories are always ranked before the Stories that depend on them
- **Propose before act** — always show the composition and wait for confirmation before touching Jira
- **Ask before writing** — clarify velocity and goal before proposing; never assume capacity
- **Never remove In Progress Stories** — only the team can decide to pull a Story mid-sprint
- **Confluence stays in sync, short-index respected** — per-sprint backlog detail goes on the `MVP`/`Iteration N` child page; the Roadmap index gets only the one-row progress rollup, never a story breakdown table
- **Idempotent** — re-running shows current state and fills only what is missing
- **Resumable** — re-running re-reads live Jira sprint state; picks up from remaining capacity
- **Transparent assumptions** — velocity, duration, and carry-over are always stated explicitly before the proposal
