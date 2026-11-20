---
name: agile-9-sprint-planning
description: "Launch sprint in Jira. Triggers: plan sprint, start sprint, sprint planning. After skill 8."
---

# agile_9_sprint_planning

Product Manager + Tech Lead assembling a sprint that is realistic, goal-driven, and unambiguous for AI dev agents: scan Jira → interview for capacity and goal → propose a composition → create/populate the sprint → advise.

## Source of truth

Confluence and Jira (or the tracker and wiki the project uses instead) are the source of truth for everything these skills manage: Vision, PRD, Design Brief, Specs, ADR, decisions, Roadmap, iterations, sprints, tickets, closeouts, retros and their actions, the Debt Register. Read what the run needs from there, never from a local copy, and write each change back there in the run that makes it. Never record a decision, status or action only locally.

Machine-local notes (auto-memory, scratch files, the plan in context) are a cache, since the next session may run elsewhere. Keep them, including notes from earlier runs, and sync any you come across that cover a managed fact: a match stays; a disagreement is corrected to the page or ticket, and is never a decision to escalate (follow the page, report the claim); a fact missing from Confluence and Jira is written to its home and the note kept. Interactive skills confirm that write with the user first. The autonomous path writes only what it can verify (a status, a link, a finding) and reports the rest as unrecorded, never guessing a decision into the Decision Log; a phase without write access reports it in its receipt.

Committed `CLAUDE.md`/`AGENTS.md` files are shared, not a cache: a managed fact there is a second copy that goes stale. Replace it with a link to its page or ticket, writing it there first if it is missing.

## Confluence structure (canonical — identical across all agile-skills)

Every page is a child of the root folder created by `agile-1`. Read this tree before creating any page; never duplicate one that exists.

```
📁 [Project Name]                         (root — agile-1)
├── 📄 Vision Doc — [Project]             (agile-1)
├── 📄 PRD — [Project]                    (agile-2)
├── 📄 Design Brief — [Project]           (agile-3 BRIEF)
├── 📄 Specs UI — [Project]               (agile-3 INTEGRATE)
├── 📄 ADR — [Project]                    (agile-4; current architecture state)
├── 📄 Decision Log — [Project]           (agile-5; register, one row per decision)
│   └── 📄 Decisions D001–D099 — [Project] (full entries by ID range: D100–D199, …)
├── 📄 Working Agreements — [Project]     (agile-5 creates · agile-15 writes; rules in force: process, planning, operator, ops)
├── 📄 Roadmap — [Project]                (agile-5 — INDEX only)
│   ├── 📄 Parking Lot — [Project]        (agile-5; unscheduled and rejected ideas)
│   ├── 📄 MVP — [Project]                (agile-5; an iteration page)
│   │   └── 📄 Sprint 1 — [Project]       (agile-9 plans · agile-8 backlog · agile-15 closes)
│   └── 📄 Iteration N — [Project]        (agile-5 ITERATION)
│       └── 📄 Sprint N — [Project]
├── 📁 Retrospectives — [Project]         (container: page or Confluence folder, agile-15; one Retro page per sprint)
├── 📁 Closeouts — [Project]              (container: page or Confluence folder, agile-13; sibling of Retrospectives, never inside it)
└── 📁 Extras — [Project]                 (folder; Debt Register (agile-15) + every page this tree does not name)
```

**Page placement.** Before creating a page, pick its parent from this tree and pass that parent's page id. Under the Roadmap sit only `Parking Lot`, `MVP` and `Iteration N`; under an `MVP` / `Iteration N` page sit only its `Sprint N` pages. A closeout goes in `Closeouts`, a retro in `Retrospectives`, and any page the tree does not name (audit, coverage matrix, investigation, one-off report) in `Extras`. Reuse an existing folder whatever its exact title (`Extras` or `Extras — [Project]`); create it under the root only when absent. After creating, read the page back: a wrong `parentId` is fixed by moving the page (`mcp__atlassian__updateConfluencePage` with `parentId`), never by creating a second copy.

**Page layouts.** Every page keeps the `##` headings below, in this order, and no others. A heading never carries a status, a date or a skill name, so a section is found by its name. Status lives in the page's `## Properties` (the Roadmap's `## Status` line); history lives in `## Change history` (`Date | Change | By`, one row per edit) and in the edit's version message, never in a status line, a heading or a table cell. Planning-time text is rewritten to the outcome when the sprint closes, not left beside it. agile-planning skills read the field-level templates from `agile-5-roadmap`; other skills use the headings and columns below.

