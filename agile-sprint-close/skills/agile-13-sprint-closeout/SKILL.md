---
name: agile-13-sprint-closeout
description: "Mandatory end-of-sprint epic gate, 3 lenses: engineer (smoke + integration), architect (Confluence specs vs delivered code), tech lead (deep severity-graded review of all sprint diffs). Triggers: sprint closeout, close sprint, /sprint-closeout. After last merge + agile-12-tech-debt-sweep, before retro."
---

# agile_13_sprint_closeout

> **MANDATORY final step of every sprint.** Run after the last story is merged
> to `main`, after `agile-12-tech-debt-sweep` has run, and before invoking
> `agile-15-retro`. The class of bug this skill catches is "all unit +
> integration tests pass + production is broken" — the kind where each
> story-level AC was met in isolation but the wired-together system has a
> silent regression nobody exercised.
>
> **Prerequisite: `agile-12-tech-debt-sweep`** must run first. Closeout's dev-stack
> smoke replays the user flow described in `CLAUDE.md`; the sweep ensures
> `CLAUDE.md` accurately reflects what main looks like (no stale tree comments,
> no useless CI workflows skewing the CI pipeline, no leaked personal tags) +
> any prebuild-image extractions land in their target repo before closeout
> exercises the new stack.

End-to-end gate before declaring a sprint or epic done. Runs **three lenses**:

1. **Engineer** — does the wired-together system actually work on a freshly rebuilt dev stack? (Phases 0–2, 5–6)
2. **Architect / PM** — does the delivered code match the documented intent (Vision Doc, PRD, ADR, Roadmap, epic ACs)? (Phase 3)
3. **Tech Lead** — does the implementation hold up under an impartial deep code review? (Phase 4)

A single Critical finding from any lens blocks closeout.

**This is the third and broadest review layer, by a different role than the per-PR reviews.** The author self-reviewed each change (`implement-review`) and an independent reviewer gated each PR (`merge-review-pr`) — both *per PR*. This is the **global, impartial** pass: whether the *whole sprint, wired together*, is aligned with the sprint/epic goal and the documented product + architecture intent. Different scope (the sprint, not one PR), different question (goal alignment + system-level correctness, not diff correctness). Do not assume the per-PR reviews already covered system-level drift — they couldn't see it.

## Goal & non-goals

**Goal:** every epic-level AC is provably satisfied along three axes — runs on the real stack, matches the documented product/architecture spec, and survives an impartial line-by-line review of the sprint diff.

**Non-goals:** rubber-stamping tickets because their story-level ACs are checked off; trusting integration tests that bypass the broker; skipping the dev-stack smoke because "the CI was green"; deferring to "the author probably had a reason" when reviewing code.

The skill is allowed — and expected — to take 30-60 min. Speed comes from doing this once per sprint instead of finding the bug (or the silent product drift, or the load-bearing dead code) a month later.

## Configuration

Reads from the consumer repo's `CLAUDE.md` / `AGENTS.md`:

- **`cloudId`** — Atlassian cloud id for `mcp__atlassian__*` calls. Required.
- **`confluence-project-root`** — Confluence page id (or title) of the project root folder that contains Vision Doc, PRD, Design Brief, ADR, Roadmap, Retrospectives, Closeouts. Required for Phase 3 + Phase 7 (closeout report publication).
- **`done-status-name`** — project-local name for the Done state (e.g. "Done", "Terminé(e)", "Closed"). Used to assert every child ticket is in the terminal column.
- **Lint / unit / integration commands** — project-specific; the skill calls them as opaque commands.
- **Dev-stack bring-up commands** — typically `docker compose down && docker compose up -d --build --wait` plus migration.

## Input

Epic key from args (e.g. `ABC-3`). If not given, infer from current sprint context or ask.

Optional skip flags (use sparingly; default = all lenses):
- `--skip product` — skip Phase 3 (no Confluence specs to align against; greenfield repo only).
- `--skip techlead` — skip Phase 4 (e.g. mid-sprint sanity check; closeout proper should never skip).

## Phase 0 — Load epic spec

