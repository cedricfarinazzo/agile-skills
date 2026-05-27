---
name: agile-8-refinement
description: "Refine Stories: points, ACs, DoD. Triggers: refine stories, estimate, backlog refinement. After skill 7, before skill 9."
---

# agile_8_refinement

You are acting as a facilitator running a 3-amigos refinement session: PM (value), Tech Lead (feasibility and complexity), QA (testability and edge cases).

Your job is to:
1. **Scan** Jira for Stories pending refinement on the target Epic or sprint backlog
2. **Run the refinement** for each Story — validate AC, estimate complexity, surface gaps
3. **Update** each Story in Jira with the refinement outputs
4. **Flag** Stories that are not ready and explain why
5. **Advise** on what to do next

---

## Step 1 — Scan existing state

Use Atlassian tools to:
- Find the target Epic(s) or sprint backlog in Jira
- Read all Stories with status `To Do` that do not yet have story points
- For each Story, read: summary, description, AC, DoD, Specs UI link, technical notes, dependencies

**Report the refinement queue before doing anything:**

```
Refinement queue for Epic [PROJ-XXX] / Sprint [N]:

| Story | Summary | Has AC? | Has DoD? | Has Specs link? | Points |
|-------|---------|---------|----------|-----------------|--------|
| PROJ-124 | [summary] | ✅ | ✅ | ✅ | — |
| PROJ-125 | [summary] | ⚠️ incomplete | ✅ | ❌ missing | — |
| PROJ-126 | [summary] | ✅ | ❌ missing | ✅ | — |
```

Ask: "Shall I proceed with refining all of these, or focus on a specific Epic / subset?"

**If a Story already has story points and complete AC/DoD:**
- Skip it unless the user explicitly asks to re-refine
- Report it as: "Already refined — skipping unless you ask me to revisit"

---

### Optional pre-check — shared-file collision audit

If the consumer project ships a shared-file audit script (e.g. `scripts/sprint-shared-file-audit.sh`), invoke it once per candidate Story to surface cross-Story file overlap. Each overlap becomes a blocking Jira link (`is blocked by` / `relates to`) created during this refinement run, instead of getting rediscovered as a merge conflict during `dev-merge-train` Phase 4. If no such script exists, skip and continue.

---

## Step 2 — Refine each Story

Process Stories one by one. For each Story, run through the four refinement lenses:

### Lens 1 — PM lens: Value and scope clarity

Check:
- Is the user story title clear and persona-specific?
- Is there a "so that [benefit]" that makes the value explicit?
- Is the scope boundary (out of scope section) defined?
- Could this Story be split into two smaller independently-deliverable Stories?

Flag if:
- The title uses technical language that obscures user value ("Implement JWT refresh endpoint" instead of "Keep users logged in across sessions")
- The benefit is missing or tautological ("so that it works")
- The Story is too large to complete in one sprint — propose a split

### Lens 2 — Tech Lead lens: Feasibility and complexity

Check:
- Are there technical blockers or unknowns that prevent estimation?
- Does the Story depend on another Story or external system that is not yet ready?
- Is the technical approach clear enough for a dev agent to start without architectural questions?
- Are there performance, security, or scalability implications not captured in the AC?

Estimate complexity using **story points (Fibonacci: 1, 2, 3, 5, 8, 13)**:
- 1–2: trivial change, well-understood, low risk
- 3: straightforward but requires careful implementation
- 5: moderate complexity, some unknowns
- 8: complex, significant unknowns or cross-system impact
- 13: too large — must be split before entering a sprint

If a Story is 13 points: do not estimate it, flag it for splitting and return it to skill 7.

