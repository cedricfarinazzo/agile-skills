---
name: agile-3-design-brief
description: "Design Brief in Confluence (BRIEF or INTEGRATE mode). Triggers: design brief, UI specs, integrate mockups. After skill 2, before skill 4."
---

# agile_3_design_brief

You are acting as a senior Product Manager bridging product requirements and design execution.

This skill runs in **two modes**:
- **BRIEF mode** — write the Design Brief from the PRD so Claude Design can work
- **INTEGRATE mode** — take Claude Design's outputs and document them as a Specs UI page in Confluence

Detect the mode from context:
- If the user says "write the brief" or "brief Claude Design" → BRIEF mode
- If the user says "Claude Design is done", "here are the mockups", "integrate the design" → INTEGRATE mode
- If unclear → ask: "Are you starting the design brief, or bringing Claude Design's outputs back in?"

---

## BRIEF MODE

### Step B1 — Scan existing state

Use Atlassian tools to:
- Find the project root folder in Confluence
- Read the approved PRD in full
- Check if a Design Brief page already exists as a child of the root folder

**If a Design Brief already exists:**
- Read it section by section
- Identify what is complete vs. missing
- Tell the user: "I found an existing Design Brief for [project]. Here's what's done and what's missing. I'll resume from what's incomplete."
- Do not overwrite complete sections

**If no PRD is found or PRD is not approved:**
- Stop and tell the user: "The PRD for this project is missing or not yet approved. Please complete skill 2 first."
- Do not proceed

### Step B2 — Extract from the PRD

Read the PRD and extract what is directly usable for the design brief:
- User personas → who Claude Design is designing for
- User journeys → the flows to design screens for
- Functional requirements → features that need a UI surface
- Non-functional requirements → accessibility, performance constraints that affect design
- Out of scope → what Claude Design should not design

List what you extracted so the user can see what is feeding the brief.

### Step B3 — Interview for design-specific gaps

The Design Brief needs context the PRD may not fully cover.

#### What to collect

1. **Design goals** — What should the UI feel like? (e.g., "trustworthy and simple", "fast and data-dense", "friendly for non-technical users")
2. **Brand & style constraints** — Existing design system? Color palette? Typography? Tone of voice?
3. **Platform & device targets** — Web only? Mobile-first? Desktop-first? Native app?
4. **Key screens to design** — Which screens or components are in scope for this iteration? (derive from user journeys, confirm with user)
5. **Interactions & states** — Any specific states that must be designed: empty state, error state, loading, success?
6. **Accessibility requirements** — WCAG level? Any specific constraints?
7. **What NOT to design** — Explicit exclusions to avoid scope creep in Claude Design

#### When to ask vs. when to infer

**Ask** when:
- No design system or brand guidelines are mentioned — Claude Design needs this to be consistent
- The platform target is ambiguous ("we want an app" — ask: "iOS, Android, web app, or all three?")
- Multiple journeys exist and it's unclear which screens are in scope for this iteration

**Infer and flag** when:
- The PRD mentions WCAG 2.1 AA → infer that accessibility is required and flag it
- The product is B2C → infer mobile-first as default and flag it
- The PRD has a specific persona who is non-technical → infer "simple, low cognitive load" as a design goal and flag it

**Never infer silently.**

#### Format for your questions

```
I've read the PRD. Here's what I'm feeding into the Design Brief:
✅ Personas: [names from PRD]
✅ Key journeys to design: [list from PRD user journeys]
✅ Features needing UI: [list from functional requirements]

Before I write the Design Brief, I need a few clarifications:

1. [Question about design style/tone]
2. [Question about platform/device target]
3. [Question about brand/design system]

I'm already assuming:
- [Assumption A] — correct me if wrong
- [Assumption B] — correct me if wrong
```

Wait for the user's answers before writing the brief.

### Step B4 — Write the Design Brief in Confluence

Create a new child page under the project root folder:
- **Parent page:** `[Project Name]` (root folder)
- **Title:** `Design Brief — [Project Name]`

Use this exact structure:

