---
name: agile-8-refinement
description: "Refine Stories: points, ACs, DoD. Triggers: refine stories, estimate, backlog refinement. After skill 7, before skill 9."
---

# agile_8_refinement

Facilitator running a 3-amigos refinement: PM (value), Tech Lead (feasibility), QA (testability). Scan the queue → refine each Story through the lenses → update Jira → flag what is not ready → advise.

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

**Refinement's authoritative record is the Jira ticket** — the points field, ACs, DoD, and refinement comment. Any Confluence summary goes into the relevant `## Sprint [N]` **Backlog** table on the `MVP` / `Iteration N` child page, never the Roadmap index.

## Step 1 — Scan existing state

Find the target Epic(s) or sprint backlog; read every `To Do` Story that has no story points, including its summary, description, ACs, DoD, Specs UI link, technical notes, and dependencies.

Report the queue (`Story | Summary | Has AC? | Has DoD? | Has Specs link? | Points`) and ask whether to refine all of it or a subset. A Story that already has points **and** complete AC/DoD is skipped unless the user asks to re-refine — report it as "already refined".

### Optional pre-check — shared-file collision audit

A bundled script surfaces cross-Story file overlap once per sprint. Each overlap becomes a blocking Jira link (`is blocked by` / `relates to`) created **now**, instead of being rediscovered as a merge conflict at `agile-11-merge-train` Phase 4 — late detection compounds into per-sprint link backlogs and hidden coupling.

**Resolve the path from the plugin root, never a bare relative path** — installed as a plugin, the working directory is the consumer repo, so `scripts/…` will not exist:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/agile-8-refinement/scripts/sprint-shared-file-audit.sh" ABC-28 ABC-30 ABC-39
```

Fall back in order to the script's path relative to this `SKILL.md` (running via `--plugin-dir`), then to a consumer-repo equivalent under `scripts/`. None resolve → skip the audit and continue; it is optional. Full usage in `docs/sprint-shared-file-audit.md`.

## Step 2 — Refine each Story through four lenses

**Lens 1 — PM (value and scope).** Is the title clear and persona-specific? Is there a "so that [benefit]" making the value explicit? Is the out-of-scope boundary defined? Could this split into two independently deliverable Stories? **Flag** a title whose technical language hides user value ("Implement JWT refresh endpoint" rather than "Keep users logged in across sessions"), a missing or tautological benefit ("so that it works"), or a Story too large for one sprint — propose the split.

**Lens 2 — Tech Lead (feasibility and complexity).** Are there blockers or unknowns preventing estimation? Does it depend on a Story or system that is not ready? Is the approach clear enough for a dev agent to start without architectural questions? Are there performance, security, or scalability implications the ACs miss?

Estimate in **Fibonacci story points**: 1–2 trivial and well understood · 3 straightforward but needing care · 5 moderate, some unknowns · 8 complex, significant unknowns or cross-system impact · **13 = too large — do not estimate it; flag it for splitting and return it to skill 7.**

**Flag** an unlisted but obviously required dependency (the Story assumes an endpoint nobody has built), ACs implying cross-system behaviour absent from the technical notes, or a performance/security implication the dev agent needs spelled out.

**Lens 3 — QA (testability and edge cases).** Are all ACs falsifiable as written? Are edge cases covered — nulls, empty states, concurrent actions, permission boundaries, network errors? Would we know in production if this broke? Are there integration scenarios spanning several Stories? **Flag** subjective AC language ("fast", "clean", "user-friendly") — it must be made specific before estimation — a missing obvious edge case (file upload with no max-size AC), or a Story with only a happy path and no testable failure path.

**Lens 4 — Readiness gate, and it is binary.** Ready for Sprint requires **all** of: a clear persona-specific title · ≥2 falsifiable Given/When/Then ACs · a complete DoD · a Specs UI link for any UI Story · technical notes referencing the relevant ADR decisions · dependencies listed with known status · points estimated and not 13 · no open question that would block a dev agent from starting.

Any gate fails → **Not Ready**: do not estimate, document what is missing, and return it to the PM before the next run.

## Step 3 — Interview for what the lenses could not resolve

Group by Story, present the analysis first, then ask only the unresolved parts. State every assumption in the same message; never infer silently.

```
Story PROJ-124 — [summary]
PM lens: ✅ Clear value, scope defined
Tech lens: ⚠️ The AC mentions "real-time updates" but the ADR specifies polling. Polling, or is WebSocket in scope?
QA lens: ⚠️ Missing edge case — what happens if the user loses connection mid-action?
Questions: 1. Polling or WebSocket?  2. Connection loss — silent retry, error toast, or offline page?

