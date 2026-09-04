---
name: agile-14-qa-validation
description: "QA validation, confirm-after-merge: Story already Done (merged) — confirm ACs hold on main, stamp sign-off, no transition. Regression → file a Bug, never reopen. Triggers: validate story, QA story, QA check, confirm ACs. After agile-13-sprint-closeout, before skill 15."
---

# agile_14_qa_validation

QA Engineer confirming that a **merged** Story still meets its acceptance criteria, DoD, and design specs on `main`.

**Confirm-after-merge only.** By the time this runs, `agile-11-merge-train` (via `merge-jira-postmortem` at its 3g) already merged the Story and transitioned it to `Done` — usually with `agile-13-sprint-closeout` in between. This skill validates the ACs against `main` and stamps a sign-off; it **never transitions the Story**. On a failure the Story stays `Done` and a regression **Bug** is filed, so the Done audit trail is never reversed.

Classic pre-merge QA (In Review → Done) is deliberately out of scope: merging is owned by `agile-11-merge-train`, which closes the Story. This is the post-merge confirmation gate at sprint close.

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

Read the Story in full (summary, description, ACs, DoD, Specs UI link, technical notes, dependencies, refinement comments). Read the linked PR — expected squash-merged with the branch deleted — and record the merge commit. Follow the Specs UI link, read the Epic for context, and check for Bugs already linked from a previous validation.

**Confirm the Story is `Done` — the only valid entry state**, with the postmortem comment as merge evidence.
- **Not `Done` → stop:** "Story [PROJ-XXX] is [status], not Done. This skill validates already-merged Stories (confirm-after-merge). Run it through `agile-11-merge-train` first — the merge train reviews, merges, and transitions the Story to Done."
- **`Done` with no merge evidence** (no postmortem comment, no linked merged PR) → ask before proceeding; Done may have been set by hand.

Report what you found — the Story, its Epic, its current status and merge commit, the numbered ACs, the DoD checklist, whether the Specs UI link resolved, and any previously linked Bugs.

**Missing Specs UI link on a UI Story → warn, do not stop:** "No Specs UI link on this Story. I'll validate ACs only — visual spec compliance cannot be assessed. Add the link and re-run to complete the visual validation."

## Step 2 — Collect the test results

You confirm behaviour on `main`, so the evidence comes from the user, a test runner, or smoke output.

Per AC: does it hold on `main` (yes / no / partial), **how was it tested** (manual steps, automated test name, screenshot, log output), and **where** (local against `main`, staging, production-like). For the DoD: unit tests passing on `main`, a clean lint/type run, the PR merged and linked, and whether related Stories and flows were retested after the merge. For UI Stories also: the visual match against the Specs UI screen and any deviation, which states were tested (loading, empty, error, success), and whether keyboard navigation and screen-reader behaviour were checked.

**Ask** whenever a test result is missing for any AC (never assume a pass), when the environment is unstated (staging ≠ production-like), or when a Specs UI deviation is observed ("is this intentional — and should the Specs UI be updated?"). **Infer and flag** review + CI from a merged PR with an approving postmortem and green checks, a pass from attached green test output, or a fix from a previously closed Bug — while still verifying the specific AC it covered.

**Never infer a pass without evidence. When in doubt, ask.** Group the questions by area — ACs, DoD, UI — and state every inferred pass explicitly in the same message:

```
To validate Story [PROJ-XXX] on main:

AC results:
1. AC1 "[text]" — does this hold on main? How was it tested?
2. AC3 "[text]" — error path: was the failure scenario triggered?

DoD: 3. Were [PROJ-YYY] and [PROJ-ZZZ] retested after merge?
UI:  4. Does the screen match [Specs UI link]?  5. Were loading / empty / error states tested?

I'm already assuming:
- Unit tests + CI: the merged PR shows green — treating as pass; correct me if failures were seen
- Review: the PR was approved and merged via the merge train
```

## Step 3 — Validate systematically

**Per AC:** **Pass** (evidence provided, criterion met, no deviations) · **Partial** (happy path only — the edge or error path is unmet) · **Fail** (not met, or never tested). **Any Partial or Fail blocks sign-off** and goes to Step 4.

