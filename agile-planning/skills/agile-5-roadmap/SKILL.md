---
name: agile-5-roadmap
description: "Roadmap index + MVP/Iteration pages in Confluence, plus a published Claude Code Artifact view. Optional sprint deep-dive: explainer artifact + ADR-decision interview, closed by an ADR/PRD sync. RESTRUCTURE rebuilds a drifted planning tree without losing information. Triggers: create roadmap, define MVP, plan iteration, restructure roadmap, fix confluence structure. After skill 4 or retro (skill 15), before skill 6."
---

# agile_5_roadmap

Product Manager + Tech Lead defining what gets built, in what order, and why.

Three modes, detected from context:
- **INIT** — no Roadmap page exists → create the Roadmap index, the MVP page and the empty shared pages (after the ADR).
- **ITERATION** — "plan the next iteration", "we finished the MVP", "add iteration N" → add an Iteration page and update the index.
- **RESTRUCTURE** — "restructure the roadmap", "fix the Confluence structure", or any page of the tree breaks its layout → plan and run a lossless migration to the canonical layout (below). INIT and ITERATION check for drift first and offer RESTRUCTURE before writing into a drifted tree.

**Templates** for every planning page — Roadmap, MVP / Iteration, Sprint, Decision Log and its range pages, Parking Lot, Working Agreements, Debt Register — are in `references/page-templates.md` (`${CLAUDE_PLUGIN_ROOT}/skills/agile-5-roadmap/references/page-templates.md`). Read it before writing any of them.

A Roadmap exists and the user says "create the roadmap" → confirm: "I found an existing Roadmap. Add a new iteration, or revisit the MVP scope?"

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

### Step I4 — Write the Roadmap index and the shared pages

Create, from the templates: `Roadmap — [Project]` (child of the root; `## Iterations` holds the MVP row and one row per known iteration, `## Progress` one `Not started` row per planned MVP sprint, `## Next step` → skill 6); `Parking Lot — [Project]` under the Roadmap, seeded with the post-MVP ideas from the interview; `Decision Log — [Project]` and `Working Agreements — [Project]` under the root with empty tables. The index holds no goal, success criteria or epic detail.

### Step I5 — Write the MVP page

Child of **the Roadmap page**, titled `MVP — [Project]`, from the MVP / Iteration template: Properties, Goal, Success criteria (the PRD KPIs that apply), Epics in scope (`Status` To Do until skill 6 creates them), and a `## Sprints` table with one `Not started` row per planned sprint. Sprint pages are created when each sprint is planned (skill 9, or a `Planned` skeleton from the IT7 deep-dive), not upfront.

### Step I6 — Publish the roadmap Artifact

See **Roadmap Artifact** below, then advise:

```
✅ Done:
- Roadmap index, Parking Lot, Decision Log and Working Agreements pages created
- MVP scope page created under Roadmap: [N] Epics, target [date/sprint]
- Roadmap artifact published: [url]
- [N] Epics deferred to Iteration 1, [N] ideas in the Parking Lot

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

From the **retrospective**: what went well (reinforce), what to improve (process/scope adjustments), user feedback (may reprioritise), and completed-vs-not Epics (unfinished work carries over). From the **previous Iteration page and the Parking Lot page**: Epics already earmarked, and Parking Lot candidates. From the **Working Agreements**: the planning rules in force. From **Jira**: previous-iteration Epic statuses and any Epics created since the last update.

### Step IT3 — Interview for iteration scope

```
I've read the retrospective and current Roadmap.

Carried over: [Epic X] — not completed, [reason]
Available for Iteration [N]: [earmarked Epics] · [Parking Lot candidates]
User feedback themes from retro: [theme], [theme]

Before I update the Roadmap:
1. Prioritise carried-over Epics first, or can new Epics run in parallel?
2. Which parking-lot items are ready to pull in?
3. Has the success criteria changed based on MVP results?
4. [scope / capacity question]

Already flagging: [Epic too large given retro velocity] · [dependency blocking a proposed Epic]
```

### Step IT4 — Write the Iteration page

Child of the Roadmap page, titled `Iteration [N] — [Project]`, from the MVP / Iteration template. `## Feedback carried in` holds the 2–5 retro learnings that shaped the scope, each linked; carried-over epics appear in `## Epics in scope` with their reason; ideas promoted from the Parking Lot move to `## Scope changes` (and leave the Parking Lot). Sprint pages arrive with skill 9 or the IT7 deep-dive.

### Step IT5 — Update the Roadmap index