Story PROJ-125 — [summary]
PM lens: ⚠️ Title is technical. Suggest "As a [persona], I want [action] so that [benefit]" — confirm?
Tech / QA: ✅
Questions: 3. Confirm the rename?

I'm already assuming:
- PROJ-126's dependency on PROJ-124 is implicit from the data flow — I'll add it
- The skill-7 DoD applies unchanged
```

Wait for answers before writing to Jira.

## Step 4 — Update Stories in Jira

**Story points — write the structured field, not just the comment.** Set the Story Points custom field via `editJiraIssue`, in the **same call** as the `refined` label so the two can never drift apart:

```python
mcp__atlassian__editJiraIssue(
    cloudId="<configured>",
    issueIdOrKey="<KEY>",
    fields={"customfield_10016": 5, "labels": [<existing>, "refined"]},
)
```

The field id is project-dependent — consumer repos pin it in `CLAUDE.md` (`story-points-field:`); `customfield_10016` is the Jira Software Cloud default. **A comment saying "Points: N" is not sufficient**: velocity charts, burndowns, sprint capacity reports, and the `agile-15-retro` Committed/Delivered/Velocity summary all read the structured field, so skipping the write yields silently broken reporting that only surfaces at retro time.

**Verify per Story — mandatory.** Re-read with `getJiraIssue` (`fields=["customfield_10016","labels"]`) and confirm both round-tripped; retry the write if either is missing. **A `refined` label with a null points value is the exact failure this verification exists to catch.**

Also update: any vague **AC** (rewritten, with missing edge cases and failure paths added), **technical notes** with the Tech Lead clarifications, and the **dependency** field with confirmed blockers. Then add a dated refinement comment:

```
## Refinement — [date]
Participants: PM, Tech Lead, QA (AI-assisted)
Points: [N]
Changes: [AC2 rewritten for specificity] · [edge case added: network timeout] · [dependency on PROJ-124 added]
Status: ✅ Ready for Sprint / ❌ Not Ready — [reason]
```

**Stories that fail the gate:** no story points, label `not-ready`, a comment listing exactly what is missing, and a comment tagging the PM with the list. Skill 9 excludes `not-ready` Stories automatically.

## Step 5 — Resume logic

Re-scan live Jira state — never assume the previous refinement still holds. Skip `refined` Stories unless asked to revisit. **Re-process `not-ready` Stories** to see whether the PM resolved the gaps. Refinement comments are **additive**: add a new dated entry rather than overwriting the previous one.

## Step 6 — Advise

```
✅ Done:
- [N] Stories refined and Ready for Sprint · [N] marked Not Ready (details in Jira comments)

| Story | Points | Status |
|-------|--------|--------|
| PROJ-124 | 3 | ✅ Ready |
| PROJ-126 | — | ❌ Not Ready — missing Specs UI link |

⚠️ Still needed (human action required):
- Fix Not Ready Stories: [list with what is missing per Story], then re-run skill 8 on them

👉 Next step — Skill 9: agile_9_sprint_planning — only `refined` Stories are eligible.
   Input: team velocity + sprint goal.
```

## Principles

- **Three lenses on every Story**, then a **binary** readiness gate — no partial readiness.
- **13 points means split, not estimate** — return it to skill 7.
- **Never assign points to a Story with vague ACs** — falsifiable first, estimate second.
- **Ask before updating** — show the analysis and proposed changes, grouped by Story, and wait before writing to Jira.
- **Not Ready Stories are documented, not deleted** — they stay in the backlog with clear PM instructions.
- **Idempotent and resumable** — re-running skips refined Stories, re-checks not-ready ones, and preserves refinement history.
- **Cross-Story file collisions surface at refinement, not at merge.**
