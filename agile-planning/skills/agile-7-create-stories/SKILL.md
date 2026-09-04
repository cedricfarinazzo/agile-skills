---
name: agile-7-create-stories
description: "User Stories in Jira from Epic. Triggers: write stories, create user stories, break down epic. After skill 6, before skill 8."
---

# agile_7_create_stories

Senior Product Manager writing User Stories precise enough for AI dev agents to implement without ambiguity: scan → derive the Story list → interview for gaps → write in Jira → advise.

**These Stories feed AI dev agents.** Every ambiguity left in an AC becomes a wrong assumption in generated code, so precision here is what saves rework downstream.

## Step 1 — Scan existing state

Read the target **Epic** in Jira in full (summary, description, scope, ACs, Confluence links), follow those links to the **PRD** (functional requirements for this area) and **Specs UI** (screens and components for this Epic), and search Jira for Stories already linked to the Epic.

Report the Epic, its goal, and a table of existing Stories (`key | summary | status`) before doing anything.

- **Epic not in Jira → stop:** "I can't find that Epic in Jira. Please run skill 6 first."
- **No Specs UI link → warn, do not stop:** "The Epic has no Specs UI link. I'll derive Stories from the PRD functional requirements only, so they may lack screen-level detail. Run skill 3 (INTEGRATE) and re-run this skill to enrich them."

## Step 2 — Derive the Story list

Do the analytical work **before** asking anything.

**Map PRD requirements to Stories.** Each Story is a single deliverable unit of user value — not a technical task, not a bundle. One user action / one system behaviour is a Story candidate; requirements that can only ship together merge into one Story; requirements that demo independently split into separate ones; and anything that will not fit in one sprint gets split.

**Map Specs UI screens to Stories.** Each screen or significant state (empty, error, success) typically maps to or contributes to one Story. Cross-reference with the PRD grouping — one screen may cover several FRs, and one FR may span several screens.

Present the derived breakdown and wait for confirmation before writing anything:

```
| # | Story title (draft) | Covers FR | Covers screen(s) | Est. size |
|---|---------------------|-----------|------------------|-----------|
| 1 | [title] | FR-01, FR-02 | Login screen | S |
| 2 | [title] | FR-03 | Dashboard — empty state, default | M |
```

Then ask: does the breakdown look right, or should any Stories merge or split? Anything missing that the PRD and Specs UI don't cover? Anything here out of scope for this iteration?

## Step 3 — Interview for Story-level gaps

**Mandatory per Story:** a persona-first **title** ("As a [persona], I want [action] so that [benefit]") or a clear imperative for technical Stories; a **description** with context and why it matters; **falsifiable acceptance criteria** in Given/When/Then; **linked Specs UI screen(s)**; **out of scope for this Story**; and the **Definition of Done**. Optionally also: **technical notes** (known constraints, "must use the existing AuthService", "endpoint exists at POST /api/v1/session"), **edge cases** the ACs must cover, and **dependencies** on another Story or system.

**Ask** when an AC is not falsifiable ("the UI should look good" → "what specifically makes it pass — is there a design reference?"), when the persona is unclear ("user" is not a persona — which one from the PRD?), when a Story touches a system the ADR does not describe ("is this endpoint already built, or does it need creating?"), or when non-trivial edge cases (concurrent edits, pagination, file-size limits) are absent from the Specs UI. **Infer and flag** the persona in a single-persona Epic, a technical note derivable from the ADR ("ADR specifies JWT — assuming Stories here use the existing middleware"), or the project-wide DoD (flag once, apply to all).

**Group questions by Story** — never mix questions from different Stories into the same numbered item — and state every assumption in the same message. **Never infer silently.**

```
Story 2 — [title]:
1. The AC "user sees the dashboard" is not specific enough — which data, in what format?
2. Is there a loading state, or does data always load instantly?

Story 4 — [title]:
3. Which persona performs this — [Persona A] or [Persona B]?
4. What happens when the file exceeds the size limit — silent fail, error, or redirect?

Assuming across all Stories:
- DoD includes unit tests passing, no lint errors, PR approved by Tech Lead — correct me if yours differs
- All Stories in this Epic use the existing JWT middleware from the ADR
```

## Step 4 — Write Stories in Jira

Issue type **Story**, linked to the parent Epic. **Labels:** `[project-slug]`, `[epic-slug]`, `[layer]`. **Status:** `To Do`. **Story points:** left blank — skill 8 estimates them.

**Summary** — e.g. `As a manager, I want to export the dashboard as PDF so I can share it in reports`, or `Display empty state on Dashboard when user has no data`.

```
## Context
[1–2 sentences: who this is for, what they are trying to do, why it matters]

## Out of scope for this Story
- [explicit exclusion]

## Technical notes
- [known constraint, existing system, or ADR endpoint reference]

## References
Epic: [PROJ-XXX] · Specs UI screen: [direct Confluence anchor] · PRD: FR-XX

## Acceptance Criteria
- AC1: Given [X], when [Y], then [Z]
- AC2: Given [X], when [Y], then [Z]
- AC3: [edge case] — Given [X], when [Y], then [Z]

## Definition of Done
- [ ] All ACs pass
- [ ] Unit tests written and passing
- [ ] No lint or type errors
- [ ] PR opened and linked to this Story
- [ ] Tech Lead review approved
- [ ] Tested on [staging / local env]
- [ ] No regressions in related Stories
- [ ] UI Story: Specs-UI match **shown, not asserted** — an evidence artefact (a screenshot of the
      screen at each supported viewport) plus an automated a11y check that FAILS the build. See the
      project's QA doc for what counts; "matched" with no artefact is unfalsifiable.
```

Every AC must be **falsifiable** (a dev agent can write a test for it), **specific** (no "fast", "nice", "user-friendly"), and **scoped** (it does not bleed into another Story's territory).

## Step 5 — Resume logic

Re-read every existing Story on the Epic and check each for completeness — title, description, ACs, DoD, Specs UI link. Create only genuinely missing Stories; update only empty or placeholder sections. If the Specs UI changed since a Story was written, comment "Specs UI updated on [date] — AC may need revisiting" rather than editing silently. **Never overwrite ACs that have already been through refinement (skill 8).**

## Step 6 — Advise

```
✅ Done:
- [N] Stories created under Epic [PROJ-XXX] · [N] already existed and were reviewed
- All Stories linked to Specs UI screens and PRD requirements

⚠️ Still needed (human action required):
- Review Stories with TBD sections: [list]
- Confirm edge cases for: [Stories with possibly incomplete ACs]
- Stories without a Specs UI link: [list — needs design integrated first]

👉 Next step — Skill 8: agile_8_refinement — points, AC validation, final DoD.
   Start with the Stories that have no blocking dependencies.
```

## Principles

- **Analytical first, questions second** — derive the Story list from the PRD + Specs UI, then validate it; propose before creating anything in Jira.
- **One Story = one deliverable unit of value** — not a task, not a bundle; something demoable on its own.
- **An AC must be falsifiable** — a dev agent cannot implement "looks good".
- **A UI Story always carries a direct Specs UI link.**
