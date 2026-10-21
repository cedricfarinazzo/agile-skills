---
name: agile-13-sprint-closeout
description: "Mandatory end-of-sprint epic gate, 3 lenses: engineer (smoke + integration), architect (Confluence specs vs delivered code), tech lead (deep severity-graded review of all sprint diffs). Triggers: sprint closeout, close sprint, /sprint-closeout. After last merge + agile-12-tech-debt-sweep, before retro."
---

# agile_13_sprint_closeout

## Host execution

**Claude Code:** retain the concurrent review phases below. **Codex:** run every phase and review lens sequentially inline; never spawn, request, or claim an agent or subagent. Preserve every gate and the full review coverage.

## Purpose

**Mandatory final step of every sprint** — after the last story merges to `main`, after `agile-12-tech-debt-sweep`, before `agile-15-retro`. The bug class it catches is *"all unit + integration tests pass and production is broken"*: every story-level AC met in isolation while the wired-together system carries a silent regression nobody exercised.

Three lenses, each catching a class of failure invisible to the others. **A single Critical finding from any lens blocks closeout** — engineer-lens green is not enough.

1. **Engineer** — does the wired-together system actually work on a freshly rebuilt dev stack? (Phases 0–2, 5–6)
2. **Architect / PM** — does the delivered code match the documented intent? (Phase 3)
3. **Tech Lead** — does it hold up under an impartial deep review? (Phase 4)

On Claude Code, Phases 3 and 4 are read-only and independent — run them concurrently, and alongside a stack rebuild already in progress; only Phases 5–6 need the stack to themselves.

**This is the third and broadest review layer, by a different role than the per-PR reviews.** The author self-reviewed each change (`implement-review`) and an independent reviewer gated each PR (`merge-review-pr`) — both *per PR*. This pass asks whether the **whole sprint, wired together**, is aligned with the sprint/epic goal and the documented product and architecture intent. The per-PR reviews could not see system-level drift; do not assume they covered it.

**Non-goals:** rubber-stamping tickets because their story-level ACs are ticked; trusting integration tests that bypass the broker; skipping the dev-stack smoke because CI was green; deferring to "the author probably had a reason". The skill is expected to take 30–60 minutes — that beats finding the bug, the silent product drift, or the load-bearing dead code a month later.

**Prerequisite: `agile-12-tech-debt-sweep` must have run** and its approved fixes applied. Closeout's smoke replays the user flow described in `CLAUDE.md/AGENTS.md`, so `CLAUDE.md/AGENTS.md` must accurately reflect main — no stale tree comments, no useless CI workflows skewing the pipeline, no leaked personal tags — and any prebuild-image extractions must have landed before closeout exercises the new stack.

## Configuration

From the consumer repo's `CLAUDE.md/AGENTS.md`: **`cloudId`** (required); **`confluence-project-root`** — page id or title of the folder holding Vision Doc / PRD / Design Brief / ADR / Roadmap / Retrospectives / Closeouts (required for Phases 3 and 7); **`done-status-name`** — the project-local terminal state ("Done", "Terminé(e)", "Closed"); **lint / unit / integration commands**, called as opaque commands; **dev-stack bring-up commands**, typically `docker compose down && docker compose up -d --build --wait` plus migration.

**Input:** epic key from args (else inferred from sprint context, or ask). Optional `--skip product` (Phase 3 — greenfield repo with no Confluence specs) and `--skip techlead` (Phase 4 — a mid-sprint sanity check only; a real closeout never skips it). Use sparingly; the default is all lenses.

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

## Phase 0 — Load epic spec

Read the epic in full via `mcp__atlassian__getJiraIssue` — summary, description, scope, epic-level ACs, dependencies. The epic is the spec. Then `mcp__atlassian__searchJiraIssuesUsingJql` with `"Epic Link" = <EPIC> ORDER BY key ASC` and build a child table (key, status, type, summary). **Every child must be Done, or carry an explicit reason it is deferred** — any child in a non-terminal column blocks closeout.

