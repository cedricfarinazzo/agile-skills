---
name: agile-13-sprint-closeout
description: "Mandatory end-of-sprint epic gate, 3 lenses: engineer (smoke + integration), architect (Confluence specs vs delivered code), tech lead (deep severity-graded review of all sprint diffs). Triggers: sprint closeout, close sprint, /sprint-closeout. After last merge + agile-12-tech-debt-sweep, before retro."
---

# agile_13_sprint_closeout

**Mandatory final step of every sprint** — after the last story merges to `main`, after `agile-12-tech-debt-sweep`, before `agile-15-retro`. The bug class it catches is *"all unit + integration tests pass and production is broken"*: every story-level AC met in isolation while the wired-together system carries a silent regression nobody exercised.

Three lenses, each catching a class of failure invisible to the others. **A single Critical finding from any lens blocks closeout** — engineer-lens green is not enough.

1. **Engineer** — does the wired-together system actually work on a freshly rebuilt dev stack? (Phases 0–2, 5–6)
2. **Architect / PM** — does the delivered code match the documented intent? (Phase 3)
3. **Tech Lead** — does it hold up under an impartial deep review? (Phase 4)

**This is the third and broadest review layer, by a different role than the per-PR reviews.** The author self-reviewed each change (`implement-review`) and an independent reviewer gated each PR (`merge-review-pr`) — both *per PR*. This pass asks whether the **whole sprint, wired together**, is aligned with the sprint/epic goal and the documented product and architecture intent. The per-PR reviews could not see system-level drift; do not assume they covered it.

**Non-goals:** rubber-stamping tickets because their story-level ACs are ticked; trusting integration tests that bypass the broker; skipping the dev-stack smoke because CI was green; deferring to "the author probably had a reason". The skill is expected to take 30–60 minutes — that beats finding the bug, the silent product drift, or the load-bearing dead code a month later.

**Prerequisite: `agile-12-tech-debt-sweep` must have run** and its approved fixes applied. Closeout's smoke replays the user flow described in `CLAUDE.md`, so `CLAUDE.md` must accurately reflect main — no stale tree comments, no useless CI workflows skewing the pipeline, no leaked personal tags — and any prebuild-image extractions must have landed before closeout exercises the new stack.

## Configuration

From the consumer repo's `CLAUDE.md` / `AGENTS.md`: **`cloudId`** (required); **`confluence-project-root`** — page id or title of the folder holding Vision Doc / PRD / Design Brief / ADR / Roadmap / Retrospectives / Closeouts (required for Phases 3 and 7); **`done-status-name`** — the project-local terminal state ("Done", "Terminé(e)", "Closed"); **lint / unit / integration commands**, called as opaque commands; **dev-stack bring-up commands**, typically `docker compose down && docker compose up -d --build --wait` plus migration.

**Input:** epic key from args (else inferred from sprint context, or ask). Optional `--skip product` (Phase 3 — greenfield repo with no Confluence specs) and `--skip techlead` (Phase 4 — a mid-sprint sanity check only; a real closeout never skips it). Use sparingly; the default is all lenses.

## Phase 0 — Load epic spec

Read the epic in full via `getJiraIssue` — summary, description, scope, epic-level ACs, dependencies. The epic is the spec. Then `searchJiraIssuesUsingJql` with `"Epic Link" = <EPIC> ORDER BY key ASC` and build a child table (key, status, type, summary). **Every child must be Done, or carry an explicit reason it is deferred** — any child in a non-terminal column blocks closeout.

Oversized JQL result → extract with `jq -r '.issues.nodes[] | "\(.key)\t\(.fields.status.name)\t\(.fields.issuetype.name)\t\(.fields.summary)"' <file>`.

## Phase 1 — Map epic ACs to code + tests

Per epic-level AC, produce a matrix of the **code site(s)** (`file:line`), the **unit test(s)** exercising it at function level, and the **integration test(s)** exercising it against a real stack (DB, broker, gateway). An AC with no integration test — or only eager-execution / direct-call tests that bypass the broker — is a red flag: record it and design a Phase 6 smoke that exercises the missing path.

