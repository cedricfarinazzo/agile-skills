---
name: agile-12-tech-debt-sweep
description: "End-of-sprint housekeeping before closeout: audit cross-repo leakage, useless CI, prebuild-image wins, CLAUDE.md/SKILL.md cruft, misplaced artifacts, dead code. Report before apply. Triggers: tech debt sweep, cleanup sweep, housekeeping, /tech-debt-sweep. Before agile-13-sprint-closeout."
---

# agile_12_tech_debt_sweep

Audit the consumer repo for low-value drift accumulated during the sprint: report findings by category, get explicit approval, apply behaviour-preserving fixes, file cross-repo follow-ups.

**Runs before `agile-13-sprint-closeout`** — closeout's smoke replays the user flow described in `CLAUDE.md`, so it needs a clean repo and an accurate `CLAUDE.md`. Sweeping *after* closeout would invalidate the closeout's signal.

**Goal:** every finding is either fixed in place with no behaviour change, moved to its correct home repo, or filed as a tracked follow-up — so the sprint enters closeout with no obvious cruft, no CI workflows burning minutes for nothing, no personal tags leaked into project sources, and no Dockerfiles rebuilding stable content every run.

**Non-goals:** rewriting business logic, adding features, refactoring for taste, changing test or CI semantics. **Behaviour preservation is the hard rule** — every approved change must be a no-op for the runtime and the test suite.

**Input:** none required. Optionally scope to one bucket: `leakage` / `claude-md` / `ci` / `docker` / `misplacement` / `dead-code`.

## Phase 0 — Inventory

Read the repo end-to-end — root and sub-folder `CLAUDE.md` / `AGENTS.md`, `.github/workflows/`, `docker/**`, `docker-compose*.yml`, every `SKILL.md` under `.claude/skills/` — and build a one-line manifest per category so the report is grounded in actual files rather than assumptions.

## Phase 1 — Audit (six categories, all run by default)

### A — Cross-repo / personal leakage

Tracked project files must not carry: **personal workflow tags** in TODOs (`TODO(<owner-handle>)`, `TODO(<persona-tag>)`); **personal style or compression modes** in `CLAUDE.md` ("always reply in `<style-name>` mode") — those are agent-side preferences, not project conventions; **personal skill names** (`agile-13-sprint-closeout`, custom slash-commands) that live in plugin repos and are not installed for every contributor; or **owner-specific URLs, cloudIds, tokens, and project keys** outside their natural homes.

Build the tag list from the owner's actual agent/persona vocabulary before grepping:

```bash
grep -rni --include='*.md' --include='*.py' --include='*.ts' --include='*.tsx' \
  --include='*.yml' --include='*.yaml' --include='*.toml' --include='*.json' --include='*.sh' \
  -E '<tag1>|<tag2>|<cli-wrapper>|<owner-cloudId>' . \
  | grep -v '.venv' | grep -v node_modules | grep -v '\.git/' | grep -v '\.claude/'
```

Fixes: `TODO(<owner-tag>): …` → `TODO: …`; a named style mode → the neutral behaviour it describes ("concise; drop articles, filler, hedging"); "run `<personal-skill>` before X" → the action it performs ("run the end-of-sprint closeout gate before retro").

### B — `CLAUDE.md` / `SKILL.md` cruft

Read every one in full and flag: **stale tree comments** contradicting current code (an annotation says "stub" where the file is now the full implementation); **duplicate stack tables** where a sub-folder re-lists rows already in the root (collapse to sub-only deps plus a pointer); **per-test bash blocks enumerating the same env block** with one filename swapped (replace with one canonical block plus "swap the path for a single file" — every former command is still producible); **trivial subsections restating root invariants**; **verbose multi-line `description:` frontmatter** where siblings use one line (compress, keeping all triggers verbatim); and **dead refs** to deleted files, moved scripts, or retired tickets.