Never a second Roadmap, never iteration detail on it: the just-ended iteration's `## Iterations` row → `✅ Complete`, the new row added; `## Progress` collapses the closed iteration into one totals row and lists the new iteration's sprints; `## Next step` → skill 6; one `## Change history` row.

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

1. **Explainer artifact — one per sprint.** Load `artifact-design` first (plus `artifact-diagramming` / `dataviz` before drawing). All sprint explainers share one design language — same tokens, typography, figure style — so they read as a series; each gets its own **stable** favicon. Content shape: the problem in the product's own terms → each mechanism with a figure that *shows* it (data-flow diagram, before/after comparison, mock UI panel, or an illustrative chart) → where it lives in the architecture + its dependency seams → a closing callout listing the sprint's **open ADR questions**. Mock data is always labeled illustrative — never render invented numbers as real. Write its link in the Sprint page's Properties `Explainer` field.
2. **Decision interview.** Put the sprint's open questions to the operator as options (2–4 per question, one marked `(Recommended)` with the reason in its description; use the ask-user-question tool if available, else one grouped message). ADR-level only — choices that change architecture, data contracts, external cost, or scope. Tuning constants (window sizes, thresholds, defaults) are *named* but deferred to refinement.
3. **Lock and record.** If the sprint has no Sprint page yet, create its skeleton now under the Iteration page (Properties with Status `Planned`, Goal as a draft, Scope, Decisions); skill 9 fills the rest. Each answer becomes a `D###` entry in the Decision Log (next free id; register row + range-page section, Scope = the sprint) and a row in the Sprint page's `## Decisions` (or in the Iteration page's `## Scope changes` when it moves scope); edit the artifact's open-questions callout into a decisions callout (visibly different, e.g. accent border). When the operator picks **against** the recommendation, the entry's Consequences records what that obliges (a parked alternative, a display obligation), not just the choice. Items left for refinement go in the Sprint page's `## Scope` as `Left for refinement: …`, and are removed from there when refinement settles them.
4. **Splits.** If the interview reveals a sprint carrying two themes, split it and renumber the tail — then re-sync the Iteration page's `## Sprints`, the Roadmap's `## Progress`, and the roadmap artifact **in the same pass**, never later.

**If the Artifact tool is unavailable**, skip step 1, note it under `⚠️ Still needed`, and run the rest of the loop — the interview and the decision log are the load-bearing half, and they need no artifact. The explainer is a view; Confluence is the record.

Loop exit: every planned sprint has its ADR questions either locked or explicitly listed as remaining, and links an explainer — or the run recorded that artifacts were unavailable.

### Step IT8 — Propagate to ADR + PRD (closing the loop)

Before handing off to skill 6, fold every locked decision back into the canonical pages:

- **ADR** (agile-4 page): a new or amended section per architecture-affecting decision — what was decided, why, what it supersedes (mark superseded designs as such, never delete them).
- **PRD** (agile-2 page): scope or user-visible behaviour changes, and KPI updates if the iteration moved them.
- **Decision Log**: keeps the decision *history*; ADR/PRD carry the resulting *state*, and each ADR section names the `D###` it came from.

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