Failure modes worth hunting specifically: **cross-service dispatch** (service A calls `send_task("service_b.task")` with nothing testing broker → queue → consumer, leaving the routing config untested — a `<service>.ping` round-trip is worth adding); **API field-name drift** (verify subgraph fields via real introspection *through the gateway*, not unit tests on the subgraph); **beat/cron wiring** (the scheduled task name must resolve in the worker include path — check via the scheduler's introspection or the live container log); **auth and admin gates** reachable from the gateway's forwarded-header path.

## Phase 2 — Static cross-checks

Lint exits 0 across all source paths. The unit suite passes with coverage at or above the configured threshold. **Doc drift:** every new test file appears in the test-suite `CLAUDE.md` tree, coverage table, and run-command section; every new service or convention is reflected in the relevant `CLAUDE.md`. **Schedule sanity:** scheduled tasks reference names that resolve in worker modules, each with any required gate (market-hour, business-day).

## Phase 3 — Architecture + Product alignment (Architect / PM lens)

Wear the architect and PM hat, not the engineer hat: integration tests stay green while the system silently ships out-of-scope features, drops promised scope, or violates an ADR invariant.

**3.1 — Load the spec corpus** from `confluence-project-root`: **Vision Doc** (principles, KPIs, hard constraints), **PRD** (scope, out-of-scope list, business goals), **Design Brief / Specs UI** (UI epics), **ADR** (decisions + invariants), **Roadmap** (the iteration goal for the sprint being closed), and any per-epic design doc linked from the ticket. **Read each in full, not in summary** — a drift catch requires knowing what the spec actually says, not your memory of it. A missing or stale doc is a Minor finding ("PRD has no out-of-scope list — cannot verify scope creep").

**3.2 — Build the alignment table:**

| Source | Statement | Code site (or "not implemented") | Status |
|---|---|---|---|
| Vision Doc principle #N | "No automated execution" | `backend/api_signal/…` — explicit confirmation modal | ✅ Aligned |
| PRD §X | "Out of scope: per-user OHLCV" | `backend/api_data/…` — system-scoped table | ✅ Aligned |
| ADR-04 | "Services never call each other directly" | `backend/shared/celery_app.py:send_task` only | ✅ Aligned |
| PRD §Y | "Iteration goal: signal feed live" | not implemented | ❌ Drifted — scope dropped without doc update |
| Roadmap Iteration N | "Capacity = 28 pts" | delivered 32 pts | ⚠️ Minor — over-delivery, retro signal |

**3.3 — Categorise.** **Critical drift** — code violates an ADR invariant, ships an out-of-scope feature without a doc update, or breaks a Vision Doc principle: blocks closeout; file a bug and fix or roll back. **Minor drift** — over/under delivery against the iteration goal, a stale spec doc, an intentional but undocumented design deviation: retro input, does not block.

**3.4 — Cross-epic consistency.** With multiple epics in one sprint, walk the surface they share (data model, API contract, auth boundary, UI navigation). Two epics each passing their own ACs while together breaking a shared invariant is the failure this step exists for.

## Phase 4 — Tech Lead deep code review (impartial)

Flag every issue you would flag if a stranger wrote this code.

**4.1 — Scope the diff.** Find the sprint-start commit (`git log --merges --first-parent --since="<sprint-start-date>" --format='%H %s' main`), then `git diff --name-only <sprint-start-sha>..HEAD`. **Read every changed file in full** — the diff hides surroundings, and bugs hide in surroundings.

**4.2 — Lenses, all of them:**
- **Correctness** — logic errors, edge cases, null handling, type contracts, model ↔ migration ↔ test consistency.
- **Security** — input validation at boundaries, hardcoded secrets, SQL injection via interpolation, auth gate placement, header-trust assumptions.
- **Architecture invariants** — every invariant from the root and sub `CLAUDE.md` (data scoping, naming, async patterns, federation rules, no cross-service imports, append-only tables).
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

**4.5 — Impartiality is this lens's whole job.** If you catch yourself thinking "the author probably had a reason", write the finding anyway — harder, not softer. Your job is to flag anything that would confuse a stranger in six months. Dismissing an intentional finding is the team's call, not yours.

## Phase 5 — Integration suite vs a fresh testing stack

Tear the testing stack down **with volumes** (a stale DB schema is the most common silent-failure cause), rebuild it from scratch (`docker compose … up -d --build --wait` or the project's equivalent — cached images defeat the purpose), then run the full integration suite from the repo root with the standard env block. If a session-start fixture rebuilds the stack, do not skip it; the rebuild *is* the point. Every test must pass; record the runtime. A flake gets one retry, then a follow-up ticket.

## Phase 6 — Dev stack smoke test (the part that catches the silent bugs)

1. **`docker compose down -v`** — cached state from prior runs is the most common silent-failure cause.
2. **Rebuild from scratch** per the documented bring-up commands. **Rebuild the migration runner too, not just the app images.** A containerized migrate step run against a stale/cached runner applies whatever revisions were baked into that image — so a migration added this sprint silently no-ops, the runner reports success, and the freshly-built app then hits a schema missing the new objects. Force the runner to carry current code (`--build`), then **confirm the head actually advanced** by querying the migration-version table. Never trust a green migrate log alone.
3. **Reach the stack via its documented DNS hostname, not `localhost`.** A `localhost:<port>` smoke bypasses Traefik routing, DNS resolution, and healthcheck propagation — exactly the layers most likely to be silently broken for every other operator on the LAN. If the repo's `CLAUDE.md` declares a `TRAEFIK_DOMAIN`, the smoke **must** use it:
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

`agile-11-merge-train` Phase 4 creates `Relates` links between tickets whose PRs collided on shared files, announcing each in the postmortem with a `Jira link created: relates to <KEY>` line. Without an audit, link-creation failures (network blips, permission errors, partial runs) stay invisible and the coupling leaks into next sprint's planning.

**Source the pairs** — preferably from a project audit helper (e.g. `scripts/audit_merge_train_links.py`); otherwise scan this sprint's postmortems for those lines and build `(from_key, to_key, link_type)` manually. **Verify each pair** with `getJiraIssue` (`fields=issuelinks`), confirming a link of the announced type in either direction. For every FAIL, decide before continuing: create it inline with `createIssueLink` (with user confirmation), or file a follow-up if the pairing is disputed. Record the disposition and pass the table to Phase 7.

**A closeout cannot be green while any pair is FAIL without a recorded disposition** — silent skips are the failure mode this phase exists to prevent. FAILs clustering on one hub ticket are retro input: the Phase 4 link step may need hardening.

## Phase 7 — Final closeout report

Produce the report **and publish it to Confluence under a dedicated `Closeouts` folder — a sibling of `Retrospectives`, never inside it.** They are different artifacts by different skills: `agile-15-retro` reads the closeout, not the reverse.

**7.0 — Ensure the folder exists.** Look for `Closeouts — <Project>` as a direct child of `confluence-project-root`. Missing → create it (parent: project root; body: a short description plus a `Sprint | Period | Verdict | Report` index table, pre-populated with this closeout's row). Present → use it as parent and **append** a row, never replace the table.

**7.1 — Publish** a page titled `Closeout <N> — Sprint <N> — <Project>` under that folder, carrying the full report. Capture its page id + URL and return them so the operator and `agile-15-retro` can link to it. **7.2 — Append the index row** (`<Sprint> | <Period> | <Verdict> | <link>`), matching whatever ordering convention the table already uses.

**Required sections:**

- **Ticket roll-up** — every child of the epic, status, brief.
- **Epic AC verification** — `# | AC | Status | Evidence`. Every AC needs **three** pieces of evidence: a code site, test coverage, and a smoke-test observation. Missing one means the AC is not satisfied.
- **Product / Architecture alignment** — the Phase 3 table, Critical and Minor drifts highlighted separately.
- **Tech Lead findings** — the Phase 4 severity-grouped list with `N Critical / M Minor / K Nit` counts at the top.
- **Test coverage** — unit N/N with coverage %, integration N/N against the fresh stack with runtime.
- **Crash monitoring** — "workers + scheduler clean for X min", or the signature, time, and outcome.
- **Critical bugs found + disposition** — per bug: ticket key, severity, fix status.
- **Merge-train link audit** — `from | to | type | status | link_id | disposition` for every announced link.
- **Recommended next steps** — whether to transition the epic to Done; tickets to file; and retro notes, especially **test-coverage gaps**, **spec drift** (Phase 3), and **systemic code-quality patterns** worth a convention update (Phase 4).

**The epic-level Done transition is not part of this skill** — closeout produces a recommendation, and the user transitions only after acknowledging the report.

**Every gap discovered gets coverage.** A smoke bug that surfaced because no integration test exercised path X means the fix PR adds one. Same for Phase 3 drift (add the test that would have failed if it recurred) and a Phase 4 Critical correctness finding.

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
