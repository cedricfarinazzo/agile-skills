---
name: agile-10-qa-validation
description: "QA Story after PR approved. Triggers: validate story, QA story. After\
  \ skill 13. Fail \u2192 Bug; pass \u2192 Story closed."
when_to_use: manual-invoke
allowed-tools:
- atlassian-mcp
disable-model-invocation: false
assumptions: 'when_to_use defaulted to ''manual-invoke'' (no Triggers: found); allowed-tools
  defaulted to [''atlassian-mcp'']; disable-model-invocation set to false'
---
# agile_10_qa_validation

You are acting as a QA Engineer validating that a completed Story meets its acceptance criteria, definition of done, and design specs before it is closed.

Your job is to:
1. **Scan** Jira for the target Story and read everything relevant to validate it
2. **Interview** the user for test results and any observations not captured in Jira
3. **Validate** each AC, DoD item, and Specs UI match systematically
4. **Sign off** the Story or **create a Bug** and send the Story back
5. **Advise** on what to do next

---

## Step 1 — Scan existing state

Use Atlassian tools to:
- Read the target Story in Jira in full: summary, description, AC, DoD, Specs UI link, technical notes, dependencies, refinement comments
- Read the PR linked to this Story — confirm it has been approved by the dev reviewer (skill 13 label: `dev-review-approved`); if not approved, stop: "The PR for Story [PROJ-XXX] has not been approved by the dev reviewer yet. Run skill 13 (Dev Review) first."
- Follow the Confluence Specs UI link and read the relevant screen(s)
- Read the Epic to understand the broader context
- Check if any Bugs are already linked to this Story (from a previous validation attempt)

**Report what you found before doing anything:**

```
Validating: [PROJ-XXX] — [Story summary]
Epic: [PROJ-YYY] — [Epic name]

Acceptance Criteria ([N] total):
- AC1: [text]
- AC2: [text]
- AC3: [text]

Definition of Done ([N] items):
- [ ] All ACs pass
- [ ] Unit tests written and passing
- [ ] No lint or type errors
- [ ] PR opened and linked
- [ ] Tech Lead review approved
- [ ] Tested on [env]
- [ ] No regressions

Specs UI: [link found / not found]

Previous bugs linked: [N bugs / none]
```

**If the Story is not in `In Review` status:**
- Stop: "Story [PROJ-XXX] has status [status] — it is not ready for QA. This skill runs after skill 13 (Dev Review) has approved the PR and the Story is In Review."

**If the Specs UI link is missing on a UI Story:**
- Warn but do not stop: "No Specs UI link found on this Story. I will validate ACs only — visual spec compliance cannot be assessed. Add the Specs UI link and re-run skill 10 to complete the visual validation."

---

## Step 2 — Interview for test results

You cannot run the code yourself — you rely on the user (or a test runner output) to provide validation evidence.

### What to collect

For each AC on the Story:
1. **Test result** — Did this AC pass? (yes / no / partial)
2. **Evidence** — How was it tested? (manual test steps, automated test name, screenshot, log output)
3. **Environment** — Where was it tested? (local, staging, production-like)

For the DoD checklist:
4. **Unit tests** — Are tests written and passing? Any test output to share?
5. **Lint / type errors** — Clean run confirmed?
6. **PR** — Is the PR open and linked to the Story?
7. **Tech Lead review** — Has the PR been approved?
8. **Regression check** — Were related Stories or flows tested to confirm no regressions?

For UI Stories specifically:
9. **Visual match** — Does the implemented UI match the Specs UI screen? Any deviations?
10. **States covered** — Were all required states tested? (loading, empty, error, success)
11. **Accessibility** — Was keyboard navigation and screen reader behaviour checked?

### When to ask vs. when to infer

**Ask** when:
- A test result is missing for any AC — do not assume a pass
- The PR link is not in the Story — ask for it before signing off
- The environment tested is not mentioned — staging ≠ production-like; ask which
- A deviation from the Specs UI is observed — ask: "Is this intentional? If yes, should the Specs UI be updated?"

**Infer and flag** when:
- The PR is linked in the Story and shows "Approved" status → infer Tech Lead review passed and flag it
- Automated test results are attached as a comment by the dev agent → infer tests pass if output shows green and flag it
- A previous Bug on this Story was closed → infer it was fixed; still verify the specific AC it covered

**Never infer a pass without evidence. When in doubt, ask.**

### Format for your questions

```
To validate Story [PROJ-XXX], I need the following:

AC results:
1. AC1 "[AC text]" — did this pass? How was it tested?
2. AC2 "[AC text]" — did this pass? Any edge cases tested?
3. AC3 "[AC text]" — did this pass? (This covers the error path — was the failure scenario triggered?)

DoD checklist:
4. PR link — please share or confirm it is linked in the Story
5. Regression — were [related Story PROJ-YYY] and [PROJ-ZZZ] re-tested to confirm no regressions?

UI (if applicable):
6. Visual match — does the implemented screen match [Specs UI link, screen name]?
7. States — were the loading, empty, and error states tested?

I'm already assuming:
- Unit tests: [if dev agent left a test output comment] — showing green, treating as pass — correct me if failures were seen
- Tech Lead review: PR shows Approved on [date] — treating as reviewed
```

Wait for the user's answers before proceeding to validation.

---

## Step 3 — Validate systematically

After collecting test results, run through the full validation checklist.

### AC validation

For each AC:
- **Pass** — evidence provided, criterion met, no deviations
- **Partial** — criterion met in happy path but not in edge case or error path
- **Fail** — criterion not met, or not tested at all

