---
name: agile-3-design-brief
description: "Design Brief in Confluence (BRIEF or INTEGRATE mode). Triggers: design brief, UI specs, integrate mockups. After skill 2, before skill 4."
---

# agile_3_design_brief

Senior Product Manager bridging product requirements and design execution. Two modes, detected from context:

- **BRIEF** ("write the brief", "brief Claude Design") — write the Design Brief from the PRD so Claude Design can work.
- **INTEGRATE** ("Claude Design is done", "here are the mockups") — document Claude Design's outputs as the Specs UI page.

Unclear → ask: "Are you starting the design brief, or bringing Claude Design's outputs back in?"

**The Brief and the Specs UI are separate pages and never merge** — the Brief is the input to Claude Design, the Specs UI is the output from it.

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

---

## BRIEF MODE

### Step B1 — Scan

Find the project root, read the **approved PRD** in full, check for an existing Design Brief. Brief exists → read it, report what is done versus missing, resume from the incomplete parts without overwriting. **PRD missing or unapproved → stop:** "The PRD for this project is missing or not yet approved. Please complete skill 2 first."

### Step B2 — Extract from the PRD

Personas (who Claude Design is designing for) · user journeys (the flows needing screens) · functional requirements (features needing a UI surface) · non-functional requirements (accessibility and performance constraints that shape design) · out of scope (what must **not** be designed). List what you extracted so the user sees what feeds the brief.

### Step B3 — Interview for the design-specific gaps

1. **Design goals** — what the UI should feel like ("trustworthy and simple", "fast and data-dense", "friendly for non-technical users").
2. **Brand & style constraints** — existing design system, palette, typography, tone of voice.
3. **Platform & device targets** — web only, mobile-first, desktop-first, native.
4. **Key screens in scope** for this iteration — derive from the journeys, then confirm.
5. **Interactions & states** that must be designed — empty, error, loading, success.
6. **Accessibility requirements** — WCAG level and any specific constraint.
7. **What NOT to design** — explicit exclusions, to stop scope creep in Claude Design.

**Ask** when no design system or brand guideline is mentioned (Claude Design needs it to stay consistent), when the platform target is ambiguous ("we want an app" → "iOS, Android, web, or all three?"), or when several journeys exist and the in-scope screens are unclear. **Infer and flag** WCAG 2.1 AA in the PRD → accessibility is required; a B2C product → mobile-first; a non-technical persona → "simple, low cognitive load" as a design goal.

**All questions in one message, every assumption in the same message. Never infer silently.** Lead with what you already have:

```
I've read the PRD. Feeding into the Brief:
✅ Personas · ✅ Key journeys to design · ✅ Features needing UI

Before I write the Design Brief:
1. [design style / tone]  2. [platform / device target]  3. [brand / design system]

I'm already assuming:
- [Assumption] — correct me if wrong
```

### Step B4 — Write the Design Brief

Child page of `[Project Name]`, titled `Design Brief — [Project Name]`:

```
# Design Brief — [Project Name]

## Status
[ ] Draft  [ ] Sent to Claude Design  [ ] Design complete
Last updated: [date] | Author: [PM name or "AI-assisted"] | Related: [PRD]

## 1. Context
One paragraph: the product, the problem, why we are designing this now.

## 2. Who We Are Designing For
Per persona: goals · pain points relevant to this UI · technical comfort level.

## 3. Design Goals
What the UI must achieve, not what it must look like — e.g. "reduce onboarding to under 3 minutes", "make error states unmissable without being alarming". Plus tone: e.g. "confident, clear, never condescending".

## 4. Platform & Device Targets
Primary · secondary · native app (yes / no / future).

## 5. Brand & Style Constraints
Design system · colour palette · typography · existing components to reuse (link, constraints, or "none — define from scratch").

## 6. Screens & Flows In Scope
Per journey: each screen with its name and purpose, plus the states to cover (loading / empty / error / success).

## 7. Accessibility Requirements
WCAG level + specific constraints (contrast, keyboard nav, screen reader).

## 8. Out of Scope for This Design Iteration

## 9. Open Questions for Claude Design

## Next Step
→ Send this brief to Claude Design; when design is complete, run skill 3 again in INTEGRATE mode.
```

### Step B5 — Advise

```
✅ Done:
- Design Brief created under [Project Name]
- [N] journeys and [N] screens defined for Claude Design

⚠️ Still needed (human action required):
- Review and approve the Brief, then send it to Claude Design
- [any sections left TBD]

👉 When Claude Design delivers: run skill 3 again (INTEGRATE mode), then skill 4 (agile_4_create_adr).
```

---

## INTEGRATE MODE

### Step I1 — Scan

Read the Design Brief; check for an existing Specs UI page. It exists → identify what is already documented and **add new screens/components without overwriting** existing ones.

### Step I2 — Collect Claude Design's outputs

```
To document the Specs UI, I need from Claude Design's output:
1. Links or descriptions of each screen designed (name + what it shows)
2. Any design decisions that differ from the brief — and why
3. Component inventory: new components created vs existing ones reused
4. Annotations: behaviour, interaction, or state that dev needs documented
5. Open questions Claude Design flagged for dev or PM
```

### Step I3 — Write the Specs UI page

Child page of `[Project Name]`, titled `Specs UI — [Project Name]`:

```
# Specs UI — [Project Name]

## Status
[ ] Draft  [ ] In Review  [ ] Approved
Last updated: [date] | Related: [Design Brief] | [PRD]

## Screen Inventory
| Screen | Journey | Description | Figma link | Status (Ready/WIP) |

## Screen Details
Per screen: **purpose** (what the user accomplishes) · **entry points** · **components used** · **states covered** (default / loading / empty / error / success) · **interactions** · **accessibility notes for dev** · **Figma link**.

## Design Decisions
Decisions that differ from or extend the PRD/Brief.
| Decision | Reason | Impact on dev |

## Component Inventory
| Component | New / Existing | Reusable | Notes for dev |

## Open Questions for Dev / PM
| Question | Raised by | Status |

## Next Step
→ Run skill 4: agile_4_create_adr
```

### Step I4 — Advise

```
✅ Done:
- Specs UI created/updated under [Project Name]
- [N] screens documented, [N] design decisions captured

⚠️ Still needed (human action required):
- Review and approve the Specs UI
- Resolve open questions: [list]

👉 Next step — Skill 4: agile_4_create_adr (input: approved PRD + approved Specs UI)
```

## Principles

- **Ask before writing** — never draft a section without the information it needs.
- **No placeholder sections** — real content, or `TBD — [reason + owner]`.