Oversized JQL result → extract with `jq -r '.issues.nodes[] | "\(.key)\t\(.fields.status.name)\t\(.fields.issuetype.name)\t\(.fields.summary)"' <file>`.

## Phase 1 — Map epic ACs to code + tests

Per epic-level AC, produce a matrix of the **code site(s)** (`file:line`), the **unit test(s)** exercising it at function level, and the **integration test(s)** exercising it against a real stack (DB, broker, gateway). An AC with no integration test — or only eager-execution / direct-call tests that bypass the broker — is a red flag: record it and design a Phase 6 smoke that exercises the missing path.

Failure modes worth hunting specifically: **cross-service dispatch** (service A calls `send_task("service_b.task")` with nothing testing broker → queue → consumer, leaving the routing config untested — a `<service>.ping` round-trip is worth adding); **API field-name drift** (verify subgraph fields via real introspection *through the gateway*, not unit tests on the subgraph); **beat/cron wiring** (the scheduled task name must resolve in the worker include path — check via the scheduler's introspection or the live container log); **auth and admin gates** reachable from the gateway's forwarded-header path.

**A data-driven AC needs evidence from data nobody seeded.** A fixture built to demonstrate a feature can differ from production in exactly the dimension that matters, so a green seeded path shows the code runs — not that it runs on real input. Confirm at least one unseeded record satisfies the AC before recording it as evidenced; where none exists yet, that absence *is* the AC's status, and the fixture does not stand in for it.

## Phase 2 — Static cross-checks

Lint exits 0 across all source paths. The unit suite passes with coverage at or above the configured threshold. **Doc drift:** every new test file appears in the test-suite `CLAUDE.md/AGENTS.md` tree, coverage table, and run-command section; every new service or convention is reflected in the relevant `CLAUDE.md/AGENTS.md`. **Schedule sanity:** scheduled tasks reference names that resolve in worker modules, each with any required gate (market-hour, business-day).

## Phase 3 — Architecture + Product alignment (Architect / PM lens)

Wear the architect and PM hat, not the engineer hat: integration tests stay green while the system silently ships out-of-scope features, drops promised scope, or violates an ADR invariant.

**3.1 — Load the spec corpus** from `confluence-project-root`: **Vision Doc** (principles, KPIs, hard constraints), **PRD** (scope, out-of-scope list, business goals), **Design Brief / Specs UI** (UI epics), **ADR** (decisions + invariants), **the Sprint page and its Iteration page** (sprint goal, scope, success criteria, iteration goal), the **Decision Log** entries the sprint cites, and any per-epic design doc linked from the ticket. **Read each in full, not in summary** — a drift catch requires knowing what the spec actually says, not your memory of it. A missing or stale doc is a Minor finding ("PRD has no out-of-scope list — cannot verify scope creep").

**3.2 — Build the alignment table:**

| Source | Statement | Code site (or "not implemented") | Status |
|---|---|---|---|
| Vision Doc principle #N | "No automated execution" | `backend/api_signal/…` — explicit confirmation modal | ✅ Aligned |
| PRD §X | "Out of scope: per-user OHLCV" | `backend/api_data/…` — system-scoped table | ✅ Aligned |
| ADR-04 | "Services never call each other directly" | `backend/shared/celery_app.py:send_task` only | ✅ Aligned |
| PRD §Y | "Iteration goal: signal feed live" | not implemented | ❌ Drifted — scope dropped without doc update |
| Sprint N page | "Committed = 28 pts" | delivered 32 pts | ⚠️ Minor — over-delivery, retro signal |

**3.3 — Categorise.** **Critical drift** — code violates an ADR invariant, ships an out-of-scope feature without a doc update, or breaks a Vision Doc principle: blocks closeout; file a bug and fix or roll back. **Minor drift** — over/under delivery against the iteration goal, a stale spec doc, an intentional but undocumented design deviation: retro input, does not block.

**3.4 — Cross-epic consistency.** With multiple epics in one sprint, walk the surface they share (data model, API contract, auth boundary, UI navigation). Two epics each passing their own ACs while together breaking a shared invariant is the failure this step exists for.

## Phase 4 — Tech Lead deep code review (impartial)

Flag every issue you would flag if a stranger wrote this code.

**4.1 — Scope the diff.** Find the sprint-start commit (`git log --merges --first-parent --since="<sprint-start-date>" --format='%H %s' main`), then `git diff --name-only <sprint-start-sha>..HEAD`. **Read every changed file in full** — the diff hides surroundings, and bugs hide in surroundings.

**4.2 — Lenses, all of them:**
- **Correctness** — logic errors, edge cases, null handling, type contracts, model ↔ migration ↔ test consistency.
- **Security** — input validation at boundaries, hardcoded secrets, SQL injection via interpolation, auth gate placement, header-trust assumptions.
- **Architecture invariants** — every invariant from the root and sub `CLAUDE.md/AGENTS.md` (data scoping, naming, async patterns, federation rules, no cross-service imports, append-only tables).
- **Naming + conventions** — case style per language, explicit constraint names, file/function naming.
- **Test coverage depth, not count** — does each test actually exercise its claimed AC? Reasonable mock placement? Negative paths? Order-dependence risk (`sys.modules` substring cleanup, module-level state, env leaks across tests)? Hardcoded forward calendar dates that will rot?
- **Documentation drift** — file annotations, coverage tables, run-command sections, stale AC text.
- **DRY + readability** — copy-paste ≥3 lines worth extracting, magic numbers, contradicted comments, unused imports, misleading names, dead branches.
- **Performance** — N+1 queries, unbounded queries with no `LIMIT`, missing indexes on hot paths, sync calls inside async resolvers, blocking I/O in the event loop.
- **Operational** — structured logging present? Errors propagated explicitly (no silent `except: pass`)? Restart-safe (idempotent handlers, no lost in-flight state)? Observability for new code paths?
- **Migrations** — `server_default` uses `text()` not `func.literal()`; drop order reverses create order; FK targets schema-qualified; hypertable created after its base table.

**4.3 — Severity, one per finding.** **Critical** — a runtime error, data corruption, security issue, autogenerate drift, or architecture-invariant breach; blocks closeout. **Minor** — misleading docs, a wrong port in a docstring, a missing run command, a stale AC description, worthwhile cleanup; files as cleanup tickets. **Nit** — style preference, not load-bearing; listed for the team to decide. **Nits are valid output here** — closeout is the exhaustive pass (merge-train review is deliberately two-tier). Don't promote nits to Minor to feel rigorous, or drop them to feel kind.

**4.4 — Output** a numbered, severity-grouped list, Critical first, each with `file:line` + a one-sentence root cause + a one-sentence fix:

```
### Critical
1. `backend/api_X/resolvers/Y.py:42` — SQL injection via f-string interpolation of a user-supplied filter. Fix: `text("… :filter").bindparams(filter=…)`.

### Minor
1. `backend/api_X/…/Z.py:88` — 12-line copy-paste of the error handling in `W.py:120`. Fix: extract `_handle_subgraph_error()`.

### Nit
1. `frontend/src/…/A.tsx:55` — magic `4000` (toast duration) repeated in 3 components. Fix: `TOAST_DURATION_MS`.
```

**4.5 — Impartiality is this lens's whole job.** Flag anything that would confuse a stranger in six months; dismissing an intentional finding is the team's call, not yours.

## Phase 5 — Integration suite vs a fresh testing stack

Tear the testing stack down **with volumes** (a stale DB schema is the most common silent-failure cause), rebuild it from scratch (`docker compose … up -d --build --wait` or the project's equivalent — cached images defeat the purpose), then run the full integration suite from the repo root with the standard env block. If a session-start fixture rebuilds the stack, do not skip it; the rebuild *is* the point. Every test must pass; record the runtime. A flake gets one retry, then a follow-up ticket.

## Phase 6 — Dev stack smoke test (the part that catches the silent bugs)

1. **`docker compose down -v`** — cached state from prior runs is the most common silent-failure cause.
2. **Rebuild from scratch** per the documented bring-up commands. **Rebuild the migration runner too, not just the app images.** A containerized migrate step run against a stale/cached runner applies whatever revisions were baked into that image — so a migration added this sprint silently no-ops, the runner reports success, and the freshly-built app then hits a schema missing the new objects. Force the runner to carry current code (`--build`), then **confirm the head actually advanced** by querying the migration-version table. Never trust a green migrate log alone.
3. **Reach the stack via its documented DNS hostname, not `localhost`.** A `localhost:<port>` smoke bypasses Traefik routing, DNS resolution, and healthcheck propagation — exactly the layers most likely to be silently broken for every other operator on the LAN. If the repo's `CLAUDE.md/AGENTS.md` declares a `TRAEFIK_DOMAIN`, the smoke **must** use it:
   ```bash
   curl -fsS http://<DOMAIN>/health
   curl -fsS http://api.<DOMAIN>/health
   curl -fsS http://traefik.<DOMAIN> >/dev/null && echo "traefik dashboard reachable"
   ```
4. **Forge an admin credential** from the dev secret in `.env` if the flow needs auth (adapt to the project's scheme):
   ```python
   from jose import jwt, datetime
   secret = Path(".env").read_text().split("JWT_SECRET=")[1].split()[0]
   jwt.encode({"sub":"smoke","user_id":"<uuid>","is_admin":True,
               "exp": datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=1)},
              secret, algorithm="HS256")
   ```
5. **Run the actual user flow the epic delivers**, against the DNS hostname. Not "API introspection works" — introspection passes whenever the federation is wired and proves nothing about whether the underlying task executes. If Phase 3 surfaced a documented-but-untested path, exercise it here.
6. **Monitor workers + scheduler for the whole smoke window** with a filter wide enough to catch every terminal signature — silence is only success if the filter would have fired on a crash:
   ```
   docker compose logs -f --since=2m <worker> <scheduler> 2>&1 |
   grep -E --line-buffered "Traceback|Error|ERROR|FAILED|crashed|<domain-specific signatures>"
   ```
7. **Confirm the side-effects in the DB** — `docker compose exec -T <db> psql -U <user> -d <db> -c "<SELECT verifying the AC>"`.

**Any smoke failure — including the DNS-exposure step — means the epic is not Done.** File a bug linked to the epic and run the fix PR through `agile-11-merge-train`. No hotfix shortcuts, and never silently fix a closeout bug in main.

## Phase 6.5 — Merge-train Jira-link audit

`agile-11-merge-train` creates `Relates` links between tickets whose PRs collided on shared files — per PR at its 3g, with its Phase 4 reconciling any pair 3g could not reach — announcing each in the postmortem with a `Jira link created: relates to <KEY>` line. Without an audit, link-creation failures (network blips, permission errors, partial runs) stay invisible and the coupling leaks into next sprint's planning.

**Run the bundled audit.** It sources `(from_key, to_key, link_type)` from the postmortems (a named pattern family, so a reworded announcement is still read), checks each pair in either direction, and prints the table plus what it examined. Gate on its exit code, never its output: `0` all PASS · `1` a FAIL, or zero announcements over a non-empty ticket set · `2` usage error.

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/agile-13-sprint-closeout/scripts/audit_merge_train_links.py"
python3 "$S" --comments-json dump.json --key-prefix <PROJ>  # {key: [comment bodies]} + dump.links.json {key: issuelinks}
```

The script is offline and reads no credentials. Build both files from `mcp__atlassian__getJiraIssue` (`fields=comment,issuelinks`) for each ticket in the sprint (`mcp__atlassian__searchJiraIssuesUsingJql` lists them); a dump without its `.links.json` sidecar reports every row `read failed`, never PASS. No script possible → verify each pair by hand with `mcp__atlassian__getJiraIssue` (`fields=issuelinks`), confirming a link of the announced type in either direction. For every FAIL, decide before continuing: create it inline with `mcp__atlassian__createIssueLink` (with user confirmation), or file a follow-up if the pairing is disputed. Record the disposition and pass the table to Phase 7.

**Zero announcements over a non-empty ticket set is a METHOD failure, not a pass.** An empty expected set and an unparsed one are the same output. When no announcement is found, derive the expected set from the merges instead: `gh pr view <N> --json files` for each PR the sprint merged, intersect the file sets pairwise, and treat every intersecting pair as an expected `Relates` between their tickets. **State which source produced the table** — announcements or file collisions — because their blind spots differ: prose can be absent, and a collision set cannot see a coupling that shares no file.

**A closeout cannot be green while any pair is FAIL without a recorded disposition** — silent skips are the failure mode this phase exists to prevent. FAILs clustering on one hub ticket are retro input: the Phase 4 link step may need hardening.

## Phase 7 — Final closeout report

Publish the report in the **`Closeouts` container**, a page or a Confluence folder (see Page placement above): a sibling of `Retrospectives`, never inside it, and never under the Roadmap or an `Iteration N` page, however much the sprint context points there. `agile-15-retro` reads the closeout, not the reverse.

**7.0 — Resolve the container by id.** Find `Closeouts` (or `Closeouts — <Project>`), page or Confluence folder, as a direct child of `confluence-project-root`. Missing → create it as a page (parent: project root; body: a short description plus an `## Index` table `Sprint | Period | Verdict | Report`). Its id is the only valid `parentId` for 7.1.

**7.1 — Write the page** titled `Closeout <N> — Sprint <N> — <Project>`; a page with that title already exists → update it, never mint a second. Open the previous closeout in the container for tone and depth; the layout below wins wherever it differs. Pass the body in the format you wrote it: Markdown with `contentFormat: "markdown"`, HTML with `"html"` — Markdown sent as HTML renders as literal `|`, `**` and `#`.

**Layout.** A header line (sprint, epics, period, last merge, report run date on `main` `<sha>`), then one **Verdict** line: ✅ GREEN / ✅ GREEN with open items / 🔴 BLOCKED, the `N Critical / M Minor / K Nit` counts, and any phase not run. Then these numbered `##` sections, in this order, **every one present**:

1. **Ticket roll-up** — every child of the epic, status, brief; committed vs delivered.
2. **Epic AC verification** — `# | AC | Status | Evidence`. Every AC needs **three** pieces of evidence: a code site, test coverage, and a smoke-test observation. Missing one means the AC is not satisfied.
3. **Product / Architecture alignment** — the Phase 3 table, Critical and Minor drifts in separate subsections.
4. **Tech Lead findings** — Phase 4 grouped `### Critical` / `### Minor` / `### Nit`, counts at the top; each finding numbered, with `file:line` and its ticket key.
5. **Test coverage** — unit N/N with coverage %, integration N/N against the fresh stack with runtime; link any coverage matrix (it lives in `Extras`, not here).
6. **Dev-stack smoke + crash monitoring** — "workers + scheduler clean for X min", or the signature, time and outcome.
7. **Critical bugs found + disposition** — `Finding | Severity | Ticket | Fix status`.
8. **Merge-train link audit** — `from | to | type | status | link_id | disposition` for every announced link.
9. **Recommended next steps** — whether to transition the epic to Done; tickets to file; retro notes, especially **test-coverage gaps**, **spec drift** (Phase 3) and **systemic code-quality patterns** worth a convention update (Phase 4).

A phase that did not run keeps its section with **NOT RUN** and the reason, never a silent omission and never a PASS. Tables for structured data, numbered lists for findings. Write for the person closing the sprint — what was checked, what was found, what is left; no process narration, tool logs, raw command output or chat preamble.

**7.2 — Verify before reporting.** Read the page back with `mcp__atlassian__getConfluencePage` and `contentFormat: "html"` (a Markdown read shows `**` and `#` on a correct page too): its `parentId` is the folder id from 7.0 (otherwise move it with `mcp__atlassian__updateConfluencePage` `parentId`), the nine sections are `<h2>` headings in order, tables are `<table>` elements, and no text holds a literal `|---|`, `**` or a line starting with `#`. Fix and re-read until it passes. **7.3 — Append the index row** (`<Sprint> | <Period> | <Verdict> | <link>`) to the container's `## Index` when it is a page, matching the table's ordering, never replacing the table; a Confluence folder lists its children itself, so skip this. Return the page id + URL so the operator and `agile-15-retro` can link to it.

**The epic-level Done transition is not part of this skill** — closeout produces a recommendation, and the user transitions only after acknowledging the report.

**Every gap discovered gets coverage.** A smoke bug that surfaced because no integration test exercised path X means the fix PR adds one. Same for Phase 3 drift (add the test that would have failed if it recurred) and a Phase 4 Critical correctness finding.

## Work discovered mid-phase — finish this ticket's own work; file what is separate

Every phase discovers work its ticket did not plan for. Two decisions, in order, and neither of them is "leave it in a comment":

**1. Does it belong to this ticket?** It does when the change is incomplete, incorrect or inconsistent without it: the ACs, tests and docs for what it changes, a missed call site, a defect or flake its own change exposes, cleanup beside code it edits. Do it here, even when the PR grows. **Filing a follow-up to avoid work is not an option**; "it is more work" and "it touches more files" are not reasons. Test: would a reviewer accept this ticket as done without it? If not, it is this ticket's work.

**2. Otherwise file it.** Separate work (its own design decision or risk, a different area, independent value) gets a ticket. One ticket per separate piece; never split this ticket's own remainder into several small ones.

**Which backlog?**
- **The current sprint** — it blocks the sprint goal, it is a must-have, or a human asked for it.
- **The product backlog** — everything else, and this is the default. Pulling work into a running sprint is a scope change, not a convenience.

**Point it at creation.** A ticket minted mid-phase never passes back through the refinement skill, so if it is not sized here it is never sized at all, and the sprint's velocity figure silently stops describing the work delivered. Use the project's normal estimation scale; if it truly cannot be sized yet, label it `unsized` with a one-line reason rather than leaving the field empty by default.

## Stop conditions

- A child ticket is neither Done nor explicitly deferred.
- The smoke reveals a bug that cannot be fixed in a single PR (needs multiple coordinated changes).
- The dev stack fails to come up healthy after rebuild + migrate, or a worker crashes during the smoke window with a non-trivial error (schema mismatch, missing env var, import error).
- The stack works on `localhost:<port>` but the documented DNS hostname returns 404 / connection refused / a certificate error — broken Traefik routing or stale DNS that every other operator will hit.
- Two consecutive smoke cycles surface unrelated bugs — escalate rather than continue.
- **Phase 3 finds an unacknowledged Critical drift** — surface it before attempting a fix; the team may choose to update the spec rather than the code.
- **Phase 4 finds a Critical needing multi-PR coordination** (cross-service refactor, breaking schema change) — file it as a blocker and hold the Done transition rather than bundling it into closeout.
- A Confluence spec is missing or so stale the alignment table cannot be built — ask whether to skip Phase 3 with an explicit deferral note, or to update the spec first.

## When NOT to use

A mid-sprint check-in (use `agile-11-merge-train` for individual PRs), a single-story closeout (story-level Done belongs to `merge-jira-postmortem` at merge-train 3g), or a quick "does it still work" sanity check — this skill is deliberately heavy.

**After this skill:** `agile-15-retro` verifies closeout ran cleanly before proceeding; do not invoke it until every surfaced gap is resolved or explicitly deferred with a linked ticket.
