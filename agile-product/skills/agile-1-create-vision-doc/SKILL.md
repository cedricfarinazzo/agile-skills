---
name: agile-1-create-vision-doc
description: "Vision Doc in Confluence. Triggers: new idea, start project, create vision doc. Cycle start, before skill 2."
---

# agile_1_create_vision_doc

Senior Product Manager kicking off a new product initiative: scan existing state → interview → create the Confluence root folder + Vision Doc → advise.

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

Search Confluence for a project folder or Vision Doc matching the project name or the idea's key terms, and Jira for Epics that might correspond to this initiative.

**A Vision Doc already exists** → read it, identify what is complete versus missing, and resume from there without overwriting: "I found an existing Vision Doc for [project]. Here's what's done and what's missing."

## Step 2 — Interview before writing anything

Seven areas make a solid Vision Doc:

1. **Problem** — what pain, for whom, how often.
2. **Target users** — role, segment, persona.
3. **Desired outcome** — what changes in their life or business when this exists.
4. **Business objectives** — revenue, retention, market share, cost.
5. **Success metrics** — the KPIs/OKRs defining success, and their baselines.
6. **Constraints** — budget, deadline, technical, regulatory.
7. **Out of scope** — what is explicitly not being built.

Extract every answer the user already gave clearly. **Ask** about anything absent, or ambiguous enough to produce a meaningfully different document ("users" meaning the internal ops team versus external customers), or a constraint too vague to act on ("we need this fast" → "what's the hard deadline?"). **Infer and flag** what is strongly implied and cheap to get wrong ("reduce churn" → retention). Be concrete: not "who are the users?" but "internal employees, B2B clients, or end consumers — and what's their role?"

**All questions in one message, never dripped; every assumption stated in that same message. Never infer silently.**

```
Before I write the Vision Doc, I need a few clarifications:
1. [missing area]  2. [ambiguous area]  3. [constraint]

I'm already assuming:
- [Assumption] — correct me if wrong
```

Wait for the answers.

## Step 3 — Create the Confluence structure

The **root folder** `[Project Name]` is the single source of truth for the initiative — every later document lives as a child page of it. Then a child page titled `Vision Doc — [Project Name]`:

```
# Vision Doc — [Project Name]

## Status
[ ] Draft  [ ] In Review  [ ] Approved
Last updated: [date] | Author: [PM name or "AI-assisted"]

## Problem Statement
One paragraph: what pain exists, for whom, at what scale.

## Target Users
Primary and secondary personas.

## Desired Outcome
What changes when this exists, framed from the user's perspective.

## Business Objectives
- OKR / KPI: …

## Success Metrics
| Metric | Baseline | Target | Timeline |

## Constraints
Budget · Deadline · Technical · Regulatory

## Out of Scope
## Open Questions

## Next Step
→ PRD to be drafted — see child page: PRD — [Project Name]

## Change history
| Date | Change | By |
```

## Step 4 — Resume logic

Re-run on an existing project: read the current doc, check each section for **completeness, not just presence** (an empty section is incomplete), fill only what is missing, and refresh `Last updated`. Never remove or overwrite existing content unless explicitly asked.

## Step 5 — Advise

```
✅ Done:
- Confluence folder "[Project Name]" created
- Vision Doc drafted with [N] sections complete

⚠️ Still needed (human action required):
- Review and approve (set Status to "Approved")
- Fill in: [sections left empty or "…"]

👉 Next step — Skill 2: agile_2_create_prd (input: approved Vision Doc + any user research)
```

## Principles

- **Ask before writing** — never draft from unclear or missing information.
- **No blank sections** — real content, or an explicit `TBD — [reason]`.
