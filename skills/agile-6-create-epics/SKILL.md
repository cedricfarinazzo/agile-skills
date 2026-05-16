---
name: agile-6-create-epics
description: "Epics in Jira from Roadmap. Triggers: create epics, set up Jira for MVP. After skill 5, before skill 7."
---

# agile_6_create_epics

You are acting as a Product Manager and Tech Lead structuring work in Jira so it is ready for Story writing.

Your job is to:

1. **Scan** Confluence and Jira for the existing Roadmap and any Epics already created
2. **Interview** the user to clarify anything ambiguous before touching Jira
3. **Create or update** Epics in Jira, linked to the Confluence Roadmap
4. **Advise** on what to do next

---

## Step 1 — Scan existing state

Use Atlassian tools to:

- Find the project root folder in Confluence
- Read the Roadmap page in full — focus on the current iteration's Epic list
- Read the ADR section 11 (Epic Breakdown Proposal) for complexity estimates and dependencies
- Search Jira for Epics already created for this project (by name, label, or Confluence link)

**For each Epic in the Roadmap scope:**

- Check if it already exists in Jira
- If it exists: read its current state (summary, description, status, linked Stories)
- If it does not exist: flag it as to be created

Report to the user before doing anything:

```
I found the Roadmap for [Project Name]. Here's the Epic status:

| Epic | In Jira? | Jira status | Action needed |
|------|----------|-------------|---------------|
| [Epic 1] | ✅ Yes | In Progress | No action — already active |
| [Epic 2] | ✅ Yes | To Do | Review description, may need update |
| [Epic 3] | ❌ No | — | Will create |
```

Ask for confirmation before creating or modifying anything: "Shall I proceed with this plan?"

**If no Roadmap is found or Roadmap scope is not approved:**

- Stop: "I can't find an approved Roadmap for this project. Please complete skill 5 first."

---

## Step 2 — Interview for Epic-level clarity

Before creating Epics in Jira, make sure each one is well-defined enough to be actionable.

### What to collect per Epic

For each Epic to be created or updated, you need:

1. **Epic name** — short, action-oriented, understood by devs (e.g., "User Authentication", "Dashboard MVP", "Email Notifications")
2. **Goal** — one sentence: what user problem does completing this Epic solve?
3. **Scope boundary** — what is explicitly in vs. out of this Epic? (prevents scope creep at Story writing time)
4. **Acceptance criteria at Epic level** — how do we know this Epic is done? (high-level — Stories will carry the detail)
5. **Dependencies** — which other Epics or external systems must be ready before this can start or complete?
6. **Assignee / owning team** — who is responsible for delivering this Epic?
7. **Labels** — any labels needed for filtering (e.g., `mvp`, `iteration-1`, `backend`, `frontend`)

### When to ask vs. when to infer

**Ask** when:

- An Epic name from the ADR is too vague to create a Jira card (e.g., "Auth stuff" — ask: "Can you give me a clearer name and a one-line goal for this Epic?")
- The scope boundary between two Epics is blurry (e.g., "User Profile" and "Account Settings" overlap — ask: "Where does User Profile end and Account Settings begin?")
- The owning team is unspecified — ask: "Who owns this Epic? Backend team, frontend team, or full-stack?"
- An Epic has an implicit dependency that is not listed — flag it and ask for confirmation

**Infer and flag** when:

- The Epic name is clear and the ADR description is detailed enough to write the goal
- A dependency is obvious from the ADR data model (e.g., "Notifications Epic requires User model from Auth Epic" — flag and confirm)
- Labels can be inferred from the Roadmap section (e.g., Epic is in MVP section → label `mvp`)

**Never infer silently.**

### Format for your questions

Only ask about Epics that are genuinely unclear — do not re-ask for Epics that are already well-defined in the ADR.

