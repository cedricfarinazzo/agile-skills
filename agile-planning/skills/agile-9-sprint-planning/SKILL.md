---
name: agile-9-sprint-planning
description: "Launch sprint in Jira. Triggers: plan sprint, start sprint, sprint planning. After skill 8."
---

# agile_9_sprint_planning

Product Manager + Tech Lead assembling a sprint that is realistic, goal-driven, and unambiguous for AI dev agents: scan Jira → interview for capacity and goal → propose a composition → create/populate the sprint → advise.

## Confluence structure (canonical — identical across all agile-skills)

Every page is a child of the root folder created by `agile-1`. Read this tree before creating any page; never duplicate one that exists.

```
📁 [Project Name]                   (root — agile-1)
├── 📄 Vision Doc — [Project]       (agile-1)
├── 📄 PRD — [Project]              (agile-2)
├── 📄 Design Brief — [Project]     (agile-3 BRIEF)
├── 📄 Specs UI — [Project]         (agile-3 INTEGRATE)
├── 📄 ADR — [Project]              (agile-4)
├── 📄 Roadmap — [Project]          (agile-5 — SHORT INDEX only: guiding principle · iterations table · progress rollup · parking lot)
│   ├── 📄 MVP — [Project]          (agile-5; per-sprint detail by agile-9, refined backlog by agile-8)
│   ├── 📄 Iteration 1 — [Project]  (agile-5 ITERATION)
│   └── 📄 Iteration N — [Project]
├── 📁 Retrospectives — [Project]   (folder, agile-15; one Retro page per sprint)
└── 📁 Closeouts — [Project]        (folder, agile-13; sibling of Retrospectives, never inside it)
```

All deep detail — goals, success criteria, epic-in-scope lists, per-sprint backlogs, retro write-ups — lives on the `MVP` / `Iteration N` child pages, never on the Roadmap index.

## Step 1 — Scan existing state

Search Jira for an active or upcoming sprint. Read every Story labelled `refined` with status `To Do` (the eligible candidates) and every Story labelled `not-ready` (listed separately so the user knows what cannot enter). Per eligible Story: summary, points, Epic link, dependencies, labels.

Report the state before doing anything — an eligible table (`Story | Summary | Epic | Points | Dependencies`) with the total Stories/points, plus an excluded table with the reason each Story is `not-ready`. Then ask "Shall I proceed with sprint planning?".

- **No refined Stories → stop:** "There are no Stories ready for sprint planning. Please run skill 8 (Refinement) first."
- **An active sprint already has Stories** → read its composition and velocity, then ask whether to plan the next sprint or adjust the current one.

## Step 2 — Interview for sprint parameters

Collect in one message: **team velocity** (historical average, or an estimate range for a first sprint); **sprint duration**; **sprint goal** — one specific, testable sentence, not "make progress on auth" but "users can register, log in, and reset their password"; **capacity adjustments** (absences, holidays, part-time contributors); **priority constraints** (Stories that must be in regardless of points); **carry-over** from the previous sprint.

**Ask** when velocity is unknown (never guess capacity), when no sprint goal is stated (a sprint without one is a task list), or when the sprint starts near a holiday and no adjustment was mentioned. **Infer and flag** a sprint duration consistent with previous sprints, a dependency order clear from Jira, or a velocity derivable from the last sprint's completed points ("Based on last sprint's [N] points, I'm using [N] as the baseline — adjust if capacity changed"). **Never infer silently** — state each assumption in the same message as the questions:

```
Before I propose the sprint composition:
1. Team velocity: how many points can the team deliver this sprint? (a range is fine — I'll use the conservative end)
2. Sprint goal: the one thing the team commits to delivering by end of sprint?
3. Capacity: any absences or part-time contributors?
4. Must-have Stories: any that must be included regardless of points?

I'm already assuming — sprint duration 2 weeks · no carry-over. Correct me if either is wrong.
```

Wait for answers before proposing.

## Step 3 — Propose the composition

1. **Must-haves first** — include them regardless of points, flagging if they alone exceed capacity.
2. **Pull in their dependency chains** — a must-have's blocker comes with it.
3. **Fill the rest** by Epic priority (Roadmap order), then points ascending — smaller Stories first maximises deliverables when capacity is tight.
4. **Verify dependency closure** — no Story in the sprint may depend on one that is neither in the sprint nor already Done.
5. **Reserve a 10–15% buffer** for unplanned work and bug fixes.
6. **List what did not fit** as next-sprint candidates with their points.

Present it as the sprint header (number, dates, goal, and the capacity arithmetic `[velocity] × [weeks] − [absences] − [buffer]`), the backlog table (`# | Story | Summary | Epic | Points | Depends on`) with the total against capacity, the reserved buffer, and the did-not-fit table with a reason per row. Then ask whether to swap anything in or out, and **wait for confirmation before touching Jira**.

