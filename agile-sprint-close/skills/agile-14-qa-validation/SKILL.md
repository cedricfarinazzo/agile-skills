---
name: agile-14-qa-validation
description: "QA validation, confirm-after-merge: Story already Done (merged) — confirm ACs hold on main, stamp sign-off, no transition. Regression → file a Bug, never reopen. Triggers: validate story, QA story, QA check, confirm ACs. After agile-13-sprint-closeout, before skill 15."
---

# agile_14_qa_validation

You are acting as a QA Engineer confirming that a **merged** Story still meets its acceptance criteria, definition of done, and design specs on `main`.

This skill runs **confirm-after-merge** only: by the time it runs, the Story was already merged and transitioned to `Done` by `agile-11-merge-train` / `dev-jira-postmortem` (usually after `agile-13-sprint-closeout`). QA validates the ACs against `main` and stamps a sign-off comment — it does **not** transition the Story. If a failure is found, the Story stays `Done` and a regression **Bug** is filed; the Done audit trail is never reversed.

> Classic pre-merge QA (transition In Review → Done) is intentionally out of scope here — merging is owned by `agile-merge-review` (`agile-11-merge-train`), which closes the Story. This skill is the post-merge confirmation gate that runs at sprint close.

Your job is to:
1. **Scan** Jira for the target Story and read everything relevant to validate it
2. **Interview** the user for test results and any observations not captured in Jira
3. **Validate** each AC, DoD item, and Specs UI match systematically against `main`
4. **Sign off** the Story or **file a regression Bug** (never reopen)
5. **Advise** on what to do next

---

## Confluence structure (canonical — identical across all agile-skills)

All project docs live under one root folder created by `agile-1`. The **Roadmap is a short index** — deep detail lives in its `MVP` / `Iteration N` child pages, never inlined into the Roadmap itself.

```
📁 [Project Name]                   (root — agile-1)
├── 📄 Vision Doc — [Project]       (agile-1)
├── 📄 PRD — [Project]              (agile-2)
├── 📄 Design Brief — [Project]     (agile-3 BRIEF)
├── 📄 Specs UI — [Project]         (agile-3 INTEGRATE)
├── 📄 ADR — [Project]              (agile-4)
├── 📄 Roadmap — [Project]          (agile-5 — SHORT INDEX: guiding principle + iterations index table + progress rollup + parking lot)
│   ├── 📄 MVP — [Project]          (agile-5; per-sprint detail by agile-9, refined backlog by agile-8)
│   ├── 📄 Iteration 1 — [Project]  (agile-5 ITERATION)
│   └── 📄 Iteration N — [Project]
├── 📁 Retrospectives — [Project]   (folder, agile-15; one Retro page per sprint)
└── 📁 Closeouts — [Project]        (folder, agile-13-sprint-closeout — sibling of Retrospectives, NOT inside it)
```

Read this tree before creating any page: every page is a child of the root (MVP / Iteration pages are children of Roadmap). Never duplicate a page that already exists; never nest Retrospectives/Closeouts inside each other.

---

## Step 1 — Scan existing state

Use Atlassian tools to:
- Read the target Story in Jira in full: summary, description, AC, DoD, Specs UI link, technical notes, dependencies, refinement comments
- **Confirm the Story is `Done`** (the only valid entry state). The Story was merged by `agile-11-merge-train` (which auto-transitions to Done via `dev-jira-postmortem` 3g). Look for the postmortem comment on the Story as confirmation of merge.
  - If the Story is **not `Done`** → stop: "Story [PROJ-XXX] is [status], not Done. This skill validates already-merged Stories (confirm-after-merge). Run it through `agile-11-merge-train` first — the merge train reviews, merges, and transitions the Story to Done."
  - If the Story is `Done` but there is **no merge evidence** (no postmortem comment / linked merged PR) → ask the user before proceeding; Done may have been set manually.
- Read the PR linked to this Story — it is expected to be squash-merged + branch deleted; record the merge commit.
- Follow the Confluence Specs UI link and read the relevant screen(s)
- Read the Epic to understand the broader context
- Check if any Bugs are already linked to this Story (from a previous validation attempt)

**Report what you found before doing anything:**

```
Validating (confirm-after-merge): [PROJ-XXX] — [Story summary]
Epic: [PROJ-YYY] — [Epic name]
Current status: Done (merged [merge commit / PR])

Acceptance Criteria ([N] total):
- AC1: [text]
- AC2: [text]
- AC3: [text]

Definition of Done ([N] items):
- [ ] All ACs pass
- [ ] Unit tests written and passing
- [ ] No lint or type errors
- [ ] PR opened, reviewed, and merged
- [ ] Tested on [env]
- [ ] No regressions

Specs UI: [link found / not found]

Previous bugs linked: [N bugs / none]
```

