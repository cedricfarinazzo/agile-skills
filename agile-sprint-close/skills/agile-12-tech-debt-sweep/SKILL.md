---
name: agile-12-tech-debt-sweep
description: "End-of-sprint housekeeping before closeout: audit cross-repo leakage, useless CI, prebuild-image wins, CLAUDE.md/SKILL.md cruft, misplaced artifacts. Report before apply. Triggers: tech debt sweep, cleanup sweep, housekeeping, /tech-debt-sweep. Before agile-13-sprint-closeout."
---

# agile_12_tech_debt_sweep

Audit the consumer repo for low-value drift that accumulated during the sprint. Report findings grouped by category, get explicit approval, apply behavior-preserving fixes, file cross-repo follow-ups. Runs **before** `agile-13-sprint-closeout` so the smoke gate runs on a clean repo.

## Goal & non-goals

**Goal:** every finding either (a) gets fixed in-place without behavior change, (b) gets moved to its correct home repo, or (c) gets filed as a tracked follow-up. The sprint enters closeout with no obvious cruft, no useless CI workflows burning minutes, no personal/agent tags leaked into project sources, no Dockerfiles rebuilding stable content every CI run.

**Non-goals:** rewriting business logic; introducing new features; refactoring code for taste; changing test or CI behavior. Behavior preservation is the hard rule — every approved change must be a no-op for the runtime + test suite.

## Input

No args required. Optional: focus area (`leakage` / `claude-md` / `ci` / `docker` / `misplacement`) to scope the audit to one bucket instead of all five.

## Phase 0 — Inventory

Read the repo's structure end-to-end (project root + all sub-folder `CLAUDE.md` / `AGENTS.md`, `.github/workflows/`, `docker/**`, `docker-compose*.yml`, all `SKILL.md` files under `.claude/skills/`). Build a one-line manifest per category so the report is grounded in actual files, not assumptions.

## Phase 1 — Audit (5 categories, all run by default)

### Category A — Cross-repo / personal leakage

Project source files (anything tracked in git) must not reference:

- **Personal workflow tags** in TODO comments (e.g. `TODO(<owner-handle>)`, `TODO(<persona-tag>)`) — agent or owner private tags that confuse contributors. Build the project-specific tag list from the owner's known agent / persona vocabulary before grepping.
- **Personal style / compression modes** in `CLAUDE.md` (e.g. "use `<terse-mode>` style", "always reply in `<style-name>` mode", refs to agent-side compression dialects) — these are agent-side personal preferences, not project conventions.
- **Personal skill names** in project `CLAUDE.md` (e.g. `agile-13-sprint-closeout`, `agile-15-retro`, custom slash-commands) — these live in plugin repos and are not installed for every contributor. Either rewrite as workflow-neutral guidance ("run end-of-sprint closeout gate before retro") or delete.
- **Owner-specific URLs / cloudIds / tokens / project keys** sprinkled outside their natural homes (e.g. hardcoded Jira `cloudId` in random workflows; project-specific issue prefixes baked into shared scripts).