## Step 4 — Create or populate the sprint

**If no sprint exists**, create one: name `Sprint [N] — [Project Name]`, the confirmed start date, end = start + duration, and the goal as written.

> **No create-sprint tool? Use the manual fallback — do not stall.** Many Jira integrations (including the standard Atlassian MCP) expose only issue-level operations, with no create/start-sprint tool. Ask the operator to create and start the board's sprint manually with the name/dates/goal above. Then read the sprint id from **any one issue already moved into it** (the Sprint custom field returns `{id, name, state, boardId}`) and assign the remaining Stories by writing that id to each Story's Sprint field via `mcp__atlassian__editJiraIssue` — an integer id, not an array. Starting the sprint stays the operator's click; the agent only populates it.

**Move Stories in** in the proposed priority order, ranking blocking Stories first. **Do not change Story status** — they stay `To Do` until a dev agent picks them up.

**Update Confluence in three places.** Per the short-index rule, per-sprint detail never goes on the Roadmap index; the detail lives on the `MVP — [Project]` / `Iteration N — [Project]` child page (template in skill 5).

1. **Epic Sprint Plan row → the MVP/Iteration page** — set this sprint's row to the planned epic, milestone, committed points, and `🔄 In Progress`:
   `| S[N] — [start] → [end] | [Epic] | [PROJ-Epic] | [milestone] | — / [committed] pts | 🔄 In Progress | — |`
2. **`## Sprint [N]` detail section → the MVP/Iteration page** — create or fill it with the goal, period, capacity, any decisions locked, and the full backlog table (`# | Story | Summary | Pts | Layer | Depends on`). Leave `### Sprint conclusion` and the retro/closeout links empty; skill 15 fills them at sprint end.
3. **Progress rollup row → the Roadmap index** — one row, no story-level detail:
   `| S[N] | [Epic(s)] | — / [committed] pts | 🔄 In Progress | [start] → [end] |`

Never add an Epic/story breakdown table to the Roadmap index.

**Refresh the roadmap artifact.** Load the **`artifact-design`** skill first (required before writing the page), and `dataviz` before any chart code. Then read the Roadmap page's `📊 Live roadmap:` line — skill 5 owns the page's format and content rules:

- **URL present** → regenerate from the updated Confluence content and republish with the Artifact tool passing that `url:`, keeping the stable `🗺️` favicon, so it updates in place and the existing link keeps working.
- **No URL** (a Roadmap that predates the artifact, or an earlier skipped publish) → **publish new and write the returned URL back onto the Roadmap page in this same run.** Do not skip: an index that has been updated while its published view does not exist is exactly the lag this step prevents.
- **No Artifact tool available** → skip, and say so under `⚠️ Still needed`. Confluence is the source of truth either way.

## Step 5 — Resume logic

Re-scan live Jira sprint state first. If the sprint already holds Stories, show what is in it and the remaining capacity, and add only Stories not already there. If it is already started (Stories In Progress), warn: "This sprint is already active. I can add Stories to the backlog or adjust priorities, but I will not move or remove Stories already In Progress." Never remove a Story from an active sprint without explicit confirmation.

## Step 6 — Advise

```
✅ Done:
- Sprint [N] created / populated in Jira
- [N] Stories / [N] points / goal: "[sprint goal]"
- MVP/Iteration page updated with the sprint backlog; Roadmap index rollup updated
- Roadmap artifact: refreshed at [url] / published at [url] / skipped — [reason]

⚠️ Still needed (human action required):
- Start the sprint in Jira when the team is ready
- Share the sprint goal with the team
- Ensure dev agents can read Stories in "To Do"

Next-sprint candidates: [Story — points, …]

👉 Dev flow from here:
   1. Skill 10 (agile_10_implement) — builds every eligible Story to In Review with an open, self-reviewed PR
   2. Skill 11 (agile_11_merge_train) — reviews + merges those PRs to main, one at a time, each Story to Done
   3. Sprint close: agile-12-tech-debt-sweep → agile-13-sprint-closeout → skill 14 (QA, confirm-after-merge) → skill 15 (retro)
```

## Principles

- **Propose before acting**, and ask before writing: clarify velocity and goal first, never assume capacity, and state every assumption explicitly.
- **No unrefined Story enters a sprint** — the `refined` label is the gate; `not-ready` is never included.
- **Sprint goal first** — refuse to plan without one.
- **Capacity is a hard ceiling and the buffer is mandatory** — never plan to 100%.
- **Never remove an In Progress Story** — only the team pulls work mid-sprint.
