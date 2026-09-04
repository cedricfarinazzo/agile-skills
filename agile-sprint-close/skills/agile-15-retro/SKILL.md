---
name: agile-15-retro
description: "Sprint retro in Confluence + Roadmap update. Triggers: run retro, close sprint, what did we learn. After all Stories Done, hands off to skill 5."
---

# agile_15_retro

Scrum Master facilitating the sprint retrospective and feeding its learnings straight into the next iteration: scan sprint results → load the closeout report → interview the team → write the Retro page → update the Roadmap → close the sprint in Jira → advise.

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

Retrospectives and Closeouts are **sibling folders**: `agile-13-sprint-closeout` produces the engineering gate before this skill runs, and the retro reads it as input.

## Step 1 — Scan existing state

Find the active or recently ended sprint; read every Story and its final status (Done / Won't Do / carried over); compute committed points, delivered points, and velocity. Then find the project root, check for a `Retrospectives` folder, count its pages to get the next retro number, and read the Roadmap to see which iteration just ended.

Report the summary before doing anything — the results table (`Story | Summary | Points | Status`), committed/delivered/velocity with the percentage, whether the folder exists, and which retro number this will be. Then ask: "Is this sprint complete and ready for retrospective?"

**Stories still In Progress or In Review → warn and wait for confirmation:** "Stories [list] are still open. Run the retro anyway and carry them over, or wait until they resolve?"

## Step 1.5 — Load the sprint closeout report

The closeout is the single source of truth for what the engineering / architecture / tech-lead gate found. The retro **incorporates** it; it never re-litigates it.

Look for a `Closeouts` folder under the project root, then a page titled `Closeout <N> — Sprint <N> — <Project>`. If either is missing, report `No closeout report for Sprint <N> — proceeding without closeout input. Recommend running agile-13-sprint-closeout before future retros.` and continue.

Found → fetch it in full and surface: the **verdict** (Closeout-clear / Blocked + reason); the **findings counts** (`N Critical / M Minor / K Nit`); the **Critical findings**, which are non-negotiable retro inputs and must appear verbatim in "What could be improved" and "Action items"; **cross-file patterns**, which become candidate convention updates or tickets; the closeout's own **"Lessons for retro"**; and **bugs surfaced and fixed during closeout**, which go under what was caught late. Capture the page id + URL — Step 4 needs them so the two artifacts cross-link.

Report the link, verdict, and counts, then list what the retro will take as input.

**Unresolved Critical findings → halt and ask:** "Sprint closeout is not green — running the retro now will be advisory only. Resolve the closeout-blocking issues first, or proceed anyway?" Do not proceed without explicit confirmation.

## Step 2 — Ensure the Retrospectives folder exists

A page named `Retrospectives` as a direct child of the project root. Missing → create it (parent: project root; body: "All sprint retrospectives for [Project Name].") and report that you did. Present → reuse it; never recreate it.

## Step 3 — Interview for retrospective inputs

Ask all seven in **one** message — never drip:

1. **What went well?** Specific: not "communication was good" but "daily syncs caught the auth blocker early."
2. **What could be improved?** Blameless: not "X was slow" but "Stories with external API dependencies took longer because we didn't confirm the contract upfront."
3. **Action items** — each with an owner and a due date. Not "we should write better ACs" but "PM adds ≥3 falsifiable ACs to every Story before refinement, starting next sprint."
4. **User / stakeholder feedback this sprint** — feeds Roadmap reprioritisation directly.
5. **Technical debt observed** — every shortcut taken, logged so it does not get lost.
6. **Sprint goal assessment** — achieved fully / partially / not at all, and why.
7. **Velocity signal** — was this representative, or affected by onboarding, incidents, holidays?

**Ask** when the team has given no input yet, when an action item lacks an owner or a date (it is not an action item until it has both), or when feedback mentioned in Jira is vague. **Infer and flag** — never silently — a carried-over Story ("may indicate overcommitment or unexpected complexity; correct me if the root cause differs"), a velocity below 70% of commitment, or a sprint where QA created several Bugs ("noting AC quality as a potential improvement area").

Lead the questions with the flags the sprint data already justifies, and wait for answers before writing.

## Step 4 — Write the Retro page

New child of the `Retrospectives` folder, titled `Retro [N] — Sprint [N] — [Project Name]`:

```
# Retro [N] — Sprint [N] — [Project Name]

## Sprint summary
Period: [start] → [end]
Goal: "[sprint goal]" — [Achieved / Partially achieved / Not achieved]
Committed: [N] pts | Delivered: [N] pts | Velocity: [N] pts ([N]%)
Stories delivered: [N] | Carried over: [N] | Won't Do: [N] | Bugs created by QA: [N]
Closeout report: [link, or "Not produced — recommend agile-13-sprint-closeout before next retro"]
Closeout verdict: [Closeout-clear / Blocked + reason / N/A]   Findings: [N Critical / M Minor / K Nit / N/A]

## What went well ✅
- [specific thing]

## What could be improved ⚠️
- [specific friction — root cause if known]

## Action items 🎯
| Action | Owner | Due | Status |

## User & stakeholder feedback 👥
- [feedback — source: demo / user test / stakeholder]
Prioritisation impact: [does this change the next iteration? yes/no + why]

## Technical debt logged 🔧
| Item | Context | Suggested sprint to address |

Items mirrored from the closeout's Minor / Nit / cross-file-pattern findings go here **verbatim** with a link back to the closeout — do not paraphrase; the closeout is the source of truth.

## Velocity signal 📈
Delivered: [N] pts | Context: [representative / holiday / incident / onboarding]
Recommended capacity for next sprint: [N] pts

## Carried-over Stories
| Story | Why not completed | Disposition (carry / reprioritise / descope) |

## Next iteration signals
Inputs for skill 5 (ITERATION mode): priority shifts from feedback · technical debt to schedule · capacity adjustment · action items to embed in process.

## Next Step
→ Run skill 5 (ITERATION mode): agile_5_roadmap
```

## Step 5 — Update the Roadmap (index + child page, never inline detail)

The Roadmap is a **short index**; per-sprint detail lives on the `MVP` / `Iteration N` child page. Never add a completed-iteration section or a retro write-up to the Roadmap page itself. Update three places:

1. **The child page's `## Sprint [N]` section** — flip the heading to `✅ Complete`, set the actual delivered/committed velocity, and fill `### Sprint conclusion` (what shipped, what slipped, key lessons) plus the `Retrospective:` and `Closeout:` links.
2. **The child page's `## Epic Sprint Plan` row** for this sprint — Status `✅ Complete`, the delivered/committed velocity, and the `[Retro N]` / `[Closeout N]` links in the Retro column.
3. **The Roadmap index — every retro, even mid-iteration.** Two sub-cases, both required so the index never lags a closed sprint:
   - **Progress rollup + Next-Step pointer (EVERY sprint)** — flip the just-closed sprint's rollup row to `✅ Complete` with its final velocity, and advance the current-sprint pointer. **Skipping this is the common miss**: the index then sits stale showing a closed sprint as in progress. One line only; never paste retro detail into it.
   - **Iterations table status (LAST sprint only)** — set the iteration's row to `✅ Complete` **only when its final sprint closes**, and ensure the next iteration has a row (`| Iteration [N+1] | Not started | TBD | [headline] | [Iteration [N+1] — [Project]] |`; the page itself comes later from skill 5). If the iteration was extended with another sprint, leave it `In Progress` and update its sprint span instead.

**Refresh the roadmap artifact.** Load the **`artifact-design`** skill first (required before writing the page), and `dataviz` before any chart code. Then read the Roadmap page's `📊 Live roadmap:` line — skill 5 owns the page's format and content rules. Regenerating matters most here: the sprint that just closed now has real delivered-vs-committed numbers, which is the point of the chart.

- **URL present** → republish with the Artifact tool passing that `url:`, keeping the stable `🗺️` favicon, so it updates in place.
- **No URL** (a Roadmap that predates the artifact, or an earlier skipped publish) → **publish new and write the returned URL back onto the Roadmap page in this same run.**
- **No Artifact tool available** → skip, and say so under `⚠️ Still needed`. Confluence is the source of truth either way.

## Step 6 — Close the sprint in Jira

Done Stories need no action. **Carried-over Stories** go back to the backlog (`To Do`, sprint assignment removed) with a comment naming the sprint, the reason from the retro, and that they re-enter Sprint [N+1] planning. **Won't Do Stories** are confirmed with the user before transitioning, with a comment explaining why. Then close the sprint.

## Step 7 — Resume logic

Re-run on a sprint that already has a retro page: read it, check which sections are real versus placeholder, and **fill only what is missing — never overwrite existing content**. If the sprint is already closed in Jira, confirm before re-closing. If action items from a previous retro are still open, surface them — they must not be forgotten. Never recreate the Retrospectives folder.

## Step 8 — Advise

```
✅ Done:
- Retrospectives folder: [created / already existed]
- Retro [N] documented: [link]
- Roadmap updated: sprint rollup + iteration status
- Roadmap artifact: refreshed at [url] / published at [url] / skipped — [reason]
- Sprint [N] closed in Jira; [N] Stories carried over to backlog

Key inputs for next iteration: capacity [N] pts · priority shifts [list] · debt to schedule [list] · action items in effect [list]

⚠️ Still needed (human action required):
- Review and validate action items with the team
- Confirm disposition of carried-over Stories, and any Won't Do not yet confirmed

👉 Next step — Skill 5: agile_5_roadmap (ITERATION mode) to plan Iteration [N+1].
   Input: this Retro page + the current Roadmap + the Jira backlog.
   Then: skill 6 (Epics) → 7 (Stories) → 8 (Refinement) → 9 (Sprint Planning).
```

## Principles

- **Every retro lives inside the Retrospectives folder** — never directly under the project root.
- **Ask before writing** — collect the team's input first.
- **Blameless by default** — the language is about processes and systems, never individuals.
- **An action item without an owner and a due date is not an action item.**
- **Never invent learnings** — state velocity signals, improvement flags, and carried-over reasons as inferences, not conclusions.
