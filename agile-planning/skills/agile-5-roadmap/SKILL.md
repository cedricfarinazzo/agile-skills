---
name: agile-5-roadmap
description: "Roadmap index + MVP/Iteration scope in Confluence, plus a published Claude Code Artifact view. Roadmap stays a short index; detail lives in MVP/Iteration child pages. Optional sprint deep-dive: per-sprint explainer artifact + ADR-decision interview, closed by an ADR/PRD sync. Triggers: create roadmap, define MVP, plan iteration. After skill 4 or retro (skill 15), before skill 6."
---

# agile_5_roadmap

Product Manager + Tech Lead defining what gets built, in what order, and why.

Two modes, detected from context:
- **INIT** — no Roadmap page exists → create the Roadmap index + the MVP scope page (after the ADR).
- **ITERATION** — "plan the next iteration", "we finished the MVP", "add iteration N" → add an Iteration page and update the index.

A Roadmap exists and the user says "create the roadmap" → confirm: "I found an existing Roadmap. Add a new iteration, or revisit the MVP scope?"

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

**The short-index rule is this skill's core invariant.** All deep detail — goal text, success-criteria tables, epic-in-scope lists, per-sprint backlogs, retro write-ups — lives on the `MVP` / `Iteration N` child pages. The Roadmap carries only the guiding principle, the iterations index table, the current progress rollup, and the parking lot. If a section would not fit on one screen, it belongs on a child page.

---

## INIT MODE

### Step I1 — Scan existing state

Find the project root folder; read the **PRD** in full and the **ADR** in full (especially **§11 Epic Breakdown Proposal**); check whether a Roadmap page already exists (→ ITERATION mode); search Jira for Epics already created.

**PRD or ADR missing / not approved → stop:** "The PRD and ADR must both be approved before defining the MVP scope. Please complete skills 2 and 4 first."

### Step I2 — Extract from PRD and ADR

From the PRD: business goals and KPIs (what success looks like), constraints (deadline, budget — the hard limits), and the out-of-scope list (already excluded from every iteration). From ADR §11: the Epic list with complexity estimates (raw material for scope), the dependencies between Epics (sequencing), and technical risks (what must be de-risked early).

List what you extracted before asking anything.

### Step I3 — Interview for MVP scope

MVP scope is a **tripartite decision** — PM proposes, stakeholders validate business value, Tech Lead validates feasibility. This skill prepares the proposal; it does not make the call.

Collect in **one** message: must-have Epics (the minimum that validates the core hypothesis); nice-to-have; clearly post-MVP; MVP success criteria (which PRD KPIs apply); deadline or target sprint count; iteration cadence; and who signs off before Epics go into Jira.

**Ask** when the ADR's Epic list has no complexity estimates (you cannot propose scope without them), when a dependency between two Epics is unclear, when the deadline is absent from the PRD constraints, or when the approval process is undefined. **Infer and flag** an XL Epic sitting in must-have ("this may risk the deadline — split or defer part of it?"), a dependency chain implied by the ADR data model, or a sprint count derived from a hard deadline. **Never infer silently.**

Lead with the inventory so the decisions are cheap to make:

```
I've read the PRD and ADR. Epic inventory from the ADR:

| Epic | Complexity | Key dependency |
|------|------------|----------------|

Constraints from PRD — Deadline: [date/TBD] · Budget: [amount/TBD]

Before I draft the Roadmap:
1. Which Epics are must-have for the MVP?
2. Which are nice-to-have (include if time allows)?
3. Which are clearly post-MVP?
4. [dependency / deadline question]

Already flagging: [Epic X] is XL — may be too large for the timeline. [Epic Y] depends on [Epic Z].
```

Wait for answers before writing anything to Confluence.

### Step I4 — Write the Roadmap index page (short)

Child of `[Project Name]` (root), titled `Roadmap — [Project Name]`. Four elements only — **no MVP goal, success criteria, or epic-in-scope detail here**; that is Step I5.