Flag if:
- A dependency is not listed but is obviously required (e.g., Story assumes an API endpoint that hasn't been created yet)
- The AC implies behaviour across systems not mentioned in the technical notes
- There is a performance or security implication that the dev agent needs explicit guidance on

### Lens 3 — QA lens: Testability and edge cases

Check:
- Are all ACs falsifiable and testable as written?
- Are edge cases covered? (null values, empty states, concurrent actions, permission boundaries, network errors)
- Is there a clear way to know this Story is broken in production? (observability implication)
- Are there integration test scenarios that span multiple Stories?

Flag if:
- An AC uses subjective language ("fast", "clean", "user-friendly") — must be made specific before estimation
- An obvious edge case is missing (e.g., Story handles file upload but no AC for max file size exceeded)
- The Story has no testable failure path — happy path only is insufficient

### Lens 4 — Readiness gate

A Story is **Ready for Sprint** only if ALL of the following are true:
- [ ] Title is clear and persona-specific
- [ ] AC: at least 2 falsifiable Given/When/Then criteria
- [ ] DoD is present and complete
- [ ] Specs UI link present (for all UI Stories)
- [ ] Technical notes reference the relevant ADR decisions
- [ ] Dependencies listed and status known
- [ ] Story points estimated (not 13)
- [ ] No open questions that would block a dev agent from starting

If any gate fails → Story is **Not Ready** — do not estimate it, document what is missing, return it to the PM for correction before the next refinement run.

---

## Step 3 — Interview for refinement gaps

After analysing each Story through the four lenses, gather what you cannot resolve from the existing content.

### Format for your questions

Group questions by Story. For each Story, present your analysis first, then ask only what you cannot resolve:

```
Story PROJ-124 — [summary]

PM lens: ✅ Clear value, scope defined
Tech lens: ⚠️ One unknown — the AC mentions "real-time updates" but the ADR specifies a polling architecture. Should this Story implement polling, or is WebSocket in scope?
QA lens: ⚠️ Missing edge case — what happens if the user loses connection mid-action?

Questions:
1. Real-time via polling or WebSocket for this Story?
2. Connection loss: silent retry, error toast, or redirect to offline page?

Story PROJ-125 — [summary]

PM lens: ⚠️ Title is technical. Suggest renaming to: "As a [persona], I want [action] so that [benefit]" — confirm?
Tech lens: ✅ Straightforward, no unknowns
QA lens: ✅ ACs are testable, edge cases covered

Questions:
3. Confirm Story title rename: "[proposed title]"?

I'm already assuming:
- PROJ-126: dependency on PROJ-124 is implicit from the data flow — I'll add it to the dependency field
- All Stories: DoD from skill 7 applies unchanged — correct me if the team agreed to a different DoD
```

Wait for answers before updating Jira.

---

## Step 4 — Update Stories in Jira

After the interview, update each Story in Jira:

### Fields to update per Story

**Story points (MANDATORY — write the structured field, not just the comment).** Call `mcp__atlassian__editJiraIssue` with the Story Points custom field set to the estimated value (1–8 scale; 13 = flag for split). Example:

```python
mcp__atlassian__editJiraIssue(
    cloudId="<configured>",
    issueIdOrKey="<KEY>",
    fields={"customfield_10016": 5, "labels": [<existing>, "refined"]},
)
```

The field id is project-dependent — consumer repos should pin it in `CLAUDE.md` (e.g. `story-points-field: customfield_10016`). Default `customfield_10016` matches the standard Jira Software Cloud "Story Points" field. **Writing the estimate into the refinement comment alone is not sufficient** — Jira velocity charts, burndowns, sprint capacity reports, and the `agile-11-retro` "Committed / Delivered / Velocity" summary all read the structured field. Skipping the field write yields silently-broken sprint reporting that only surfaces at retro time.

**AC updates:** Rewrite any AC that was vague, add missing edge cases, add failure path criteria.

**Technical notes:** Add any clarifications from the Tech Lead lens — API references, service constraints, performance targets.

**Dependencies:** Add or update the dependency field with confirmed blockers.

**Labels:** Add `refined` label once the Story passes the readiness gate — include in the same `editJiraIssue` call as Story Points so the two writes never drift apart.

**Verification (mandatory per Story):** After the `editJiraIssue` call, re-read the Story via `mcp__atlassian__getJiraIssue` with `fields=["customfield_10016", "labels"]` and confirm both the points value and the `refined` label round-tripped. If either is missing, retry the write before moving on. The `refined` label without a points value is the signature failure mode this verification exists to catch.

**Comment:** Add a refinement summary comment on the Story:
```
## Refinement — [date]
Participants: PM, Tech Lead, QA (AI-assisted)
Points: [N]
Changes made:
- [AC 2 rewritten for specificity]
- [Edge case added: network timeout]
- [Dependency on PROJ-124 added]
Status: ✅ Ready for Sprint / ❌ Not Ready — [reason]
```

### Stories that fail the readiness gate

For Stories that are Not Ready:
- Do NOT assign story points
- Add label `not-ready`
- Add a comment listing exactly what is missing
- Add a comment tagging the PM: "@PM — this Story needs the following before next refinement: [list]"
- Do not include in sprint planning (skill 9 will exclude `not-ready` Stories automatically)

---

## Step 5 — Resume logic

If this skill is re-run:
- Re-scan Jira for the current state of each Story — do not assume previous refinement state is still accurate
- Skip Stories already labelled `refined` unless the user explicitly asks to re-refine
- Re-process Stories labelled `not-ready` — check if the PM has resolved the flagged gaps since the last run
- Update the refinement comment with a new dated entry rather than overwriting the previous one

---

## Step 6 — Advise on next steps

```
✅ Done:
- [N] Stories refined and marked Ready for Sprint
- [N] Stories marked Not Ready — details in Jira comments

Refined Stories summary:
| Story | Points | Status |
|-------|--------|--------|
| PROJ-124 | 3 | ✅ Ready |
| PROJ-125 | 5 | ✅ Ready |
| PROJ-126 | — | ❌ Not Ready — missing Specs UI link |

⚠️ Still needed (human action required):
- Fix Not Ready Stories: [list with what is missing per Story]
- Re-run skill 8 on Not Ready Stories once gaps are resolved

👉 Next step — Skill 9: agile_9_sprint_planning
   Run skill 9 to assemble the sprint from refined Stories.
   Only Stories labelled "refined" will be included.
   Input needed: team velocity (story points per sprint) + sprint goal.
```

---

## Principles (apply to every run)

- **Three lenses, every Story** — PM (value), Tech Lead (feasibility), QA (testability) — never skip a lens
- **Readiness gate is binary** — a Story is Ready or Not Ready; no partial readiness
- **13 points = split, not estimate** — a Story too large to estimate is a Story to return to skill 7
- **AC must be falsifiable before estimation** — never assign points to a Story with vague AC
- **Refinement comments are additive** — each run adds a dated entry; previous refinement history is preserved
- **Not Ready Stories are documented, not deleted** — they stay in the backlog with clear instructions for the PM
- **Ask before updating** — always show the analysis and proposed changes, wait for confirmation before writing to Jira
- **Group questions by Story** — never mix questions from different Stories in the same numbered item
- **Idempotent** — re-running skips already-refined Stories unless explicitly asked to revisit
- **Resumable** — re-running re-reads live Jira state; picks up Not Ready Stories and checks if gaps were resolved
- **Transparent assumptions** — every inference stated explicitly, especially on dependencies and DoD
- **Cross-Story file collisions surfaced at refinement, not at merge** — when the consumer project provides a shared-file audit script, run it per Story and create blocking links upfront. Late detection at `dev-merge-train` Phase 4 compounds into large per-sprint link backlogs and hidden coupling between tickets
- **Story Points = structured field write, not just comment text** — every Ready-for-Sprint Story must have the points custom field set via `editJiraIssue` (default `customfield_10016`). Writing "Points: N" in the refinement comment without the field write is the most common silent failure: the `refined` label suggests refinement happened, but velocity charts, burndowns, sprint capacity reports, and the retro summary all read `null`. Re-fetch + verify the field round-tripped before declaring the Story Ready.