**Rule:** a removed line must be duplicated elsewhere, stale, or trivially derivable from a line that remains. **Never remove a battle-fought gotcha, an architecture invariant, or a test convention.**

### C — Useless CI workflows

Workflows that cure consequences rather than causes, whose policy is already stated in `CLAUDE.md`. Symptoms: it only posts a comment or adds a label nothing downstream consumes; its rule is already in `CLAUDE.md` where the author, reviewer, and agent all read it at PR-creation time; it runs on every `synchronize` event burning runner minutes with no merge-blocking effect. *(Case study: a "doc-only PR touches generated artifact" warning workflow — the same rule is one bullet in root `CLAUDE.md`.)*

**Fix:** delete the workflow, strengthen the matching `CLAUDE.md` bullet with specifics (the file globs it covers, the 2–3 action options), and confirm no orphan labels or comments dangle (`gh label delete` where the workflow created one).

### D — Heavy Docker rebuilds → prebuild candidates

Read every `Dockerfile` and every compose `build:` block, looking for layers that compile or download stable third-party tools (a C library, a CLI binary, browser bundles, native bindings) on every CI run, take >20s, and are invalidated by source changes that have nothing to do with them.

Each is a candidate for extraction into the org's shared docker-images repo: a new `<image-name>/` folder at that repo's root with a `Dockerfile` parameterised by axes and multi-arch via `TARGETARCH`, `versions.json`, `package.json`, `.releaserc.json`, `README.md`, and `.github/workflows/build-<image-name>.yml` — then registered in the root `package.json` workspaces, the README images table, and the `CLAUDE.md` layout. **Copy a working sibling image verbatim as the template and SHA-pin every `uses:`** rather than inventing a pattern.

**Skip rule** — extraction is only worth it when the layer is genuinely stable (changes ≤ monthly), saves ≥20s per CI run, **and** is reusable by at least one other project. Otherwise it is complexity displacement.

**The downstream swap is deferred.** Replacing the consumer's `build:` block with `image: ghcr.io/<owner>/<image-name>:<tag>` must wait until the image is actually published, or compose pull fails. File it as a one-line follow-up ticket.

### E — Misplaced artifacts

Things living in the consumer repo that belong elsewhere: **plugin skills bundled into an app repo** (move to the plugin repo, add to the marketplace, delete or leave thin wrappers); **generalizable scripts hardcoded to one project** (a sprint audit script with `project = PROJ` baked into its JQL — generalise via args/env, move beside the skill that calls it); **workflow docs and playbooks** that are execution conventions rather than project-specific.

After each move, grep the consumer repo for residual references (the filename *and* the documented invocation) and either rewrite them to the new home or delete them as stale.

### F — Dead / slop source code

Scan tracked **source** (docs are category B). Every finding needs **evidence of deadness, not a hunch**: **unreferenced exports, functions, or files** proven by unused-export tooling or a repo-wide grep returning only the definition — a new file a story added but never wired is the common case; **commented-out blocks**; **dead branches and flags** (a flag now always one value, an `if` on a constant, a branch an earlier change made unreachable); **superseded or duplicated helpers**; **unused dependencies**.

**Fix = delete** — removing code nothing reaches is a no-op, confirmed by the full test and lint suite afterwards. **Never delete on a weak signal:** a public API, plugin entrypoint, migration, or test fixture may be reached only by reflection, config, dynamic import, or a CI runner, so "no callers" from a grep is necessary but not sufficient. When a symbol is reachable non-statically, leave it and note why. Anything that changes behaviour at all is out of scope — file it as a refactor ticket.

## Phase 2 — Report before apply

One Markdown report across all six categories, each finding row carrying file path, line range, what is wrong, the proposed fix, and a behaviour-preservation note; plus total lines saved and cross-repo moves.

**Nothing is applied before the user approves — this is the hard gate.** Applying is destructive (deleting files, dropping workflows, moving artifacts between repos), so a wrong call loses work. "Apply A and C only, skip B" is a valid response, so structure the report to be approved per category.