```
# Roadmap — [Project Name]

Last updated: [date] | Author: [PM name or "AI-assisted"]
📊 Live roadmap: [artifact URL — added by Step I6]
Related: [PRD] | [ADR] | [Retrospectives] | [Closeouts]

## Guiding principle
One sentence on the strategy driving prioritisation.
e.g. "Ship the smallest working loop first; layer power features one iteration at a time."

## Iterations
| Document | Status | Sprints | Headline | Link |
|----------|--------|---------|----------|------|
| **MVP** | 🟡 Planned | S1–S[N] (~[N] weeks) | [scope headline] | [MVP — [Project]] |
| Iteration 1 | Not started | TBD (after MVP retro) | [headline] | [Iteration 1 — [Project]] |

## MVP Progress
**0 of [N] sprints complete.** [one-line status]

| Sprint | Epic | Velocity | Status | Period |
|--------|------|----------|--------|--------|
| S1 | [Epic] | — / — pts | Not started | TBD |

> Full per-sprint detail (goal, backlog, conclusions, retro + closeout links) lives in **[MVP — [Project]]**.

## Parking lot (post-roadmap ideas)
- [idea] — raised by [person] on [date]

## Next Step
→ Create the MVP scope page, then run skill 6 to create Epics in Jira.
```

### Step I5 — Write the MVP scope page (detail)

Child of **the Roadmap page** (not the root), titled `MVP — [Project Name]`. This is where the detail lives; the same shape serves an Iteration page (Step IT4).

```
# MVP — [Project Name]

## Status
**[Not started / In Progress / Complete]** | Last updated: [date] ([one-line status])
Related: [Roadmap] | [PRD] | [ADR] | [Retrospectives] | [Closeouts]
**Goal:** [one line]

## Epic Sprint Plan
One row per sprint. Filled in by skill 9 as each sprint is planned; Status + Retro updated by skill 15.

| Sprint | Epic | Jira | Milestone | Velocity | Status | Retro |
|--------|------|------|-----------|----------|--------|-------|
| S1 — [dates] | [Epic] | [PROJ-1] | [milestone] | — / — pts | Not started | — |

> Scope-decision / backfill notes go here as blockquotes when they affect the plan.

## Sprint [N] — [Epic] — [status]
*One section per sprint. Skeleton by skill 9; backlog refined by skill 8; conclusion + retro/closeout links + status flip by skill 15.*

**Period:** [start] → [end] | **Velocity:** [delivered]/[committed] pts | **Stories:** [N]
**Goal:** _"[sprint goal]"_ — [Achieved / Partially / In progress]

### Decisions locked   (optional — only when the sprint locks design choices)
| Area | Choice |

### Backlog
| # | Story | Summary | Pts | Layer | Depends on |

### Scope   (in-progress sprints — in/out of scope from the epic)
### Success criteria   (epic ACs for the sprint)
| # | Criterion | Target |

### Sprint conclusion
[written at retro time — what shipped, what slipped, key lessons]
Retrospective: [link] | Closeout: [link]

## Dev Flow
Per Story: implement → self-review → PR → merge → QA → Done.
Skills: agile-10-implement → agile-11-merge-train → agile-14-qa-validation (Mode B).
Sprint lifecycle: agile-12-tech-debt-sweep → agile-13-sprint-closeout → agile-14-qa-validation → agile-15-retro → agile-5-roadmap (ITERATION).
```

On first creation populate only the Status block (with the one-line MVP goal), the Epic Sprint Plan index (one `Not started` row per planned sprint), and the Dev Flow footer. Per-sprint detail sections arrive with skill 9, not upfront. Add this page's row to the Roadmap Iterations table if missing.

### Step I6 — Publish the roadmap Artifact

See **Roadmap Artifact** below, then advise:

```
✅ Done:
- Roadmap index page created under [Project Name] (short index)
- MVP scope page created under Roadmap: [N] Epics, target [date/sprint]
- Roadmap artifact published: [url]
- [N] Epics deferred to Iteration 1, [N] ideas in parking lot

⚠️ Still needed (human action required):
- Get MVP scope approved by: [stakeholders named in interview]
- Resolve open questions: [list]

👉 Next step — Skill 6: agile_6_create_epics (input: approved MVP scope page)
```

---

## ITERATION MODE

### Step IT1 — Scan existing state

Read the existing Roadmap index; read the latest retrospective (skill 15) if present; check the previous iteration's Epic statuses in Jira; re-read the PRD for the original goals and KPIs.

**No retrospective found → warn, do not stop:** "I couldn't find a retrospective for the previous iteration. Proceeding, but the iteration plan will lack feedback data — run skill 15 first if the retro isn't documented yet."

### Step IT2 — Extract iteration inputs