**If the Specs UI link is missing on a UI Story:**
- Warn but do not stop: "No Specs UI link found on this Story. I will validate ACs only — visual spec compliance cannot be assessed. Add the Specs UI link and re-run skill 14 to complete the visual validation."

---

## Step 2 — Interview for test results

You confirm behaviour on `main` — rely on the user (or a test runner / smoke output) to provide validation evidence.

### What to collect

For each AC on the Story:
1. **Test result** — Does this AC hold on `main`? (yes / no / partial)
2. **Evidence** — How was it tested? (manual test steps, automated test name, screenshot, log output)
3. **Environment** — Where was it tested? (local against `main`, staging, production-like)

For the DoD checklist:
4. **Unit tests** — Are tests written and passing on `main`? Any test output to share?
5. **Lint / type errors** — Clean run confirmed?
6. **PR** — Confirm the PR is merged and linked to the Story.
7. **Regression check** — Were related Stories or flows tested to confirm no regressions after merge?

For UI Stories specifically:
8. **Visual match** — Does the implemented UI match the Specs UI screen? Any deviations?
9. **States covered** — Were all required states tested? (loading, empty, error, success)
10. **Accessibility** — Was keyboard navigation and screen reader behaviour checked?

### When to ask vs. when to infer

**Ask** when:
- A test result is missing for any AC — do not assume a pass
- The environment tested is not mentioned — staging ≠ production-like; ask which
- A deviation from the Specs UI is observed — ask: "Is this intentional? If yes, should the Specs UI be updated?"

**Infer and flag** when:
- The merged PR + postmortem show review approval and green CI → infer review + CI passed and flag it
- Automated test results are attached as a comment / closeout artifact → infer tests pass if output shows green and flag it
- A previous Bug on this Story was closed → infer it was fixed; still verify the specific AC it covered

**Never infer a pass without evidence. When in doubt, ask.**

### Format for your questions

```
To validate Story [PROJ-XXX] on main, I need the following:

AC results:
1. AC1 "[AC text]" — does this hold on main? How was it tested?
2. AC2 "[AC text]" — any edge cases tested?
3. AC3 "[AC text]" — (error path — was the failure scenario triggered?)

DoD checklist:
4. Regression — were [related Story PROJ-YYY] and [PROJ-ZZZ] re-tested after merge?

UI (if applicable):
5. Visual match — does the implemented screen match [Specs UI link, screen name]?
6. States — were the loading, empty, and error states tested?

I'm already assuming:
- Unit tests + CI: merged PR shows green — treating as pass — correct me if failures were seen
- Review: PR was approved + merged via merge train — treating as reviewed
```

Wait for the user's answers before proceeding to validation.

---

## Step 3 — Validate systematically

After collecting test results, run through the full validation checklist against `main`.

### AC validation

For each AC:
- **Pass** — evidence provided, criterion met, no deviations
- **Partial** — criterion met in happy path but not in edge case or error path
- **Fail** — criterion not met, or not tested at all

Any AC that is Partial or Fail → the Story cannot be signed off; file a regression Bug (Step 4).

### DoD validation

Check each DoD item:
- Unit tests written and passing → confirm from evidence
- No lint or type errors → confirm from evidence
- PR merged and linked → check Jira Story for the merged PR
- Tested on correct environment → confirm from interview
- No regressions → confirm from interview
- Specs UI match → confirm from interview (UI Stories only)
- Accessibility checked → confirm from interview (UI Stories only)

Any DoD item unconfirmed → the Story cannot be signed off.

### Regression check

For each Story in the same Epic that is already Done:
- Was it mentioned in the regression check?
- If a shared component or API was modified, flag it: "This Story touched [component/endpoint] which is also used by [PROJ-YYY]. Was PROJ-YYY re-tested?"

### Produce the validation report

```
Validation Report (confirm-after-merge) — [PROJ-XXX] — [date]

AC Results:
- AC1: ✅ Pass — [evidence summary]
- AC2: ✅ Pass — [evidence summary]
- AC3: ❌ Fail — error state not tested, no evidence provided

DoD Results:
- ✅ Unit tests passing
- ✅ No lint errors
- ✅ PR merged and linked: [PR link]
- ❌ Regression check: PROJ-YYY not retested after shared component change
- ✅ Specs UI match confirmed
- ⚠️ Accessibility: keyboard nav not tested

Overall: ❌ NOT signed off — 2 items failed
```

---

## Step 4 — Sign off or file a regression Bug