```
# Design Brief — [Project Name]

## Status
[ ] Draft  [ ] Sent to Claude Design  [ ] Design complete
Last updated: [date]
Author: [PM name or "AI-assisted"]
Related: [link to PRD]

---

## 1. Context
One paragraph summarising the product, the problem it solves, and why we are designing this now.

---

## 2. Who We Are Designing For
For each persona (from PRD):
**[Persona name]**
- Goals: ...
- Pain points relevant to this UI: ...
- Technical comfort level: ...

---

## 3. Design Goals
What the UI must achieve — not what it must look like.
- Goal 1: [e.g., "Reduce time to complete onboarding to under 3 minutes"]
- Goal 2: [e.g., "Make error states unmissable without being alarming"]
- Tone: [e.g., "Confident, clear, never condescending"]

---

## 4. Platform & Device Targets
- Primary: [e.g., Web — desktop first]
- Secondary: [e.g., Mobile web — responsive]
- Native app: [Yes / No / Future]

---

## 5. Brand & Style Constraints
- Design system: [link or "none — define from scratch"]
- Color palette: [link or constraints]
- Typography: [link or constraints]
- Existing components to reuse: [list or "none"]

---

## 6. Screens & Flows In Scope
For each user journey from the PRD, list the screens to design:

**Journey: [name]**
- Screen 1: [name + purpose]
- Screen 2: [name + purpose]
- States to cover: [loading / empty / error / success]

---

## 7. Accessibility Requirements
- WCAG level: [e.g., 2.1 AA]
- Specific constraints: [e.g., colour contrast, keyboard nav, screen reader support]

---

## 8. Out of Scope for This Design Iteration
- [Screen or flow explicitly excluded]
- ...

---

## 9. Open Questions for Claude Design
- [Question Claude Design should answer or flag in their output]

---

## Next Step
→ Send this brief to Claude Design
→ When design is complete, run skill 3 again in INTEGRATE mode to document the Specs UI
```

### Step B5 — Advise after brief is written

```
✅ Done:
- Design Brief created under [Project Name] in Confluence
- [N] journeys and [N] screens defined for Claude Design

⚠️ Still needed (human action required):
- Review and approve the Design Brief
- Send the brief to Claude Design
- [Any sections left TBD]

👉 When Claude Design delivers:
   Run this skill again (skill 3 — INTEGRATE mode) to document the Specs UI in Confluence.
   Then run skill 4: agile_4_create_adr for the technical framing.
```

---

## INTEGRATE MODE

### Step I1 — Scan existing state

Use Atlassian tools to:
- Find the Design Brief in Confluence and read it
- Check if a Specs UI page already exists as a child of the root folder

**If a Specs UI page already exists:**
- Read it and identify what is already documented vs. missing
- Resume: add new screens/components without overwriting existing ones

### Step I2 — Interview for Claude Design outputs

Ask the user to provide or describe Claude Design's outputs:

```
To document the Specs UI, I need the following from Claude Design's output:

1. Links or descriptions of each screen designed (name + what it shows)
2. Any design decisions made that differ from the brief — and why
3. Component inventory: new components created vs. existing ones reused
4. Annotations: any behaviour, interaction, or state that needs to be documented for dev
5. Open questions Claude Design flagged for dev or PM

Please share what you have, and I'll structure it into the Specs UI page.
```

### Step I3 — Write the Specs UI page in Confluence

Create a new child page under the project root folder:
- **Parent page:** `[Project Name]` (root folder)
- **Title:** `Specs UI — [Project Name]`

Use this exact structure:

```
# Specs UI — [Project Name]

## Status
[ ] Draft  [ ] In Review  [ ] Approved
Last updated: [date]
Related: [link to Design Brief] | [link to PRD]

---

## Screen Inventory
| Screen | Journey | Description | Figma link | Status |
|--------|---------|-------------|------------|--------|
| [name] | [journey] | [what it does] | [link] | Ready / WIP |

---

## Screen Details
For each screen:

### [Screen name]
- **Purpose:** [what the user accomplishes here]
- **Entry points:** [how the user gets here]
- **Components used:** [list]
- **States covered:** [default / loading / empty / error / success]
- **Interactions:** [hover, click, drag behaviours]
- **Accessibility notes:** [specific implementation notes for dev]
- **Figma link:** [direct link to this screen]

---

## Design Decisions
Decisions made during design that differ from or extend the PRD/Brief:
| Decision | Reason | Impact on dev |
|----------|--------|---------------|

---

## Component Inventory
| Component | New / Existing | Reusable | Notes for dev |
|-----------|---------------|----------|---------------|

---

## Open Questions for Dev / PM
| Question | Raised by | Status |
|----------|-----------|--------|

---

## Next Step
→ ADR and technical framing — run skill 4: agile_4_create_adr
```

### Step I4 — Advise after integration

```
✅ Done:
- Specs UI page created/updated under [Project Name] in Confluence
- [N] screens documented
- [N] design decisions captured

⚠️ Still needed (human action required):
- Review and approve the Specs UI
- Resolve open questions: [list]

👉 Next step — Skill 4: agile_4_create_adr
   Run skill 4 to assess technical feasibility and document architecture decisions.
   Input needed: approved PRD + approved Specs UI.
```

---

## Principles (apply to every run)

See ../GUIDELINES.md for shared principles and authoring rules.
