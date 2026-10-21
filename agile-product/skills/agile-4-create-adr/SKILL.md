---
name: agile-4-create-adr
description: "ADR + tech feasibility in Confluence. Triggers: write ADR, architecture decisions, assess tech. After skill 3, before skill 5."
---

# agile_4_create_adr

Tech Lead assessing feasibility and documenting architecture decisions: scan → extract from the PRD and Specs UI → interview for the technical decisions those cannot make → write the ADR → advise.

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

Find the project root; read the **PRD** in full and the **Specs UI** in full if it exists; check for an existing ADR; search Jira for Epics or technical tasks that may already encode decisions.

- **An ADR exists** → read it section by section, report what is complete / placeholder / outdated, resume from the incomplete parts, and record each update as a `## Change history` row rather than overwriting.
- **PRD missing or unapproved → stop:** "The PRD for this project is missing or not yet approved. Please complete skill 2 first."
- **No Specs UI → warn, do not stop:** "I couldn't find a Specs UI page. Proceeding with the PRD only, so the ADR may be incomplete on frontend architecture — run skill 3 (INTEGRATE) when the design is ready and re-run this skill."

## Step 2 — Extract from the PRD and Specs UI

From the **PRD**: functional requirements (drive API and data-model decisions) · non-functional requirements (drive infra and architecture) · dependencies (external systems, third-party APIs already identified) · technical risks already flagged. From the **Specs UI**: screen inventory (frontend scope) · component inventory (build-vs-reuse) · interactions and states (complexity signals) · accessibility requirements (implementation constraints).

List what you extracted so the user sees the starting point before any questions.

## Step 3 — Interview for the technical decisions

1. **Architecture style** — monolith, microservices, serverless, event-driven; any existing architecture to extend.
2. **Tech stack** — languages, frameworks, runtimes; imposed by existing systems or chosen here.
3. **Data model** — the key entities; a database to extend, or a new one.
4. **API design** — REST, GraphQL, gRPC; internal only or externally exposed.
5. **Authentication & authorisation** — an existing auth system to reuse or a new one; the role/permission model.
6. **Infrastructure & deployment** — cloud provider, container strategy, existing CI/CD.
7. **Observability** — logging, monitoring, alerting expectations.
8. **Key technical risks** — performance bottlenecks, scaling limits, third-party reliability.
9. **Build vs. buy** per major capability — in-house, SaaS, or open source.
10. **Epic breakdown proposal** — how the work splits into Epics, confirmed with the user.

**Ask** when no existing stack is mentioned (never assume the language or framework), when a PRD dependency has an unknown interface ("we'll use the auth service" → "what does it expose — REST? JWT? who owns it?"), when an NFR has no obvious default ("must handle 10k concurrent users" → "is there already a load balancer / CDN, or does that need setting up?"), or when a build-vs-buy call is genuinely ambiguous. **Infer and flag** an existing system named in the PRD as the integration target, a well-known pattern matching the NFRs ("stateless API + Redis for session caching — correct me if the team has a different standard"), or a framework convention implied by the Specs UI.

**All questions in one message, every assumption in the same message. Never infer silently.** Lead with what you already know:

```
I've read the PRD and Specs UI. Already known:
✅ Functional scope: [N] requirements across [areas]
✅ NFRs: [performance / availability / security targets]
✅ External dependencies · ✅ Frontend scope: [N] screens, [N] new components

Before I write the ADR:
1. [stack or architecture]  2. [dependency interface]  3. [build vs buy]  4. [infra / deployment]

I'm already assuming:
- [Assumption] — correct me if wrong
```

## Step 4 — Write the ADR

Child page of `[Project Name]`, titled `ADR — [Project Name]`:

```
# ADR — [Project Name]

## Status
[ ] Draft  [ ] In Review  [ ] Approved
Last updated: [date] | Author: [Tech Lead or "AI-assisted"] | Related: [PRD] | [Specs UI]

## 1. Context
One paragraph: what we are building, the constraints driving the technical decisions, and this ADR's decision scope.

## 2. Tech Stack
| Layer (Frontend/Backend/Database/Infra) | Technology | Version | Chosen or Imposed | Rationale |

## 3. Architecture Overview
Prose plus a simple diagram where possible: the architecture style, the key components and their responsibilities, and the data flow between them.

## 4. Data Model
Key entities with fields and relationships. New tables/collections required; existing ones extended.

## 5. API Design
Style · key endpoints or operations (`[METHOD] /path — purpose`) · authentication mechanism · versioning strategy.

## 6. Authentication & Authorisation
Auth system (existing service or new) · token type · the roles and permissions relevant to this feature.

## 7. Infrastructure & Deployment
Cloud provider · container strategy · CI/CD (existing pipeline or new) · environments.

## 8. Observability
Logging (tool + what to log) · monitoring (tool + key metrics) · alerting conditions · error tracking.

## 9. Build vs. Buy Decisions
| Capability | Build / Buy | Tool or Library | Rationale |

## 10. Technical Risks
| Risk | Likelihood | Impact | Mitigation |

## 11. Epic Breakdown Proposal
| Epic | Description | Key dependencies | Estimated complexity (S/M/L/XL) |

This breakdown is the direct input to skill 5 (Roadmap) for defining MVP scope — make it precise and actionable.

## 12. Open Questions
| Question | Owner | Due date | Status |

## Next Step
→ Roadmap and MVP scope — run skill 5: agile_5_roadmap

## Change history
| Date | Change | By |
```

## Step 5 — Resume logic

Read the current ADR fully; per section, judge real content versus placeholder and fill only what is missing or TBD. **Decisions have history** — never remove or overwrite one that is already documented; mark a replaced design superseded, and add a `## Change history` row. A decision taken after the first ADR gets a `D###` entry in the Decision Log, and the ADR section that states the resulting design cites that id. If the Specs UI changed since the ADR was written, re-read it and flag the sections that may need revisiting.

## Step 6 — Advise

```
✅ Done:
- ADR created/updated under [Project Name]
- Sections complete: [list] · [N] Epics proposed in section 11

⚠️ Still needed (human action required):
- Review and approve the ADR
- Resolve open questions: [from section 12]
- Validate the Epic breakdown (section 11) with the PM

👉 Next step — Skill 5: agile_5_roadmap (input: approved PRD + approved ADR)
```

## Principles

- **Ask before writing** — never assume a stack, architecture style, or infra setup.
- **Decisions have history** — append with date and reason, never silently overwrite.
- **No placeholder sections** — real content, or `TBD — [reason + owner]`.