**Grep recipe (substitute the alternation list with the consumer's actual personal vocabulary — owner tags, persona names, compression / style modes, custom CLI wrappers, personal skill names, hardcoded owner cloudId / handle / email):**

```bash
grep -rni --include='*.md' --include='*.py' --include='*.ts' --include='*.tsx' \
  --include='*.yml' --include='*.yaml' --include='*.toml' --include='*.json' \
  --include='*.sh' \
  -E '<tag1>|<tag2>|<cli-wrapper>|<owner-cloudId>' . \
  | grep -v '.venv' | grep -v node_modules | grep -v '\.git/' | grep -v '\.claude/'
```

**Fix patterns:**

- `TODO(<owner-tag>): ...` → `TODO: ...`
- "<terse-style-name> style" → "concise; drop articles, filler, hedging"
- "run `<personal-skill-name>` before X" → "run X (the action it does) before Y" — neutral

### Category B — `CLAUDE.md` / `SKILL.md` cruft

Read every `CLAUDE.md` / `AGENTS.md` / `SKILL.md` in full. Flag:

- **Stale tree comments** — file annotations that contradict current code (e.g. tree says "stub" but file is the full implementation; file annotations referencing stories that have shipped + reshaped the file).
- **Duplicate stack tables** — sub-folder `CLAUDE.md` re-listing rows already in root `CLAUDE.md` Stack table. Collapse sub to the sub-only deps + one-liner pointer to root.
- **Per-test bash blocks enumerating the same env block** with one filename swap (a common pattern in test-suite `CLAUDE.md`). Replace with **one canonical env block** + a one-liner "swap path for single file". Behavior-preserving — every former command is still producible.
- **Trivial subsections** that restate root invariants (e.g. backend `CLAUDE.md` Environment section saying "secrets via `.env`" when root invariant #N already locks it).
- **Pre-existing skill output cruft** — verbose multi-line `description:` frontmatter on a skill when sibling skills use single-line descriptions. Compress to one line, keep all triggers verbatim.
- **Dead refs** to deleted files / moved scripts / retired tickets.

**Rule:** any line removed must be either (a) duplicated elsewhere, (b) stale (contradicts current code), or (c) trivially derivable from a remaining line. Never remove a battle-fought gotcha, never remove an architecture invariant, never remove a test convention.

### Category C — Useless CI workflows

Identify workflows that **cure consequences, not causes** and whose policy is already stated in `CLAUDE.md`. Symptoms:

- Workflow only posts a comment / adds a label that no downstream automation consumes.
- Workflow's enforcement is a rule already in `CLAUDE.md` that the author + reviewer + agent would have read at PR creation time.
- Workflow runs on every PR `synchronize` event, burning self-hosted runner minutes / GitHub Actions minutes on a check that has no merge-blocking effect.

**Case study:** a "doc-only PR touches generated artifact" warning workflow — same rule could be a single bullet in root `CLAUDE.md`, no CI needed.

**Fix:** delete the workflow file, strengthen the matching `CLAUDE.md` bullet (be specific: list the file globs the rule covers + the 2-3 action options). Confirm no orphan labels / comments left dangling (manual `gh label delete` if needed).

### Category D — Heavy Docker rebuilds → prebuild candidates

Read every `Dockerfile` in `docker/` plus all `build:` blocks in `docker-compose*.yml`. For each, identify layers that:

- Compile / download stable third-party tools (TA-Lib C lib, Apollo Rover binary, Playwright browsers, native bindings) every CI run.
- Take >20s to build and are invalidated by source-only changes that have nothing to do with them.

Each such layer is a candidate for extraction into the **shared docker-images repo** (canonical pattern: `cedricfarinazzo/docker-images`). Recipe per image:

1. New folder at repo root: `<image-name>/`
2. `Dockerfile` parameterized by axes (versions, distros), multi-arch via `TARGETARCH`
3. `versions.json` with axes + defaults
4. `package.json`, `.releaserc.json`, `README.md` (copy a sibling image as template)
5. `.github/workflows/build-<image-name>.yml` (copy a sibling, retarget axes, SHA-pin every `uses:`)
6. Register workspace in root `package.json`; add row to root `README.md` images table + bullet in `CLAUDE.md` Layout

**Downstream swap:** in the consumer repo, replace the `build:` block in `docker-compose.yml` with `image: ghcr.io/<owner>/<image-name>:<tag>` and delete the local `Dockerfile`. **Defer this swap** until the image is actually published on ghcr — otherwise compose pull fails. File the swap as a one-line follow-up ticket.

**Skip rule:** an image candidate is only worth extracting if (a) the layer is genuinely stable (changes ≤monthly), (b) build time saved per CI run is meaningful (≥20s), and (c) the image is reusable across at least one other project — otherwise it's just complexity displacement.

### Category E — Misplaced artifacts

Files / scripts / skills that live in the consumer repo but logically belong elsewhere:

- **Plugin skills bundled with the consumer repo** (e.g. `.claude/skills/dev-*` shipped inside an app repo) → move to the dedicated plugin repo, add to plugin marketplace, delete locals (or leave as thin wrappers).
- **Generalizable scripts** scoped to one project (e.g. a sprint-shared-file-audit script with hardcoded `project = FIN` JQL) → generalize via args / env, move alongside the skill that calls it in the plugin repo, delete from consumer.
- **Workflow docs / playbooks** that are project-execution conventions, not project-specific → move to the plugin repo where the skill lives, delete from consumer.

For each: verify nothing in the consumer repo references the moved artifact post-move (grep for the filename + the documented invocation). If references exist, decide: rewrite to the new home (plugin path), or delete the now-stale reference.

## Phase 2 — Report before apply (MANDATORY)

Produce a single Markdown report covering all five categories. Per finding row: file path, line range, what's wrong, proposed fix, behavior preservation note. Total line count saved + cross-repo moves summarised.

**Do not apply anything before the user approves.** This is the hard gate — apply == destructive (deletes files, moves artifacts to other repos, drops workflow files). Wrong call here = lost work. The report is read by a human + sometimes batched: "apply A and C only, skip B" is a valid response.

Report template:

```markdown
# Tech debt sweep — report

## A — Cross-repo / personal leakage
| File:line | Issue | Fix |
|---|---|---|
| `path:N` | `TODO(personal-tag)` | strip tag |
| `CLAUDE.md:N` | `<terse-style-name>` style ref | rewrite neutral |

## B — CLAUDE.md / SKILL.md cruft
| File:line | Issue | Lines saved | Fix |
|---|---|---|---|

## C — Useless CI workflows
| Workflow | Why useless | Replacement |
|---|---|---|

## D — Prebuild image candidates
| Layer | Rebuild cost per CI run | Target image | Notes |
|---|---|---|---|

## E — Misplaced artifacts
| Source | Target repo | Notes |
|---|---|---|

## Summary
- N findings across 5 categories
- Lines saved (CLAUDE.md / SKILL.md): ~X
- CI minutes saved per run: ~Y (after C + D applied)
- Cross-repo moves: list

Approve which categories to apply.
```

## Phase 3 — Apply approved changes

Only for the categories the user approved. Per category:

- **A / B / C:** in-repo edits + deletes. Run lint (`ruff` / `biome` / project linter) on touched files. Verify tests still parse (`pytest --collect-only` for Python, `tsc --noEmit` for TS).
- **D:** scaffold the new image in the shared docker-images repo (Dockerfile + versions.json + package.json + .releaserc.json + README.md + build-<image>.yml workflow + register in root `package.json` workspaces + README + CLAUDE.md Layout). **Do not modify the consumer's `docker-compose.yml`** — image must be published first; file a one-line follow-up ticket for the post-publish swap.
- **E:** move-to-target-repo edits. After move, grep consumer repo for residual references to the moved artifact and either rewrite (to new home) or delete (if dead).

Run the full lint suite + `git status` after each category. Commit per category (one commit per approved bucket, scoped per repo touched).

## Phase 4 — Hand-off

Final summary message:

- Per-repo commit list (consumer + each cross-repo destination)
- Cross-repo PR list (which repos need separate PRs, in what order — e.g. "docker-images PR first → wait for `<image>-v1.0.0` to ship → then consumer swap PR")
- Follow-up tickets filed (e.g. "FIN-XX: swap rover service to prebuilt image after rover-v1.0.0 publishes")
- Note that `agile-13-sprint-closeout` may now proceed

## Rules

- **Behavior preservation is non-negotiable.** Every approved change must be a no-op for runtime + tests + CI semantics. Removing duplicated lines that produce the same content elsewhere = OK. Removing a battle-fought gotcha = NOT OK.
- **Report before apply, always.** This skill never auto-applies — destructive operations (file delete, workflow delete, cross-repo move) require explicit per-category approval.
- **Cross-repo moves are atomic across two commits, not one.** Target repo gets the new artifact + its plumbing first; consumer-repo deletion + reference rewrites land in a separate commit so the move is reviewable independently.
- **Deferred swaps for D.** When extracting a Dockerfile to a prebuilt image, the consumer's `docker-compose.yml` swap is a **follow-up ticket**, not part of this sweep. The image must exist on the registry before the swap can land — file the ticket and let the normal sprint flow handle it.
- **Use sibling-image templates verbatim for D.** Copy an existing `build-<sibling>.yml` workflow + Dockerfile + versions.json + package.json + .releaserc.json + README from a working image in the docker-images repo. SHA-pin every `uses:` (Renovate keeps them current). Do not invent a new pattern.
- **One commit per approved category per repo.** Reviewers can revert a single bucket without unwinding the whole sweep.
- **Run before `agile-13-sprint-closeout`.** Closeout's dev-stack smoke depends on a clean repo + accurate `CLAUDE.md` (smoke-test selects the user flow described there). Running this sweep after closeout would invalidate the closeout's signal.
- **Skip categories the consumer repo doesn't have.** Single-language repo with no Docker → D is N/A. Project with no plugin-side skills bundled locally → E is N/A. Report the skip explicitly so the user knows you checked.
- **Audit report prose stays in normal English regardless of session-level compression modes.** The report is read by humans + drives destructive actions; full sentences avoid ambiguity.

## Stop conditions

- A finding requires deleting a battle-fought gotcha or architecture invariant to "simplify" — surface to user, never auto-delete.
- A cross-repo move would orphan a reference the consumer repo can't easily rewrite — stop, ask, do not proceed half-way.
- A prebuild image extraction would require also changing the runtime behavior (not just build location) — stop, this is no longer a behavior-preserving sweep, file as a separate ticket.

## When NOT to use

- Mid-sprint check-in. This is end-of-sprint pre-closeout — run **after** the last story merged + **before** `agile-13-sprint-closeout`.
- A quick CLAUDE.md tweak. Use direct edits for one-line changes; this skill is for the full 5-category sweep.
- A new-repo scaffold. This skill assumes an established repo with accumulated drift; for greenfield repos the categories don't apply.
