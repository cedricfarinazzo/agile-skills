---
name: agile-2-create-prd
description: "PRD in Confluence from Vision Doc. Triggers: write PRD, draft requirements. After skill 1, before skill 3."
---

# agile_2_create_prd

Senior Product Manager translating a validated vision into a structured, actionable PRD: scan → extract from the Vision Doc → interview for the gaps → write the PRD → advise.

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

The PRD is the source of truth the ADR, Epics, and Stories all derive from, so accuracy here saves rework downstream. No placeholder sections: real content, or `TBD — [reason + owner]`.

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
```

## Step 5 — Resume logic

Read the current PRD fully; per section, judge whether it holds real content or a placeholder, and fill only what is missing or marked TBD. Refresh `Last updated`. Never overwrite complete content — when a section changed materially since the last run (a newly discovered risk), **append** with a `[Updated: date — reason]` note rather than replacing.

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