```markdown
# Tech debt sweep — report

## A — Cross-repo / personal leakage      | File:line | Issue | Fix |
## B — CLAUDE.md / SKILL.md cruft         | File:line | Issue | Lines saved | Fix |
## C — Useless CI workflows               | Workflow | Why useless | Replacement |
## D — Prebuild image candidates          | Layer | Rebuild cost per CI run | Target image | Notes |
## E — Misplaced artifacts                | Source | Target repo | Notes |
## F — Dead / slop source code            | File:line | Kind | Evidence (why dead) | Fix |

## Summary
- N findings across 6 categories · lines saved ~X · CI minutes saved per run ~Y · cross-repo moves: [list]

Approve which categories to apply.
```

**Skip categories the repo does not have** — a single-language repo with no Docker makes D N/A; no bundled plugin skills makes E N/A. **Report the skip explicitly** so the user knows you checked.

## Phase 3 — Apply approved changes

Only the approved categories, **one commit per category per repo** so a reviewer can revert one bucket without unwinding the sweep.

- **A / B / C** — in-repo edits and deletes. Lint the touched files and verify tests still parse (`pytest --collect-only`, `tsc --noEmit`).
- **D** — scaffold the image in the shared docker-images repo only. **Do not touch the consumer's `docker-compose.yml`**; file the post-publish swap ticket instead.
- **E** — move to the target repo, then grep the consumer for residual references and rewrite or delete them. **Cross-repo moves are two commits, not one:** the target repo gets the artifact and its plumbing first, and the consumer-side deletion lands separately so the move is independently reviewable.
- **F** — delete the dead code and its orphaned imports, then run the **full** lint + unit + integration suite, not just the touched files. A false "dead" call turns red here: if anything breaks, it was not dead — revert and re-classify.

## Phase 4 — Hand-off

Per-repo commit list; the cross-repo PR order ("docker-images PR first → wait for `<image>-v1.0.0` → then the consumer swap PR"); follow-up tickets filed; and a note that `agile-13-sprint-closeout` may now proceed.

## Work discovered mid-phase — do it, or ticket it properly

Every phase discovers work its ticket did not plan for. Two decisions, in order, and neither of them is "leave it in a comment":

**1. Do it now, or file it?**
- **Trivial and inside the current scope** → do it here. A one-line correction or a stale comment beside code you are already editing does not need its own ticket; filing one costs more than the fix.
- **Anything else** → a follow-up ticket: non-trivial, carrying risk, needing its own review, or reaching into files this work does not own. Never silently widen the diff to absorb it, and never let it survive only as prose in a PR body.

**2. Which backlog does it enter?**
- **The current sprint** — it blocks the sprint goal, it is a must-have, or a human asked for it.
- **The product backlog** — everything else, and this is the default. Pulling work into a running sprint is a scope change, not a convenience.

**Point it at creation.** A ticket minted mid-phase never passes back through the refinement skill, so if it is not sized here it is never sized at all, and the sprint's velocity figure silently stops describing the work delivered. Use the project's normal estimation scale; if it truly cannot be sized yet, label it `unsized` with a one-line reason rather than leaving the field empty by default.

## Stop conditions

- A finding would require deleting a battle-fought gotcha or an architecture invariant to "simplify" — surface it, never auto-delete.
- A cross-repo move would orphan a reference the consumer cannot easily rewrite — stop and ask rather than going half-way.
- A prebuild extraction would change runtime behaviour, not just build location — it is no longer a behaviour-preserving sweep; file it separately.

## When NOT to use

A mid-sprint check-in (this runs after the last story merged and before closeout); a one-line `CLAUDE.md` tweak (just edit it); or a greenfield repo, where the categories do not yet apply.

**The report is read by humans and drives destructive actions, so its prose stays in normal English full sentences regardless of any session-level compression mode.**