From the **retrospective**: what went well (reinforce), what to improve (process/scope adjustments), user feedback (may reprioritise), and completed-vs-not Epics (unfinished work carries over). From the **Roadmap index + previous iteration page**: Epics already earmarked, and parking-lot candidates. From **Jira**: previous-iteration Epic statuses and any Epics created since the last update.

### Step IT3 — Interview for iteration scope

```
I've read the retrospective and current Roadmap.

Carried over: [Epic X] — not completed, [reason]
Available for Iteration [N]: [earmarked Epics] · [parking lot candidates]
User feedback themes from retro: [theme], [theme]

Before I update the Roadmap:
1. Prioritise carried-over Epics first, or can new Epics run in parallel?
2. Which parking-lot items are ready to pull in?
3. Has the success criteria changed based on MVP results?
4. [scope / capacity question]

Already flagging: [Epic too large given retro velocity] · [dependency blocking a proposed Epic]
```

### Step IT4 — Write the Iteration page (detail)

Child of the Roadmap page, titled `Iteration [N] — [Project Name]`. **Same structure as the MVP page** (Step I5) — Status block, `## Epic Sprint Plan` index, one `## Sprint [N]` section per sprint, `## Dev Flow` footer. The only additions under Status:

```
**Goal:** What does this iteration deliver on top of the MVP / previous iteration, and how does it move the KPIs?
**Feedback from previous iteration:** [2–3 learnings that shaped this scope]
Related: [Roadmap] | [Retro [N-1]] | [PRD] | [ADR] | [Retrospectives] | [Closeouts]
```

On first creation populate Status + feedback, the Epic Sprint Plan index (`Not started` rows), and the Dev Flow footer. Per-sprint detail arrives with skill 9.

### Step IT5 — Update the Roadmap index (short)

Update the existing page — never create a second one, never inline iteration detail:

1. **Iterations table** — set the just-ended iteration's Status to `✅ Complete`; add or update the Iteration [N] row (Status `Planned`, sprints, headline, link to the new page).
2. **Progress rollup** — replace it with the new iteration's per-sprint rollup, or add `## Iteration [N] Progress` and collapse the prior one to a one-line summary linking its page.
3. **Parking lot** — leave intact; only move promoted items out.

### Step IT6 — Refresh the Artifact and advise

Refresh the artifact (below), then:

```
✅ Done:
- Iteration [N] page created under Roadmap: [N] Epics, [N] carried over, [N] deferred
- Roadmap index updated: previous iteration complete, Iteration [N] row added
- Roadmap artifact refreshed (same URL): [url]

⚠️ Still needed (human action required):
- Approve the Iteration [N] scope page
- Resolve open questions: [list]

👉 Next step — Skill 6: agile_6_create_epics (input: approved Iteration [N] scope page)
```

If the operator wants per-sprint depth before approving ("explain sprint N", "what are the open questions?"), continue with IT7.

### Step IT7 — Sprint deep-dive loop (on request)

Run per planned sprint, in plan order. Applies to INIT-mode MVP sprints the same way.

1. **Explainer artifact — one per sprint.** Load `artifact-design` first (plus `artifact-diagramming` / `dataviz` before drawing). All sprint explainers share one design language — same tokens, typography, figure style — so they read as a series; each gets its own **stable** favicon. Content shape: the problem in the product's own terms → each mechanism with a figure that *shows* it (data-flow diagram, before/after comparison, mock UI panel, or an illustrative chart) → where it lives in the architecture + its dependency seams → a closing callout listing the sprint's **open ADR questions**. Mock data is always labeled illustrative — never render invented numbers as real. Link the artifact from the sprint's row on the Iteration page and from a `Sprint explainers:` line under Status.
2. **Decision interview.** Put the sprint's open questions to the operator as options (2–4 per question, one marked `(Recommended)` with the reason in its description; use the ask-user-question tool if available, else one grouped message). ADR-level only — choices that change architecture, data contracts, external cost, or scope. Tuning constants (window sizes, thresholds, defaults) are *named* but deferred to refinement.
3. **Lock and record.** Append answers to a `## Decisions locked` section on the Iteration page — numbered continuously across sprints so decisions are citable (①…㊿) — update the sprint's row to reflect them, and edit the artifact's open-questions callout into a decisions callout (visibly different, e.g. accent border). When the operator picks **against** the recommendation, record the consequence and any follow-up it creates (a parked alternative, a display obligation), not just the choice. Maintain one running *"left for refinement"* line.
4. **Splits.** If the interview reveals a sprint carrying two themes, split it and renumber the tail — then re-sync the Iterations table, the progress rollup, and the roadmap artifact **in the same pass**, never later.

