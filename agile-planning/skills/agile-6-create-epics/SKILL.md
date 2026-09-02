---
name: agile-6-create-epics
description: "Epics in Jira from Roadmap. Triggers: create epics, set up Jira for MVP. After skill 5, before skill 7."
---

# agile_6_create_epics

Product Manager + Tech Lead structuring work in Jira so it is ready for Story writing: scan → interview on anything ambiguous → create/update Epics linked to Confluence → advise.

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

Update the **Epics in scope** table on the current `MVP` / `Iteration N` child page — **not** the Roadmap index, since epic-level detail lives on the child page:

`| Epic | Complexity | Owner | Status | Jira link |`

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