**Content — the index, rendered:** the guiding principle; the iterations table with status pills; the per-sprint progress as a **velocity chart** (committed vs delivered, read from `## Progress` and, for closed iterations, from each Sprint page's Properties) plus a completion meter; the Parking Lot count with its link; and a footer linking back to the Confluence Roadmap and its pages, with the "last updated" date. Nothing the Roadmap page itself must not hold belongs here either.

**If the Artifact tool is unavailable**, skip it, say so in the `⚠️ Still needed` block, and continue — Confluence alone is a complete result.

---

## RESTRUCTURE MODE

A tree that drifted — logs instead of state, one fact in many places, sprint sections in a page dozens of thousands of characters long, decisions under several id schemes — is migrated to the canonical layout. **Nothing is dropped**: every fact ends up in exactly one home, and every other place it appeared becomes a link.

### Step R1 — Read everything, in full

List every page under the project root (`mcp__atlassian__getConfluencePageDescendants`) and read each planning page in full — Roadmap, MVP, every Iteration page, any Parking Lot, decision, rules or debt page — never a summary or an excerpt. A body too large for one result is saved to a file and read in chunks to the end. On Claude Code, one read-only subagent per large page may build its inventory in parallel. Also read the ADR's decision sections and the Retro and Closeout index pages: they are where facts the planning pages copied already live.

Per page, build an inventory: size, heading outline, and every **kind** of content with where it sits (status line, changelog, goal, velocity row, backlog, decision, lesson, rule, debt item, idea, link, tech note…).

### Step R2 — Map every block to its home

Write the destination map, one row per content block: `Source page · section | Content | Target page · section | Action`. Actions: **move** (the only copy), **merge** (several copies → one, the others become links), **link** (already owned elsewhere: Jira, Closeout, Retro, ADR), **history** (a changelog entry → a `## Change history` row, a goal refocus → the goal history table, a scope move → `## Scope changes`). Rules for the hard cases:

- **Sprint sections** become Sprint pages; two backlog tables of one sprint merge into one table (union of columns, rank kept).
- **Decisions** keep the ids they are cited by: an existing `D<n>` keeps its number (`D13` → `D013`, never renumbered — Jira, the ADR and other pages cite it). A decision from another scheme (`⑲`, `㊹a`) takes the number its sequence implies when that slot is free (①–⑫ → D001–D012 before D13), else the next free number, and keeps the legacy id as its Alias. An unnumbered decision gets the next free id and its Source says it had none; an amendment appended to an older decision becomes its own entry pointing at it. A gap in a sequence is listed, and filled from the ADR when it holds the text.
- **Mixed lists** (a parking lot holding ideas, debt, conventions, operator rules, CI gotchas) split by kind: ideas → Parking Lot, rules and conventions → Working Agreements, debt → Debt Register, a fact about a ticket → the ticket. Instructions addressed to agents go to the consumer repo's `CLAUDE.md/AGENTS.md` as a proposed diff; feedback on these skills goes in the report.
- **Contradictions** (two values for one figure or date) are listed with both values and their sources; the authoritative source wins — Jira for tickets, points and sprint dates, the Closeout for verdicts, the Retro for lessons, the Decision Log for decisions — and the losing value is recorded in the target page's `## Notes`. Never pick silently.
- Content that fits no heading goes to the nearest page's `## Notes`. Nothing is left behind because it was hard to place.

### Step R3 — Present the plan, decide, then wait

One message, with all of: the pages to create, rewrite and move (size before → after); the destination map summary per source page, covering every kind of content in its inventory — status-line changelogs and history logs included (→ `## Change history` rows), so nothing is left unmapped; the decision id map (kept ids, new ids, aliases, gaps); every contradiction with both values, their sources, the value that wins and where the other is recorded; how each source page is archived (copy, or recorded version when too large); and the R5 check that will prove no ticket key, decision id, link, number or date was lost. Then the decisions needed — each as a question with 2–4 options, one marked `(Recommended)` (ask-user-question tool if available). **Write nothing until the user approves the plan.**

### Step R4 — Snapshot, then write in dependency order

Record every source page's current version number in the plan (Confluence keeps that version), and copy each source body to `Extras / Archive — <title> (pre-restructure <date>)`; a body too large for the integration to write stays archived by its recorded version alone, and the plan says so. Then write: Decision Log and range pages → MVP / Iteration pages (creating the missing ones) → Sprint pages under them → Parking Lot, Working Agreements, Debt Register → the Roadmap index last. Rewrite existing pages in place (their ids and inbound links survive); create the new ones under the parent the tree names. Each write carries a version message and one `## Change history` row (`Restructured to the canonical layout`).

### Step R5 — Prove nothing was lost

Per source page, extract its operative tokens from the body saved in R1 — ticket keys, decision ids and aliases, page ids and URLs, numbers with units, dates — and check each appears somewhere in the new set (a script over the saved bodies, not a reading). Every missing token is either restored or listed with the reason it was intentionally merged. A restructure with an unexplained missing token is not done.

### Step R6 — Sync the index and report

Recompute the Roadmap's `## Iterations` and `## Progress` from the Iteration and Sprint pages, check every page against its budget, refresh the artifact, then advise: pages created / rewritten / archived, sizes before → after, the decision id map, contradictions and how each was resolved, the token check (`N/N found`), and any proposed `CLAUDE.md/AGENTS.md` diff.

## Resume logic

Re-read the Roadmap index and the relevant pages first — never assume prior state. INIT: create only what is missing, fill gaps only. ITERATION: the Iteration [N] page exists → fill its incomplete sections, never duplicate it. RESTRUCTURE: an archive copy dated today and a recorded plan mean a run is in progress — continue from the first page not yet rewritten. Always re-sync `## Iterations` and `## Progress` against the Iteration and Sprint pages, refresh the artifact at its existing URL, and report what changed versus what was already correct.

## Principles

- **Roadmap is an index** — detail lives on the Iteration and Sprint pages, decisions in the Decision Log; the index only rolls them up.
- **Scope is a tripartite decision** — prepare the proposal, don't make the call.
- **Decisions live in Confluence, not in chat** — artifacts and conversation are never the only record.