1. `mcp__atlassian__getJiraIssue` for the epic on the configured `cloudId`. Read **summary, description, scope, epic-level ACs, dependencies** in full. The epic is the spec.
2. `mcp__atlassian__searchJiraIssuesUsingJql` with `"Epic Link" = <EPIC> ORDER BY key ASC`. Build a child ticket table: key, status, type, summary. **Every child must be Done (per the project's configured Done state name) or have an explicit reason it's deferred.** Any child still in a non-terminal column blocks closeout.

If the JQL result file exceeds context, extract with `jq -r '.issues.nodes[] | "\(.key)\t\(.fields.status.name)\t\(.fields.issuetype.name)\t\(.fields.summary)"' <file>`.

## Phase 1 — Map epic ACs to code + tests

For each epic-level AC, identify:

- **Code site(s)** that implement the AC — specific file:line references.
- **Unit test(s)** that exercise the AC at the function level.
- **Integration test(s)** that exercise the AC against a real stack (DB, broker, API gateway).

Produce a matrix. Any AC with no integration test (or only eager-execution / direct-call tests bypassing the broker) is a red flag — record it and design a smoke test in Phase 6 that exercises the missing path.

Particular failure modes to look for:

- **Cross-service dispatch.** Service A calls `send_task("service_b.task")`. If no integration test takes the broker → worker queue → consumer path, the routing config is untested. Worth adding a `<service>.ping` round-trip test before closeout.
- **API field name drift.** Subgraph / service type fields vs gateway query — verify via real introspection through the gateway, not just unit tests on the subgraph.
- **Beat / cron schedule wiring.** Task name in schedule config must resolve in worker include path — check via the scheduler's introspection command or by inspecting the live scheduler container's log.
- **Auth + admin gates.** Auth checks present and reachable from the gateway's forwarded-header path.

## Phase 2 — Static cross-checks

1. **Lint:** project linter exits 0 across all source paths.
2. **Unit suite:** all pass, coverage at or above the project's configured threshold.
3. **Doc drift:** every new test file listed in the test-suite `CLAUDE.md` tree + coverage table + run command section. Every new service / convention reflected in the relevant `CLAUDE.md`.
4. **Schedule sanity:** scheduled tasks reference task names that resolve in worker modules. Each scheduled task has both an entry and any required gate (market-hour, business-day, etc., if applicable).

## Phase 3 — Architecture + Product alignment (Architect / PM lens)

Goal: does the delivered code match the documented intent? You are wearing the architect + PM hat — not the engineer hat. The integration tests can be green while the system silently ships out-of-scope features, drops promised scope, or violates an ADR invariant.

### Step 3.1 — Load the spec corpus from Confluence

Discover via the configured `confluence-project-root` page id (or by walking the project root folder's children):

- **Vision Doc** — product principles, KPIs, hard constraints
- **PRD** — scope + out-of-scope list + business goals
- **Design Brief / Specs UI** — visual + UX intent (UI epics only)
- **ADR** — architecture decisions + invariants (especially "section 11 Epic Breakdown" if used)
- **Roadmap** — iteration goal for the sprint being closed
- **Per-epic design docs** — anything linked from the epic ticket

Read each in full. If a doc is missing or stale, flag it as a Minor finding ("PRD has no out-of-scope list — cannot verify scope creep").

### Step 3.2 — Build the alignment table

| Source | Statement | Code site (or "not implemented") | Status |
|---|---|---|---|
| Vision Doc principle #N | "No automated execution" | `backend/api_signal/...` — explicit user confirmation modal | ✅ Aligned |
| PRD §X | "Out of scope: per-user OHLCV" | `backend/api_data/...` — system-scoped OHLCV table | ✅ Aligned |
| ADR ADR-04 | "Services never call each other directly" | `backend/shared/celery_app.py:send_task` only | ✅ Aligned |
| PRD §Y | "Iteration goal: signal feed live" | not implemented | ❌ Drifted — scope dropped without doc update |
| Roadmap Iteration N | "Capacity = 28 pts" | delivered 32 pts (Jira) | ⚠️ Minor — over-delivery, retro signal |

### Step 3.3 — Categorise drifts

- **Critical drift** — code violates an ADR invariant, ships an out-of-scope feature without doc update, or breaks a Vision Doc principle. Blocks closeout. File a bug ticket, fix or roll back before declaring sprint done.
- **Minor drift** — over/under delivery vs iteration goal, stale spec doc that no longer reflects shipped reality, design brief deviation that's intentional but undocumented. Goes in the retro inputs; doesn't block.

### Step 3.4 — Cross-epic consistency

If multiple epics shipped this sprint, walk the surface they share (data model, API contract, auth boundary, UI navigation) and confirm they don't silently contradict each other. Two epics each independently passing their own ACs but together breaking a shared invariant is the failure mode this step catches.

## Phase 4 — Tech Lead deep code review (impartial)

Goal: walk every file touched during the sprint and flag every issue you would flag if a stranger wrote the code. No "the author probably had a reason" pass.

### Step 4.1 — Scope the diff

```bash
# Discover the sprint start commit (typically the first merge of a sprint-N story,
# or whatever the team's sprint-cut convention is)
git log --merges --first-parent --since="<sprint-start-date>" --format='%H %s' main
# Walk every file changed since
git diff --name-only <sprint-start-sha>..HEAD
```

Read every changed file **in full** (not just the diff). The diff hides surroundings; bugs hide in surroundings.

### Step 4.2 — Review lenses (apply all)

- **Correctness** — logic errors, edge cases, null handling, type contracts, model ↔ migration ↔ test consistency
- **Security** — input validation at system boundaries, hardcoded secrets, SQL injection via string interpolation, auth gate placement, header-trust assumptions
- **Architecture invariants** — every invariant from root + sub `CLAUDE.md` (data scoping, naming, async patterns, federation rules, no cross-service imports, market-hour gates, append-only tables, etc.)
- **Naming + conventions** — case style per language, explicit constraint names, file/function naming per project standard
- **Test coverage depth** — not just count. Does each test actually exercise its claimed AC? Mock placement reasonable? Negative paths covered? Order-dependence risk (e.g. `sys.modules` substring cleanup, module-level state, env var leaks across tests)? Hardcoded forward calendar dates that will rot?
- **Documentation drift** — file annotations, coverage tables, run-command sections, stale AC text
- **DRY + readability** — copy-paste ≥3 lines worth extracting, magic numbers that should be named constants, contradicted comments, unused imports, misleading names, dead branches
- **Performance hotspots** — N+1 queries, unbounded queries (no `LIMIT`), missing indexes on hot paths, sync calls inside async resolvers, blocking I/O in event loop
- **Operational concerns** — structured logging present? Error propagation explicit (not silent `except: pass`)? Restart safety (idempotent task handlers, no lost in-flight state)? Observability (metrics, traces) for new code paths?
- **Migration-specific** — `server_default` uses `text()` not `func.literal()` for scalar values, drop order is reverse of create order, FK targets schema-qualified, hypertable created after base table

### Step 4.3 — Severity ladder (every finding gets one)

- **Critical** — would cause runtime error, data corruption, security issue, autogenerate drift, architecture invariant breach. Blocks closeout.
- **Minor** — misleading docs, wrong port in docstring, missing run command, stale AC description, opportunistic cleanup worth doing. Files as cleanup tickets; doesn't block.
- **Nit** — style preference, not load-bearing. Listed in the report; team decides whether to action. Closeout is the right place for nits (merge-train review is two-tier; this is the exhaustive pass).

### Step 4.4 — Output

Numbered finding list, severity-grouped, each with `file:line` + one-sentence root cause + one-sentence fix recommendation. Critical findings go to the top.

```
### Critical
1. `backend/api_X/resolvers/Y.py:42` — SQL injection via f-string interpolation of user-supplied filter. Fix: switch to `text("... :filter").bindparams(filter=...)`.
2. ...

### Minor
1. `backend/api_X/.../Z.py:88` — copy-paste of error handling block from `W.py:120` (12 lines). Fix: extract `_handle_subgraph_error()` helper.
2. ...

### Nit
1. `frontend/src/.../A.tsx:55` — magic number `4000` (toast duration) repeated in 3 components. Fix: name as `TOAST_DURATION_MS` constant.
2. ...
```

### Step 4.5 — Impartiality rule

If you find yourself thinking "the author probably had a reason" — stop, write the finding anyway. The reviewer's job is to flag everything that would confuse a stranger six months from now. The team will dismiss findings that are intentional; that's their call, not yours.

## Phase 5 — Integration suite vs fresh testing stack

1. **Tear down testing stack with volumes.** A stale DB schema is the most common silent-failure cause.
2. **Rebuild the testing stack from scratch** (`docker compose ... up -d --build --wait` or the project's `scripts/testing-stack-up.sh` equivalent). Cached images are not OK here — the closeout's point is to verify a fresh build still works.
3. Run full integration suite from repo root with the standard env block. If the project's session-start fixture rebuilds the stack, do not skip it — the rebuild is the point.
4. Every test passes. Record runtime. Any flake gets retried once; if it re-flakes, file a follow-up ticket and continue.

## Phase 6 — Dev stack smoke test (the part that catches the silent bugs)

1. **Tear down dev stack with volumes** (`docker compose down -v`). Cached state from prior runs is the most common silent-failure cause.
2. **Rebuild dev stack from scratch** per the project's documented bring-up commands (typically `docker compose up -d --build --wait` then `docker compose run --rm migrate`). Cached images are not OK — the closeout's point is to verify a clean build still works for the next operator.
3. **Verify the stack is reachable via its documented DNS hostname**, not just `localhost`. If the consumer repo's `CLAUDE.md` declares a `TRAEFIK_DOMAIN` / hosting DNS, hit the stack through it:
   ```bash
   # Replace <DOMAIN> with the value from the consumer repo's CLAUDE.md (Hosting / DNS section)
   curl -fsS http://<DOMAIN>/health
   curl -fsS http://api.<DOMAIN>/health
   curl -fsS http://traefik.<DOMAIN> >/dev/null && echo "traefik dashboard reachable"
   ```
   `localhost:<port>` smoke alone is insufficient — Traefik routing, DNS resolution, and healthcheck propagation only get exercised through the real hostname. A stack that works on `localhost:3000` but 404s on `<DOMAIN>` is broken for every other operator on the LAN.
4. **Forge an admin credential** using the dev secret from `.env` if the project's user flow requires auth. Pattern (adapt to project's auth scheme):
   ```python
   from jose import jwt, datetime
   secret = Path(".env").read_text().split("JWT_SECRET=")[1].split()[0]
   jwt.encode({"sub":"smoke","user_id":"<uuid>","is_admin":True,
               "exp": datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=1)},
              secret, algorithm="HS256")
   ```
5. **Run the actual user flow that the epic delivers**, against the DNS hostname (not `localhost`). Not "API introspection works." The actual flow. Pick the equivalent flow for the epic under review. If Phase 3 surfaced a missing path (AC documented in PRD but no integration test), exercise it here.
6. **Monitor workers + scheduler for crashes** during the smoke window. Use `Monitor` with a filter that catches *every* terminal failure signature, not just success:
   ```
   docker compose logs -f --since=2m <worker> <scheduler> 2>&1 |
   grep -E --line-buffered "Traceback|Error|ERROR|FAILED|crashed|<domain-specific signatures>"
   ```
   Silence for the full smoke window = no crashes. Any line = investigate before closing the sprint.
7. **Confirm side-effects in the DB:**
   ```
   docker compose exec -T <db-service> psql -U <user> -d <db> -c "<SELECT verifying the AC>"
   ```

If the smoke test fails — even partially, including the DNS-exposure step — **the epic is not Done.** File a bug Jira ticket linked to the epic and run `agile-11-merge-train` on the fix PR before claiming closeout.

## Phase 6.5 — Merge-train Phase 4 Jira-link audit

`agile-11-merge-train` Phase 4 creates `Relates` Jira links between tickets whose PRs collided on shared files during the sprint, and the postmortem comment on each affected ticket announces every link with a `Jira link created: relates to <KEY>` line. Without an audit, link-creation failures (network blips, permission errors, partial runs) stay invisible and the coupling leaks silently into the next sprint's planning.

Steps:

1. **Source the pair list.** Preferred path: if the consumer project ships an audit helper (e.g. `scripts/audit_merge_train_links.py`), invoke it with the sprint identifier and use its output as the canonical list. Fallback: scan this sprint's postmortem comments for `Jira link created: relates to <KEY>` lines and build the list `(from_key, to_key, link_type)` manually.

2. **Verify + reconcile each pair.** For every tuple, query Jira (`getJiraIssue` with `fields=issuelinks`) and confirm a link of the announced type exists in either direction. For any FAIL, decide per pair before continuing: create the link inline using `createIssueLink` (with user confirmation), or file a follow-up ticket if the pairing is disputed. Record the disposition.

3. **Hand off to Phase 7.** Pass the full PASS/FAIL table + dispositions to the closeout report — the `Merge-train link audit` section in Phase 7 publishes it.

A closeout cannot be declared green while any audited pair is FAIL without an explicit recorded disposition. Silent skips are the failure mode this phase exists to prevent. If FAILs cluster around a single hub ticket, flag it as retro input — the merge-train Phase 4 link step may need hardening.

## Phase 7 — Final closeout report

Produce a single Markdown report **and publish it to Confluence under a dedicated `Closeouts` folder** (sibling of `Retrospectives`, NOT inside it). The retro skill (`agile-15-retro`) reads it as one of its inputs.

### Step 7.0 — Ensure the Closeouts folder exists

Before writing the closeout report:

- Check if a page named `Closeouts` (or `Closeouts — <Project>`) exists as a direct child of the project root folder identified by `confluence-project-root`.
- **If it does not exist:** create it now.
  - Title: `Closeouts — <Project>` (mirrors the `Retrospectives — <Project>` naming).
  - Parent: project root folder.
  - Body: minimal index — short description + a Markdown table with columns `Sprint | Period | Verdict | Report`. Pre-populate the row for the closeout being produced; later closeouts append to the same table.
- **If it already exists:** use it as the parent for the new closeout page. Append (do not replace) a row to the index table for the new sprint.

Closeouts and Retrospectives are sibling folders. Never publish closeouts inside `Retrospectives`; they are different artifacts produced by different skills and consumed in different ways (the retro reads the closeout, not the other way around).

### Step 7.1 — Publish the report page

- Title: `Closeout <N> — Sprint <N> — <Project>` (e.g. `Closeout 5 — Sprint 5 — FinPilot`).
- Parent: the `Closeouts — <Project>` folder from Step 7.0.
- Body: the full Markdown report below.

Capture the page id + URL — pass them back in the final user-facing response so the operator (and `agile-15-retro`) can link to the artifact.

### Step 7.2 — Update the Closeouts index

Append a row to the index table on the `Closeouts — <Project>` page: `<Sprint> | <Period> | <Verdict> | <Link to report page>`. Keep newest first or chronological — pick one convention and stick with it; mirror what already exists if the table is non-empty.

### Report body — required sections

### Ticket roll-up
Every child ticket of the epic, status, brief.

### Epic AC verification table

| # | AC | Status | Evidence |
|---|----|--------|----------|
| 1 | <AC text> | ✅ / ❌ | <file:line + test ref + smoke-test observation> |

Every AC needs three pieces of evidence: code site, test coverage, smoke-test confirmation. Missing one → AC is not satisfied.

### Product / Architecture alignment (Phase 3)

The alignment table from Step 3.2. Highlight every Critical drift + every Minor drift separately.

### Tech Lead review findings (Phase 4)

The severity-grouped finding list from Step 4.4. Per-finding: `file:line`, root cause, fix recommendation. Counts at the top: `N Critical / M Minor / K Nit`.

### Test coverage
- Unit: N/N pass, X% coverage
- Integration: N/N pass against fresh stack, runtime

### Crash monitoring
"Workers + scheduler clean for X min" or "<crash signature> at <time>, investigated → <outcome>."

### Critical bugs found + disposition
- For each bug surfaced during closeout (any phase): ticket key, severity, fix status (PR open / PR merged / deferred).

### Merge-train link audit (Phase 6.5)

PASS/FAIL table for every `Relates` link the merge-train announced this sprint, plus the disposition for each FAIL:

| from | to | type | status | link_id | disposition |
|------|----|------|--------|---------|-------------|
| PROJ-X | PROJ-Y | Relates | ✅ PASS | 10786 | — |
| PROJ-X | PROJ-Z | Relates | ❌ FAIL | — | link created inline (id 10787) |

### Recommended next steps
- Whether to transition the epic to Done.
- Tickets to file (e.g. follow-up work, frontend not in scope, Minor cleanup batch from Phase 4).
- Sprint retro notes — especially **test coverage gaps** discovered, **spec drift** observed (Phase 3), **systemic code-quality patterns** worth a convention update (Phase 4).

## Rules

- **All three lenses run, regardless of how clean the engineer-lens checks look.** Phases 3 + 4 are not optional. The skill exists because each lens catches a class of failure invisible to the others.
- **A single Critical finding from any lens blocks closeout.** Engineer-lens green is not enough.
- **Dev-stack smoke test is the whole point of the engineer lens.** Don't skip it because story-level integration tests passed.
- **All children Done before closeout.** If any child ticket is still open, either close it first or document why it's explicitly deferred.
- **Smoke test the actual user flow, not just `{ __schema }` introspection.** Introspection passes when the federation is wired; it doesn't prove the underlying task executes.
- **Hit the dev stack via its documented DNS hostname, not `localhost`.** A `localhost:<port>` smoke bypasses Traefik routing, DNS resolution, and the healthcheck propagation chain — exactly the layers most likely to silently break for other operators on the LAN. If the consumer repo has a Hosting / DNS section in `CLAUDE.md`, the smoke MUST use those hostnames.
- **Rebuild dev + test stacks from scratch every closeout.** `docker compose down -v` then `up -d --build --wait`. Cached images and stale volumes are the most common silent-failure cause; the closeout is the one place that guarantees a fresh build still works.
- **Monitor with a wide filter.** Silence is not success unless your filter would have emitted on a crash. Default filter: `Traceback|Error|ERROR|FAILED|crashed|<domain-specific signatures>`.
- **Architect lens reads docs in full, not summaries.** Vision Doc, PRD, ADR, Roadmap — each whole. Drift catches require knowing what the spec actually says, not your memory of what it said.
- **Tech Lead lens reads every changed file in full.** Diff hides surroundings; bugs hide in surroundings. Same rule as `merge-review-pr`.
- **Impartiality is the Tech Lead lens's whole job.** If you find yourself softening a finding — write it harder, not softer. The team will dismiss what's intentional.
- **Nits are valid output of Phase 4.** Closeout is the exhaustive review. Don't promote nits to Minor to feel rigorous, and don't drop them to feel kind.
- **Bugs found at closeout get new Jira tickets.** Do not silently fix them in main. File a bug ticket, branch `feat/<KEY>-...`, PR via `agile-11-merge-train`.
- **The new bug fix PR itself goes through `agile-11-merge-train`.** No hotfix shortcuts.
- **Epic-level Done transition is not part of this skill.** Closeout produces a recommendation; the user transitions the epic only after acknowledging the report.
- **Add coverage for any gap discovered.** If a smoke-test bug surfaces because no integration test exercised path X, the fix PR must include a new integration test that covers path X. Same for spec drift caught in Phase 3 (add a test that would have failed if the drift recurred) and a Critical correctness finding caught in Phase 4.
- **Cross-PR conflict awareness still applies.** When the closeout fix PR enters `agile-11-merge-train`, Phase 1 conflict detection + Phase 4 Jira link creation run normally.

## Stop conditions

Halt and surface to the user if:
- A child ticket is in a state other than Done / explicitly-deferred.
- The smoke test reveals a bug that cannot be fixed in a single PR (would require multiple coordinated changes).
- The dev stack fails to come up healthy after rebuild + migrate.
- A worker crashes during the smoke window with a non-trivial error (DB schema mismatch, missing env var, import error).
- The dev stack works on `localhost:<port>` but the documented DNS hostname (`TRAEFIK_DOMAIN` / equivalent) returns 404 / connection refused / certificate error — surfaces broken Traefik routing or stale DNS that every other operator on the LAN will hit.
- Two consecutive smoke-test cycles surface unrelated bugs (suggests deeper systemic issue → escalate before continuing).
- **Architect lens (Phase 3)** discovers a Critical drift the team has not acknowledged — out-of-scope shipped feature, ADR invariant breach, scope silently dropped vs PRD. Surface before fix attempts; the team may choose to update the spec rather than the code.
- **Tech Lead lens (Phase 4)** surfaces a Critical finding that requires multi-PR coordination to fix (e.g. cross-service refactor, breaking schema change). Don't try to bundle into closeout — file as blocker, hold the Done transition.
- A Confluence spec doc is missing or so out of date the alignment table cannot be built. Stop; ask whether to skip Phase 3 (with explicit deferral note) or to update the spec first.

## Prerequisite chain

- **Before this skill:** `agile-12-tech-debt-sweep` must have run + approved fixes applied. Closeout assumes `CLAUDE.md` is accurate and the repo is free of obvious cruft.
- **After this skill:** `agile-15-retro` should verify `agile-13-sprint-closeout` ran cleanly on the epic before proceeding. Do not invoke `agile-15-retro` until this skill has completed and all surfaced gaps are resolved or explicitly deferred with linked tickets.

## When NOT to use

- Mid-sprint check-in. This is end-of-sprint or end-of-epic. Use `agile-11-merge-train` for individual PR processing during the sprint.
- A single-story closeout. Story-level Done is owned by `merge-jira-postmortem` triggered from `agile-11-merge-train` 3g.
- Quick sanity check that "things still work." This skill is deliberately heavy; reach for a lighter check.