### If all ACs pass and all DoD items are confirmed

- Do **NOT** transition (the Story is already `Done`). Do **NOT** reopen.
- Add the QA sign-off comment below — note that validation was confirm-after-merge so the audit trail is clear.
- Add label `qa-approved`.
- If `agile-13-sprint-closeout` ran before this validation, reference it in the comment ("Closeout report: [link]") so the chain of evidence is complete.

**Sign-off comment:**
```
## QA Sign-off (confirm-after-merge) — [date]
Validated by: QA (AI-assisted)
All ACs confirmed on main. DoD complete.
Environment tested: [env]
Sprint closeout reference: [comment id / closeout summary]
Signed off. ✅
```

### If any AC fails or any DoD item is unconfirmed

The Story is already `Done` on `main`. This is a **post-merge regression** — escalate accordingly:
- Do **NOT** move the Story back to In Progress; transitioning a Done story backwards loses the "closed" audit trail and breaks the merge-train invariant. Leave the Story `Done` with a `qa-regression` label and **file a new Bug** linked to the Story (link type: `is caused by`) and to the Epic.
- The Bug becomes the unit of remaining work. It enters the next sprint and follows the normal `agile-11-merge-train` path.
- Add a comment on the original Story noting the regression Bug key.

**Bug structure (one Bug per failure):**
- **Summary:** `[BUG] [Story summary] — [brief failure description]`
- **Description:**
```
## Bug report — [date]
Linked Story: [PROJ-XXX]
Found during: QA validation (confirm-after-merge, skill 14)

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
- **Linked to:** Story [PROJ-XXX] (link type: `is caused by`)
- **Status:** `To Do`

**Story stays Done + comment:**
```
## QA post-merge regression found — [date]
Story remains Done on main; regression Bug(s) filed instead of reopening.
Regression bugs: [list Bug keys] — linked via "is caused by".
Next step: bugs enter the next sprint and follow the normal agile-11-merge-train path.
```

---

## Step 5 — Resume logic

If this skill is re-run on a Story:
- Re-read the Story's current state in Jira — check if previously filed regression Bugs have been resolved
- For each Bug linked to this Story: check its status (Done / To Do / In Progress)
- Only re-validate ACs that were previously failed or linked to an open Bug
- ACs that passed in a previous run and whose code has not changed: carry over the pass result and note it
- Re-run the full DoD checklist regardless — state can change between runs
- If all regression Bugs are now resolved and all ACs pass: proceed to sign-off

---

## Step 6 — Advise on next steps

### If signed off

```
✅ Story [PROJ-XXX] signed off (confirmed already-Done on main).

👉 Next actions:
- If all Stories in Epic [PROJ-YYY] are now Done + signed off: the Epic can be closed — check in Jira
- Once every sprint Story is signed off, proceed to skill 15 (agile_15_retro)
- agile-13-sprint-closeout has usually already run; if not, run it before the retro
```

### If a regression Bug was filed

```
❌ Story [PROJ-XXX] — post-merge regression found. Story remains Done; Bug filed.
[N] regression bugs: [list keys]

⚠️ Action required:
- Bugs enter the next sprint and follow the normal agile-11-merge-train path
- Re-run skill 14 after the bugs are merged to re-confirm

👉 Once all sprint Stories are signed off:
   Run skill 15: agile_15_retro to close the sprint and plan the next iteration.
```

---

## Principles (apply to every run)

- **Confirm-after-merge only** — the Story is already `Done`; this skill confirms ACs on `main`, it never transitions the Story.
- **Never assume a pass without evidence** — every AC requires confirmation; absence of failure is not a pass
- **Every DoD item is checked, every run** — DoD is not carried over without re-confirmation
- **Post-merge regressions become Bugs, never reopens** — leave the Story Done, file a Bug linked `is caused by`, label the Story `qa-regression`. Transitioning Done → In Progress backwards loses the merge audit trail and breaks agile-11-merge-train's invariants.
- **Bugs are filed per failure, not per Story** — one AC failure = one Bug; multiple failures = multiple Bugs
- **Specs UI deviations are flagged, not auto-rejected** — a deviation may be intentional; ask before failing
- **Ask before concluding** — always collect test results before producing the validation report
- **Group questions by area** — AC questions, DoD questions, UI questions in separate groups
- **Idempotent** — re-running re-checks only failed or unvalidated items; does not re-open passed ACs
- **Resumable** — re-running re-reads live Jira Bug statuses and carries over previously passed ACs
- **Transparent assumptions** — any inferred pass (from test output, CI, or PR status) is stated explicitly
- **Regression is mandatory** — shared components and modified endpoints must be retested in related Stories
```