| Page | `##` headings, in order (table columns in brackets) |
|---|---|
| Roadmap | Status · Guiding principle · Iterations · Progress · Parking lot · Next step · Change history |
| MVP / Iteration N | Properties · Goal · Success criteria · Epics in scope · Sprints · Scope changes · Dependencies and risks · Feedback carried in · Research record · Closing summary · Change history |
| Sprint N | Properties · Goal · Scope · Decisions · Backlog · Build order · Success criteria · Risks · Conclusion · Notes · Change history |
| Decision Log | Register (ID · Alias · Date · By · Title · Status · Scope · Supersedes / Amends · ADR § · Entry) · Change history |
| Decisions D###–D### | one `## D### — <title>` per decision: Decision · Why · Alternatives rejected · Consequences · Supersedes / Amends · Source |
| Parking Lot | Ideas (Idea · Raised · Why parked · Earmark · Link) · Rejected (Idea · Date · By · Why) · Change history |
| Working Agreements | Rules in force (Rule · Kind · Since · Source · Applies to) · Retired (Rule · Retired · Why) · Change history |
| Debt Register | Open (Item · Source · Jira · Size · Target) · Closed (Item · Closed · How) · Change history |
| Retrospectives / Closeouts | Index (one row per report) when the container is a page; a Confluence folder has no body and lists its children itself |
| Vision Doc · PRD · Design Brief · Specs UI · ADR | the template in the owning skill, ending with Change history |
| Retro · Closeout | the template in the owning skill (written once) |

**One fact, one home; every other page links to it.** Tickets, points and statuses → Jira. Verdicts and severity counts → the Closeout. Lessons → the Retro. Current architecture → the ADR. Decision text → the Decision Log; elsewhere only its ID and title. Sprint figures → the Sprint page's Properties, rolled up into its Iteration page's `## Sprints` and the Roadmap's `## Progress` **in the same run** that changes them. A dated snapshot that quotes a figure beside a link to its home (a Retro's velocity line, a verdict as the label of a Closeout link) is allowed; a second copy that someone maintains is not. Size budgets, counted on the rendered text (markup excluded): Roadmap ≤ 10k characters, MVP / Iteration page ≤ 30k, Sprint page ≤ 50k.

**A drifted page is fixed, not extended.** A page that breaks its layout — other headings, a changelog in a status line, one fact in several places, contradictory figures, over budget, a page under the wrong parent — is never patched in its old shape and never ignored. Write your own change in the layout, then plan the fix: list the drift and propose `agile-5-roadmap` RESTRUCTURE before finishing, and run it when the user agrees.

## Step 1 — Scan existing state

Search Jira for an active or upcoming sprint. Read every Story labelled `refined` with status `To Do` (the eligible candidates) and every Story labelled `not-ready` (listed separately so the user knows what cannot enter). Per eligible Story: summary, points, Epic link, dependencies, labels.

Report the state before doing anything — an eligible table (`Story | Summary | Epic | Points | Dependencies`) with the total Stories/points, plus an excluded table with the reason each Story is `not-ready`. Then ask "Shall I proceed with sprint planning?".

- **No refined Stories → stop:** "There are no Stories ready for sprint planning. Please run skill 8 (Refinement) first."
- **An active sprint already has Stories** → read its composition and velocity, then ask whether to plan the next sprint or adjust the current one.

## Step 2 — Interview for sprint parameters

Collect in one message: **team velocity** (historical average, or an estimate range for a first sprint); **sprint duration**; **sprint goal** — one specific, testable sentence, not "make progress on auth" but "users can register, log in, and reset their password"; **capacity adjustments** (absences, holidays, part-time contributors); **priority constraints** (Stories that must be in regardless of points); **carry-over** from the previous sprint.

Read the `Working Agreements` page's planning rules (capacity bands, sprint shape, rules in force) before proposing, and apply them; cite each one you apply.

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

**Update Confluence in three places**, from the templates in `${CLAUDE_PLUGIN_ROOT}/skills/agile-5-roadmap/references/page-templates.md`:

1. **The Sprint page** — create `Sprint [N] — [Project]` as a child of the current `MVP` / `Iteration N` page (or fill the one that exists): Properties (Status follows the Jira sprint: `Planned` until it is started, `In progress` once active; a later run of skill 9, 15 or 5 that sees it lag corrects it from Jira; planned period, Jira sprint id, epics, committed points and ticket count), Goal as written in Jira, Scope, Decisions (ids from the Decision Log), the Backlog table in rank order with `Outcome` empty (on a page that already exists, keep its rows and re-rank them; add the missing ones), Build order, Success criteria and Risks. Leave `## Conclusion` empty; skill 15 writes it.
2. **The Iteration page** — its `## Sprints` row (theme, period, committed points, status as above); the `Sprint` cell of each epic it serves in `## Epics in scope`; on its first sprint, Properties Status `In progress`.
3. **The Roadmap's `## Progress` row and `## Status` line** — one row, no story-level detail; the status line names this sprint as current; on the iteration's first sprint its `## Iterations` row goes `In progress`.

Working Agreements rules are cited in the proposal, never copied onto the Sprint page. Add one `## Change history` row on each page written.

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
- Sprint [N] page created under the Iteration page; its `## Sprints` row and the Roadmap `## Progress` row updated
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