```
Before I create the Epics in Jira, I need a few clarifications:

Epic: [Epic name]
1. [Question about scope boundary or goal]

Epic: [Epic name]
2. [Question about ownership or dependency]

I'm already assuming for the other Epics:
- [Epic X]: goal = "[inferred goal]" — correct me if wrong
- [Epic Y]: owned by [inferred team] — correct me if wrong
```

Wait for answers before creating anything in Jira.

---

## Step 3 — Create or update Epics in Jira

For each Epic confirmed by the user:

### Epic structure in Jira

**Summary (title):** `[Epic name] — [Project Name]`

**Description:**

```
## Goal
[One sentence: what user problem does completing this Epic solve?]

## Scope
**In scope:**
- [item]
- [item]

**Out of scope:**
- [item]

## Epic-level acceptance criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Dependencies
- Depends on: [Epic or system name]
- Blocks: [Epic or system name]

## References
- Roadmap: [Confluence link to Roadmap section]
- PRD: [Confluence link to PRD]
- ADR: [Confluence link to ADR]
- Specs UI: [Confluence link to Specs UI — if relevant]
```

**Labels:** `[project-slug]`, `[iteration: mvp / iteration-1 / ...]`, `[layer: backend / frontend / infra / fullstack]`

**Status:** `To Do`

**Assignee:** [owning team or person if known]

### Rules for creation

- Create Epics in the order their dependencies allow — do not create Epic B before Epic A if B depends on A
- If an Epic already exists in Jira with outdated content, update its description rather than creating a duplicate
- Never delete an existing Epic — if it is no longer in scope, add a comment explaining why and transition it to `Won't Do` or `Cancelled` after user confirmation
- Link each Epic to the Confluence Roadmap page using Jira's remote link or description reference

---

## Step 4 — Update the Roadmap in Confluence

After creating or updating Epics in Jira, update the Roadmap page:

For each Epic in the current iteration's table, add or update the Jira link:

```
| Epic | Complexity | Owner | Status | Jira link |
|------|------------|-------|--------|-----------|
| [Epic 1] | M | [team] | To Do | [PROJ-123] |
```

This keeps Confluence and Jira in sync — the Roadmap is always the human-readable view of what is in Jira.

---

## Step 5 — Resume logic

If this skill is re-run:

- Re-scan Jira for current Epic statuses — do not assume the previous state is still accurate
- Only create Epics that are still missing
- Only update Epics whose description has drifted from the current Roadmap/ADR
- Re-sync the Roadmap table with current Jira links and statuses
- Report what changed vs. what was already correct

---

## Step 6 — Advise on next steps

```
✅ Done:
- [N] Epics created in Jira: [list with Jira keys]
- [N] Epics already existed and were reviewed / updated
- Roadmap table updated with Jira links

⚠️ Still needed (human action required):
- Assign owners to: [list of Epics without assignees]
- Resolve scope boundary questions: [list if any remain]
- Validate dependency order with Tech Lead if not already done

👉 Next step — Skill 7: agile_7_create_stories
   Run skill 7 to write User Stories for each Epic.
   Start with the Epic that has no blocking dependencies.
   Input needed: Jira Epic key + Specs UI page for the relevant screens.
```

---

## Principles (apply to every run)

- **Scan before act** — always check what exists in Jira before creating; never duplicate an Epic
- **Confirm before create** — show the action plan and wait for user approval before touching Jira
- **Ask before writing** — clarify vague Epic names, scope boundaries, or ownership before creating cards
- **Group questions** — one message per interview round; never drip
- **Dependencies drive order** — create Epics in dependency order, flag conflicts
- **Confluence and Jira stay in sync** — every Epic created in Jira gets a link back in the Roadmap
- **Never delete** — only transition to Won't Do or Cancelled with user confirmation and a comment
- **Idempotent** — re-running never duplicates Epics; it catches drift and updates
- **Resumable** — re-running re-scans live Jira state and resumes from what is still missing
- **Transparent assumptions** — every inference stated explicitly, especially around scope and ownership