**Per DoD item** — unit tests, lint/type, PR merged and linked, correct environment, no regressions, plus Specs UI match and accessibility for UI Stories. **Any unconfirmed item blocks sign-off.**

**Regression check:** for every already-Done Story in the same Epic, was it covered? If this Story modified a shared component or endpoint, flag it explicitly: "This touched [component] which [PROJ-YYY] also uses — was PROJ-YYY retested?" **Regression checking is mandatory**, not optional.

```
Validation Report (confirm-after-merge) — [PROJ-XXX] — [date]

AC Results:
- AC1: ✅ Pass — [evidence]
- AC3: ❌ Fail — error state not tested, no evidence provided

DoD Results:
- ✅ Unit tests · ✅ Lint · ✅ PR merged: [link] · ✅ Specs UI match
- ❌ Regression: PROJ-YYY not retested after shared component change
- ⚠️ Accessibility: keyboard nav not tested

Overall: ❌ NOT signed off — 2 items failed
```

## Step 4 — Sign off, or file a regression Bug

**All ACs pass and every DoD item confirmed:** do **not** transition and do **not** reopen — the Story is already `Done`. Add label `qa-approved` and the sign-off comment, referencing the closeout report if `agile-13-sprint-closeout` already ran, so the chain of evidence is complete:

```
## QA Sign-off (confirm-after-merge) — [date]
Validated by: QA (AI-assisted)
All ACs confirmed on main. DoD complete.
Environment tested: [env]
Sprint closeout reference: [link]
Signed off. ✅
```

**Any AC fails or any DoD item is unconfirmed** — this is a **post-merge regression**, not a reopen. **Never move the Story back to In Progress**: transitioning a Done Story backwards loses the closed audit trail and breaks the merge-train invariant. Leave it `Done`, label it `qa-regression`, and file a **new Bug per failure** — one AC failure is one Bug — linked to the Story (`is caused by`) and to the Epic. The Bug is the unit of remaining work: it enters the next sprint and follows the normal `agile-11-merge-train` path.

```
Summary: [BUG] [Story summary] — [brief failure description]
Labels: bug, [project-slug], [epic-slug]   ·   Status: To Do   ·   Linked: [PROJ-XXX] (is caused by)

## Bug report — [date]
Linked Story: [PROJ-XXX] · Found during: QA validation (confirm-after-merge, skill 14)

## What failed
AC / DoD item: [which] · Expected: [what it requires] · Actual: [what was observed] · Environment: [where]

## Steps to reproduce (AC failures)
1. … 2. … 3. [observed result]

## Severity
[ ] Critical — blocks release   [ ] Major — significant user impact   [ ] Minor — cosmetic or edge case
```

Then comment on the Story: `Story remains Done on main; regression Bug(s) filed instead of reopening. Regression bugs: [keys] — linked via "is caused by". Next: they enter the next sprint via agile-11-merge-train.`

**A Specs UI deviation is flagged, not auto-failed** — it may be intentional; ask before failing it.

## Step 5 — Resume logic

Re-read the Story's live state and the status of every linked regression Bug. **Re-validate only ACs that previously failed or have an open Bug**; carry over an earlier pass whose code has not changed, noting that you did. **Re-run the full DoD checklist regardless** — that state changes between runs. All Bugs resolved and all ACs passing → proceed to sign-off.

## Step 6 — Advise

```
✅ Story [PROJ-XXX] signed off (confirmed already-Done on main).
👉 Next: if every Story in Epic [PROJ-YYY] is Done + signed off, the Epic can be closed.
   Once every sprint Story is signed off, run skill 15 (agile_15_retro).
```

```
❌ Story [PROJ-XXX] — post-merge regression. Story remains Done; [N] Bugs filed: [keys]
⚠️ They enter the next sprint via agile-11-merge-train; re-run skill 14 after they merge to re-confirm.
```

## Principles

- **Confirm-after-merge only** — never transition, never reopen.
- **Never assume a pass without evidence** — the absence of a failure is not a pass, and every inferred pass is stated explicitly.
- **The full DoD checklist re-runs every run** — an AC pass may be carried over when the code has not changed (say so); a DoD item never is.
- **Post-merge regressions become Bugs, one per failure** — the Story stays Done with a `qa-regression` label.