Loop exit: every planned sprint links an explainer and has its ADR questions either locked or explicitly listed as remaining.

### Step IT8 — Propagate to ADR + PRD (closing the loop)

Before handing off to skill 6, fold every locked decision back into the canonical pages:

- **ADR** (agile-4 page): a new or amended section per architecture-affecting decision — what was decided, why, what it supersedes (mark superseded designs as such, never delete them).
- **PRD** (agile-2 page): scope or user-visible behaviour changes, and KPI updates if the iteration moved them.
- **Iteration page**: keeps the decision *log*; ADR/PRD carry the resulting *state*.

**Confluence must be self-sufficient**: a reader with only the Confluence tree — no chat history, no artifacts — must be able to reconstruct every decision and its why. Artifacts are views; the pages are the record. Report the ADR/PRD page versions touched in the closing advise block.

---

## Roadmap Artifact (the published view)

The Roadmap index is also published as a **Claude Code Artifact** — a private, shareable web page that stakeholders can read without a Confluence seat, and that renders the progress rollup as an actual chart instead of a table of dashes.

**Confluence stays the source of truth. The artifact is a rendered view of it** — never edit the artifact instead of the page, and never let the two disagree: regenerate from the Confluence content every time.

**Owning the URL — this is what makes it idempotent.** The Roadmap page's `📊 Live roadmap:` line holds the artifact URL.
1. Read the Roadmap page and look for that line.
2. **Found** → regenerate the HTML and publish with `url:` set to it, so the existing artifact updates in place and the link stakeholders already have keeps working.
3. **Absent** → publish new, then write the returned URL into that line on the Roadmap page. Do this in the same run; an artifact whose URL is never recorded is orphaned and the next run publishes a duplicate.

**Building it:**
- **Load the `artifact-design` skill first** — required before writing the page — and the `dataviz` skill before writing any chart code.
- Write the HTML to a file, then publish it with the Artifact tool: stable `favicon` **🗺️** (never change it across redeploys — users find the tab by its icon), a `<title>` of `Roadmap — [Project Name]`, and a one-sentence `description`.
- **Self-contained**: a strict CSP blocks every external host, so inline all CSS and JS and embed any asset as a data URI. **Theme-aware** (light and dark). **Responsive** — tables scroll inside their own `overflow-x: auto` container so the page body never scrolls sideways.

**Content — the same four index elements, rendered:** the guiding principle; the iterations table with status pills; the current iteration's per-sprint progress as a **velocity chart** (committed vs delivered per sprint) plus a completion meter; the parking lot; and a footer linking back to the Confluence Roadmap and child pages, with the "last updated" date. Nothing that the short-index rule keeps off the Roadmap page belongs here either.

**If the Artifact tool is unavailable**, skip it, say so in the `⚠️ Still needed` block, and continue — Confluence alone is a complete result.

---

## Resume logic

Re-read the Roadmap index and the relevant child page first — never assume prior state. INIT: index exists but MVP page missing → create only the MVP page; both exist → fill gaps only. ITERATION: the Iteration [N] page exists → fill its incomplete sections, never duplicate it. Re-sync the Iterations table and progress rollup against the child pages, refresh the artifact at its existing URL, and report what changed versus what was already correct.

## Principles

- **Roadmap is a short index; detail lives in child pages, which are children of the Roadmap page — not of the root.**
- **Detect the mode first**, and **read before write** — PRD, ADR, index, and the relevant child page.
- **Ask before writing.** Never assign Epics to scope without explicit confirmation; propose and wait, grouping every question into one message.
- **Scope is a tripartite decision** — prepare the proposal, don't make the call.
- **Flag risks proactively** — XL Epics, dependency chains, capacity signals — before scope is locked, and state every assumption about timeline and capacity explicitly.
- **Living document, idempotent** — never replace past iterations (mark them complete, keep their pages); re-running fills gaps and re-syncs rather than duplicating.
- **The parking lot is permanent** — ideas are promoted, never deleted.
- **Decisions live in Confluence, not in chat.** Anything locked during planning lands on a page (Iteration log → ADR/PRD state); artifacts and conversation are never the only record.
