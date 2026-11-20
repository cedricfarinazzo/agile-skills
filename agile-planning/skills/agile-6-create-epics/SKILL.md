---
name: agile-6-create-epics
description: "Epics in Jira from Roadmap. Triggers: create epics, set up Jira for MVP. After skill 5, before skill 7."
---

# agile_6_create_epics

Product Manager + Tech Lead structuring work in Jira so it is ready for Story writing: scan → interview on anything ambiguous → create/update Epics linked to Confluence → advise.

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

Read the **Roadmap index** to find the current iteration, then open its `MVP — [Project]` / `Iteration N — [Project]` child page and read the **Epics in scope** table there — the index itself only links to it. Read **ADR §11** for complexity estimates and dependencies. Search Jira for Epics already created (by name, label, or Confluence link), and for each Epic in scope determine whether it exists and, if so, its current state.

Report before doing anything, then ask "Shall I proceed with this plan?":

```
Epic status for [Project Name]:
| Epic | In Jira? | Jira status | Action needed |
|------|----------|-------------|---------------|
| [Epic 1] | ✅ Yes | In Progress | No action — already active |
| [Epic 2] | ✅ Yes | To Do | Review description, may need update |
| [Epic 3] | ❌ No | — | Will create |
```

**No approved Roadmap → stop:** "I can't find an approved Roadmap for this project. Please complete skill 5 first."

## Step 2 — Interview for Epic-level clarity

Per Epic to create or update: a short action-oriented **name** devs will recognise ("User Authentication", "Dashboard MVP"); a one-sentence **goal** naming the user problem it solves; the **scope boundary**, in and out, which is what stops scope creep at Story-writing time; **Epic-level acceptance criteria** (high level — Stories carry the detail); **dependencies** on other Epics or external systems; the **owning team**; and **labels** for filtering.

**Ask** when a name from the ADR is too vague to be a Jira card ("Auth stuff"), when two Epics have a blurry boundary ("User Profile" vs "Account Settings" — "where does one end and the other begin?"), when ownership is unspecified, or when an Epic has an implicit dependency nobody listed. **Infer and flag** a goal derivable from a detailed ADR description, a dependency obvious from the ADR data model ("Notifications requires the User model from Auth"), or labels implied by the Roadmap section (an MVP Epic → label `mvp`).

**Only ask about the genuinely unclear Epics** — never re-ask for ones the ADR already defines well. All questions in one message, every assumption stated. **Never infer silently.**

## Step 3 — Create or update Epics in Jira

**Summary:** `[Epic name] — [Project Name]`. **Labels:** `[project-slug]`, `[iteration]`, `[layer]`. **Status:** `To Do`. **Assignee:** the owning team or person when known.

```
## Goal
[One sentence: the user problem completing this Epic solves]

## Scope
**In scope:** …
**Out of scope:** …

## Epic-level acceptance criteria
- [ ] [Criterion]

## Dependencies
- Depends on: … | Blocks: …

## References
Roadmap · PRD · ADR · Specs UI (Confluence links)
```

- **Create in dependency order** — never create Epic B before the Epic A it depends on.
- **An existing Epic with outdated content is updated, never duplicated.**
- **Never delete an Epic.** Out of scope → add a comment explaining why and transition to `Won't Do` / `Cancelled`, after user confirmation.
- Link each Epic back to the Confluence Roadmap via a remote link or a description reference.

## Step 4 — Update the MVP/Iteration page

Update the `## Epics in scope` table on the current `MVP` / `Iteration N` page — **not** the Roadmap index, since epic-level detail lives on the iteration page:

`| Epic | Jira | Why | Complexity | Owner | Sprint | Status |`

This keeps the two in sync: the child page is the human-readable view of what is in Jira, and the Roadmap index just links to it.

## Step 5 — Resume logic

Re-scan live Jira Epic statuses — never assume the previous state still holds. Create only what is still missing; update only Epics whose description has drifted from the Roadmap/ADR; re-sync the Epics-in-scope table with current links and statuses; report what changed versus what was already correct.

## Step 6 — Advise

```
✅ Done:
- [N] Epics created in Jira: [keys] · [N] already existed and were reviewed
- MVP/Iteration page Epics table updated with Jira links

⚠️ Still needed (human action required):
- Assign owners to: [Epics without assignees]
- Resolve scope boundary questions: [if any remain]
- Validate dependency order with the Tech Lead

👉 Next step — Skill 7: agile_7_create_stories — start with the Epic that has no blocking dependencies.
   Input: Jira Epic key + the Specs UI page for the relevant screens.
```

## Principles

- **Ask before writing** — clarify vague names, blurry scope boundaries, and ownership first; all questions in one message, every assumption stated.
- **Create in dependency order**, and never duplicate an existing Epic — update it.
- **Never delete an Epic** — `Won't Do` / `Cancelled`, with a comment and user confirmation.
- **Confluence and Jira stay in sync** — every Epic links back on the MVP/Iteration page.
