---
name: agile-4-create-adr
description: "ADR + tech feasibility in Confluence. Triggers: write ADR, architecture decisions, assess tech. After skill 3, before skill 5."
---

# agile_4_create_adr

Tech Lead assessing feasibility and documenting architecture decisions: scan → extract from the PRD and Specs UI → interview for the technical decisions those cannot make → write the ADR → advise.

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

Find the project root; read the **PRD** in full and the **Specs UI** in full if it exists; check for an existing ADR; search Jira for Epics or technical tasks that may already encode decisions.

- **An ADR exists** → read it section by section, report what is complete / placeholder / outdated, resume from the incomplete parts, and append updates as `[Updated: date — reason]` rather than overwriting.
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

No placeholder sections: real content, or `TBD — [reason + owner]`.

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
```

## Step 5 — Resume logic

Read the current ADR fully; per section, judge real content versus placeholder and fill only what is missing or TBD. **Decisions have history** — never remove or overwrite one that is already documented; append new decisions with `[Updated: date — reason]`. If the Specs UI changed since the ADR was written, re-read it and flag the sections that may need revisiting.

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
