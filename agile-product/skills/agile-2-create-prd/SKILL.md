---
name: agile-2-create-prd
description: "PRD in Confluence from Vision Doc. Triggers: write PRD, draft requirements. After skill 1, before skill 3."
---

# agile_2_create_prd

Senior Product Manager translating a validated vision into a structured, actionable PRD: scan → extract from the Vision Doc → interview for the gaps → write the PRD → advise.

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

**One fact, one home; every other page links to it.** Tickets, points and statuses → Jira. Verdicts and severity counts → the Closeout. Lessons → the Retro. Current architecture → the ADR. Decision text → the Decision Log; elsewhere only its ID and title. Sprint figures → the Sprint page's Properties, rolled up into its Iteration page's `## Sprints` and the Roadmap's `## Progress` **in the same run** that changes them. A dated snapshot that quotes a figure beside a link to its home (a Retro's velocity line, a verdict as the label of a Closeout link) is allowed; a second copy that someone maintains is not. Size budgets: Roadmap ≤ 6k characters, MVP / Iteration page ≤ 15k, Sprint page ≤ 25k.

**A drifted page is fixed, not extended.** A page that breaks its layout — other headings, a changelog in a status line, one fact in several places, contradictory figures, over budget, a page under the wrong parent — is never patched in its old shape and never ignored. Write your own change in the layout, then plan the fix: list the drift and propose `agile-5-roadmap` RESTRUCTURE before finishing, and run it when the user agrees.

## Step 1 — Scan existing state

Find the project root folder, read the **Vision Doc in full**, check for an existing PRD child page, and search Jira for Epics already linked to the project (they may anticipate PRD decisions).

- **A PRD exists** → read it section by section, report the status of each ("complete / placeholder / missing"), and resume from what is incomplete. Fill gaps and append; never overwrite.
- **No Vision Doc** → stop: "I can't find the Vision Doc for this project in Confluence. Please run skill 1 first, or point me to the right page."

## Step 2 — Extract what the Vision Doc already answers

Map it across before asking anything: problem statement → User Problem; target users → Personas; business objectives → Business Goals; success metrics → KPIs; constraints → Constraints; out of scope → Out of Scope. **Do not re-ask what the Vision Doc already states clearly.** Then identify what the PRD needs that it does not cover.

## Step 3 — Interview for the PRD-specific gaps

1. **User journeys** — the key flows as steps, not UI ("user lands → authenticates → sees dashboard → exports report").
2. **Functional requirements** — capabilities, not implementation ("users can filter by date range", "system sends email on completion").
3. **Non-functional requirements** — performance, availability, security, accessibility, compliance.
4. **Dependencies** — other teams, systems, APIs, third parties.
5. **Risks** — what could block or derail this.
6. **Open questions** — what is still undecided and could move scope or design.

**Ask** when a functional requirement is undefined enough that you cannot write even one bullet, when a "journey" is really just a label ("users manage their account"), when a dependency is hinted but unnamed ("we'll need the auth system" → "which one, and does it already exist?"), or when an obvious risk has gone unacknowledged. **Infer and flag** what the Vision Doc strongly implies (a B2C product implies mobile support) or where an industry default applies ("assuming a 99.9% uptime target — correct me if your SLA differs").

**All questions in one message; every assumption stated in the same message. Never infer silently.** Lead with what you already have so the user only spends effort on the gaps:

```
I've read the Vision Doc. Already have: ✅ user problem · ✅ personas · ✅ business goals

Before I write the PRD:
1. [missing user journey]  2. [undefined functional requirement]  3. [dependency or risk]

I'm already assuming:
- [Assumption] — correct me if wrong
```

## Step 4 — Write the PRD

Child page of `[Project Name]`, titled `PRD — [Project Name]`:

```
# PRD — [Project Name]

## Status
[ ] Draft  [ ] In Review  [ ] Approved
Last updated: [date] | Author: [PM name or "AI-assisted"] | Related: [Vision Doc]

## 1. User Problem
One focused paragraph — who suffers, what the pain is, why it matters now. Refined from the Vision Doc, not rewritten from scratch.

## 2. User Personas
Per persona: role · goals · pain points · context of use.

## 3. Business Goals
Each with a measurable target.

## 4. User Journeys
Per flow, numbered user-action / system-response steps. Intent level only — no UI or implementation detail.

## 5. Functional Requirements
Grouped by area (Authentication, Dashboard, Notifications…), numbered `FR-01`. "Shall" = mandatory, "should" = recommended.

## 6. Non-Functional Requirements
Performance (e.g. page load < 2s at p95) · Availability · Security · Accessibility (e.g. WCAG 2.1 AA) · Compliance.

## 7. Out of Scope

## 8. Dependencies
| Dependency | Type (Internal/External) | Team / System | Status |

## 9. Risks
| Risk | Likelihood | Impact | Mitigation |

## 10. KPIs & Success Metrics
| Metric | Baseline | Target | Timeline |

## 11. Open Questions
| Question | Owner | Due date | Status |

## Next Step
→ Once approved, run skill 3: agile_3_design_brief

## Change history
| Date | Change | By |
```

## Step 5 — Resume logic

Read the current PRD fully; per section, judge whether it holds real content or a placeholder, and fill only what is missing or marked TBD. Refresh `Last updated`. Never overwrite complete content — when a section changed materially since the last run (a newly discovered risk), update it and add a `## Change history` row saying what changed and why.

## Step 6 — Advise

```
✅ Done:
- PRD created/updated under [Project Name]
- Sections complete: [list]

⚠️ Still needed (human action required):
- Review and approve (set Status to "Approved")
- Sections needing your input: [TBD list]
- Open questions to resolve: [from section 11]

👉 Next step — Skill 3: agile_3_design_brief (input: approved PRD)
```

## Principles

- **Ask before writing** — never draft a section you have no real information for.
- **No placeholder sections** — real content, or `TBD — [reason + owner]`.
- **The PRD is the source of truth** — the ADR, Epics, and Stories all derive from it, so accuracy here saves rework everywhere downstream.