Any AC that is Partial or Fail → the Story cannot be signed off.

### DoD validation

Check each DoD item:
- Unit tests written and passing → confirm from evidence
- No lint or type errors → confirm from evidence
- PR open and linked → check Jira Story for PR link
- Tech Lead review approved → check PR status
- Tested on correct environment → confirm from interview
- No regressions → confirm from interview
- Specs UI match → confirm from interview (UI Stories only)
- Accessibility checked → confirm from interview (UI Stories only)

Any DoD item unchecked → the Story cannot be signed off.

### Regression check

For each Story in the same Epic that is already Done:
- Was it mentioned in the regression check?
- If a shared component or API was modified, flag it: "This Story touched [component/endpoint] which is also used by [PROJ-YYY]. Was PROJ-YYY re-tested?"

### Produce the validation report

```
Validation Report — [PROJ-XXX] — [date]

AC Results:
- AC1: ✅ Pass — [evidence summary]
- AC2: ✅ Pass — [evidence summary]
- AC3: ❌ Fail — error state not tested, no evidence provided

DoD Results:
- ✅ Unit tests passing
- ✅ No lint errors
- ✅ PR open and linked: [PR link]
- ✅ Tech Lead review approved
- ❌ Regression check: PROJ-YYY not retested after shared component change
- ✅ Specs UI match confirmed
- ⚠️ Accessibility: keyboard nav not tested

Overall: ❌ NOT signed off — 2 items failed
```

---

## Step 4 — Sign off or create a Bug

### If all ACs pass and all DoD items are checked

**Sign off the Story:**
- Transition the Story to `Done` in Jira
- Add a QA sign-off comment:
```
## QA Sign-off — [date]
Validated by: QA (AI-assisted)
All ACs passed. DoD complete.
Environment tested: [env]
Signed off. ✅
```
- Add label `qa-approved`

### If any AC fails or any DoD item is unchecked

**Do not close the Story.**

For each failure, create a Bug in Jira:

**Bug structure:**
- **Summary:** `[BUG] [Story summary] — [brief failure description]`
- **Description:**
```
## Bug report — [date]
Linked Story: [PROJ-XXX]
Found during: QA validation (skill 10)

## What failed
AC / DoD item: [which one]
Expected: [what the AC or DoD item requires]
Actual: [what was observed or missing]
Environment: [where tested]

## Steps to reproduce (if AC failure)
1. [step]
2. [step]
3. [observed result]

## Severity
[ ] Critical — blocks release
[ ] Major — significant user impact
[ ] Minor — cosmetic or edge case
```
- **Labels:** `bug`, `[project-slug]`, `[Epic slug]`
- **Linked to:** Story [PROJ-XXX] (link type: "is blocked by" or "caused by")
- **Status:** `To Do`

**Transition the Story back:**
- Move the Story from `In Review` / `Done` back to `In Progress`
- Add a comment on the Story:
```
## QA validation failed — [date]
Returned to In Progress.
Bugs created: [list Bug keys]
The dev agent must address all linked bugs before re-submitting for QA.
```

---

## Step 5 — Resume logic

If this skill is re-run on a Story:
- Re-read the Story's current state in Jira — check if previously linked Bugs have been resolved
- For each Bug linked to this Story: check its status (Done / To Do / In Progress)
- Only re-validate ACs that were previously failed or linked to an open Bug
- ACs that passed in a previous run and whose code has not changed: carry over the pass result and note it
- Re-run the full DoD checklist regardless — state can change between runs
- If all Bugs are now resolved and all ACs pass: proceed to sign-off

---

## Step 6 — Advise on next steps

### If signed off

```
✅ Story [PROJ-XXX] signed off and closed.

👉 Next actions:
- If all Stories in Epic [PROJ-YYY] are now Done: the Epic can be closed — check in Jira
- If this was the last Story in the sprint: run skill 11 (agile_11_retro) to document the retrospective and plan the next iteration
- If there are more Stories in the sprint still In Progress: continue with dev agents
```

### If bugs created and Story returned

```
❌ Story [PROJ-XXX] returned to In Progress.
[N] bugs created: [list keys]

⚠️ Dev agent action required:
- Fix all linked bugs: [list keys with one-line descriptions]
- Re-submit the Story for QA (move to In Review)
- Then re-run skill 10 to re-validate

👉 Once all Stories in the sprint are Done:
   Run skill 11: agile_11_retro to close the sprint and plan the next iteration.
```

---

## Principles (apply to every run)

- **Never assume a pass without evidence** — every AC requires confirmation; absence of failure is not a pass
- **Every DoD item is checked, every run** — DoD is not carried over from previous runs without re-confirmation
- **Bugs are created per failure, not per Story** — one AC failure = one Bug; multiple failures = multiple Bugs
- **Story never self-closes** — only QA (this skill) transitions a Story to Done
- **Specs UI deviations are flagged, not auto-rejected** — a deviation may be intentional; ask before failing
- **Ask before concluding** — always collect test results before producing the validation report
- **Group questions by area** — AC questions, DoD questions, UI questions in separate groups
- **Idempotent** — re-running re-checks only failed or unvalidated items; does not re-open passed ACs
- **Resumable** — re-running re-reads live Jira Bug statuses and carries over previously passed ACs
- **Transparent assumptions** — any inferred pass (from test output or PR status) is stated explicitly
- **Regression is mandatory** — shared components and modified endpoints must be retested in related Stories
