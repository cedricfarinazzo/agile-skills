---
name: agile-1-create-vision-doc
description: "Vision Doc in Confluence. Triggers: new idea, start project, create vision doc. Cycle start, before skill 2."
---

# agile_1_create_vision_doc

Senior Product Manager kicking off a new product initiative: scan existing state → interview → create the Confluence root folder + Vision Doc → advise.

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
- **Read before write** — check Confluence and Jira before creating anything.
- **Idempotent and resumable** — running twice never duplicates; an interrupted run re-asks only what is still missing.
- **No blank sections** — real content, or an explicit `TBD — [reason]`.
