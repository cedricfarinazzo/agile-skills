---
name: doc-refactor
description: "Audit every markdown file in a repo — READMEs, docs/, and agent-instruction files — for lies, drift, duplication and bloat, then ticket and ship the cleanup as a sequenced PR train, with source code frozen and every surviving claim verified against the repo rather than read. Triggers: doc refactor, refactor the docs, clean the docs, documentation audit, README audit, docs are stale, DRY the docs, audit every markdown file."
user-invocable: true
---

# doc-refactor

## Host execution

**Claude Code:** retain the agent-dispatch and concurrency behavior defined below. **Codex:** use only the inline behavior stated here.

When loaded by Codex, run every audit slice, scanner pass, ticket step, and drain step inline and sequentially. Never spawn, request, or claim agents or subagents; replace parallel read-only fan-out with ordered passes over the same disjoint areas, preserving the full evidence and coverage contract.

## Purpose

The third sibling, with the contract inverted once more. `deep-refactor` freezes the test suite; `test-refactor` freezes production code; here **the source is frozen entirely** and the markdown is the object of change. A doc fix that "needs" a code change is out of scope — a doc that disagrees with the code is a finding, the audit says which side is wrong, and if it's the code that's wrong it becomes its own separately-ticketed PR, never smuggled into a doc PR.

**The goal is documentation that is true, findable, DRY and cheap to read.** The failure mode is not ugliness, it is **a confident false statement**: a doc that lies costs more than no doc at all, because a reader acts on it and then debugs the wrong thing. So the proof here is neither a suite nor a coverage number — it is **verification**. Every claim that survives the audit has been executed or resolved against the repo, and an unchecked sentence is a hypothesis wearing the voice of documentation.

**Some markdown is executable.** `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, skill and agent frontmatter — these are loaded into an agent's context and change what it does. Treat them as code with no test suite: a dropped trigger phrase or a deleted rule is a silent behavioral regression that nothing will catch, and they are paid in **tokens on every session, forever**, which makes their size a deliverable and not a matter of taste.

### `rules` — standing-instruction hygiene

When invoked with `rules`, audit the whole standing-rule corpus in addition to the normal markdown inventory: root and nested `AGENTS.md`/`CLAUDE.md`, agent and skill instructions, conventions, and binding ADR constraints. A rule is a directive that changes behavior across tasks, not a bounded work-status note; extract any durable directive buried in a status log instead of retaining the log wholesale. For each rule, state its neutral behavioral impact and its continuing context cost, then flag only evidenced problems: `Redundant`, `Stale / superseded`, `Misfiled`, `Low-yield ritual`, `Not actionable`, `Brittle`, or `Conflicts`. A healthy rule has no manufactured critique. Compare the corpus with installed skills and current ADRs before calling a rule duplicate, and preserve intentionally replicated invariants with their existing sync proof.

Four phases: **audit → report → ticket → drain**.

## Phase 1 — Audit

**Inventory before you judge.** Every `.md` in the repo, each tagged with its audience and its **load path** — human-browsed on the forge, rendered by a docs site, or auto-loaded into an agent's context. That tag decides every later call: a README optimizes for a newcomer's first ten minutes, a `docs/` page for a reader who already arrived and knows what they want, an instruction file for a machine that will follow it literally and bill you per token.

On Claude Code, fan out **parallel read-only agents over disjoint slices** (root docs, the `docs/` tree, per-package READMEs, `.github/` templates, agent-instruction files), plus one pass over the docs *toolchain* — site config, nav/sidebar, link checker, generator markers. On Codex, cover those slices and the toolchain in order inline. **Loop until dry**: a second pass over "already read" docs routinely finds a stale command the first pass skimmed past because it looked plausible. The exit condition is a pass that comes back empty.

Classify every file — no doc is skipped because it reads well:

1. **False — fix or delete.** Commands that no longer run, flags that no longer exist, paths that moved, config keys renamed, links and anchors that 404, screenshots of a UI that shipped twice since. Each finding names the check that caught it, and every fix is re-verified by that same check. This is the top of the report: a lie outranks every style improvement below it.
2. **Stale-but-true-once — date it or drop it.** Roadmaps, "coming soon", migration notes for a version nobody runs, changelog prose duplicating the release notes. History belongs in git; a doc describing a state the repo already left is a trap wearing a helpful face.
3. **Duplicated — pick one home, link the rest.** Same fact in N files → one canonical location, the others link to it. But distinguish **deliberate replication**: with no include mechanism at read time, a block may *have* to exist verbatim in many files (a rule an agent must see wherever it lands). That is not duplication to collapse — it is a replicated invariant, and it ships with its sync rule and the one-line command that proves every copy identical, or it degrades into N drifting copies within two commits.
4. **Generated — never hand-edit.** API refs from docstrings, CLI docs from `--help`, TOCs, badge tables. Find the generator and its marker before touching a line: a hand-fix here is overwritten on the next build and silently re-lands the bug. Fix the source or the template; if the generator is gone, the file is now hand-maintained and the report says so out loud.
5. **Bloated — compress.** Rationale narrative, war stories, defensive restatements of a rule already given, placeholder prose in templates telling the reader what to write. Keep the gotcha, cut the lecture — but see the content-loss rule below, which is where compression actually goes wrong.
6. **A bare count is drift with a delay fuse — state the property, not the number.** "The 14 services", "all 6 plugins", "23 tiles": correct the day it was written, maintained thereafter by whoever next adds one, and silently wrong until a reader happens to re-count. Prose cannot hold a cardinality honestly, because **nothing fails when it rots** — unlike a broken link or a dead command, no check exists that would notice. Replace the number with the property and the command that derives it, or point at the file that is the source of truth; where a count genuinely must appear, it carries that command beside it. An existing bare count becomes category 1 the moment it disagrees with the tree, and the fix is to remove the cardinality, not to update it to today's value.
7. **Missing — write last.** Gaps found by walking a real journey (fresh clone → first successful run → first change shipped), never by imagining an outline of what a project "should" document. Every added doc names an owner and how it will be kept true, or it is just category 2 with a later date.

**Pins point at docs from outside.** Enumerate them before moving or renaming any file or heading: inbound deep links (issues, PRs, blog posts, other repos), docs-site nav and sidebar entries, `#anchor` targets referenced elsewhere, badge and CI-status URLs, `.github/` files whose filename is load-bearing (`ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`), names a tool reads exactly (`CLAUDE.md`, `AGENTS.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` — the forge surfaces these by path), `${CLAUDE_PLUGIN_ROOT}`-style path references, and any code that reads a markdown file at runtime. A move ships with that inventory or it doesn't ship.

**Verify, don't read.** "The command works" comes from running it in a clean checkout; "the flag exists" from `--help` or the argument parser's source; "the path exists" from the filesystem at HEAD; "the link resolves" from a fetch *plus* an anchor check, since a 200 with a missing `#section` is still a broken instruction; "the example compiles" from executing it; "it matches the code" from reading the code, never the neighbouring doc that agrees with it. Docs are the one artifact where every statement has a checkable referent, so a claim you merely found plausible is a finding you haven't made yet.

**Content loss is the compression failure mode.** Operative tokens — commands, flags, env vars, tool and MCP names, config keys, marker strings, field ids, thresholds, exact error strings — survive a rewrite or the rewrite is a regression. Prose is what you meant to cut; `--no-verify` is not. **Diff per file, not tree-wide**: a token surviving in some *other* doc is not evidence this one kept it, and that masking is exactly how a fully-qualified name degrades into a bare, unusable one in three files at once.

**Instruction files carry silent contracts.** A skill or agent description is a routing key, not a summary: reword it freely, subtract a trigger phrase never — nothing fails, the file just stops matching the wording its users actually type. The same holds for any rule whose only enforcement was the sentence you deleted. Every instruction-file edit diffs its operative content against the previous revision and states what each removal governed; "it read as redundant" is a hypothesis about behavior, and behavior is what you are editing.

## Phase 2 — Report

One synthesized document: falsehoods (each with the check that caught it), stale sections, the **duplication map** naming the chosen home for every repeated fact, replicated invariants with their sync rule, generated files with their generators, compression candidates with measured sizes, the gap list, and any **code defects the audit uncovered** — reported, not fixed. Three baselines attached: total doc bytes, the per-file token cost of everything auto-loaded into an agent's context, and the link/anchor/command checks as a pass table. Publish where the team can act on it; the report is the contract for everything after.

### Cleanup train ledger

The report carries one durable row per candidate: `ID`, surviving claim or reader behavior, evidence, canonical home, pins, frozen source boundary, validation command, dependency, and status. Status is exactly `Proposed`, `Approved`, `In progress`, `Blocked`, `Superseded`, `Done`, or `Rejected` (with a one-line reason). A change whose truth cannot be established from the repository is `Blocked — verification required`; do not invent its replacement. A replicated invariant or instruction that is deliberately load-bearing is `Deliberate — do not fix`, not duplication to collapse.

## Phase 3 — Ticket

One ticket = one PR, sequenced:

1. **Falsehood fixes** — the lies, each PR restating the verification that now passes. First, because everything downstream edits the same files and a stale line rewritten is a stale line preserved.
2. **Deletions** — stale sections and dead files, each enumerated in advance with what still covers the topic or why nothing needs to.
3. **Deduplication** — one fact, one home, links from the rest; replicated invariants normalized byte-identical in a single scripted pass, with their sync check added in the same PR.
4. **Compression** — the per-file operative-token diff attached to the PR; auto-loaded instruction files reported with before/after token cost against the baseline.
5. **Gaps, then structural moves last** — new docs written onto the cleaned tree, then renames and file moves, each with its pin inventory, redirect stubs or nav updates in the *same* PR, and every inbound link either fixed or knowingly broken and listed.

Every ticket lists its own out-of-scope items. Source diff in every PR is **empty**, verified mechanically (diff the non-doc paths — zero lines); the only non-markdown files a doc PR may touch are docs-toolchain config (site nav, link-checker config), named in the ticket in advance.

Every ticket is executable with no audit-session context. State the surviving reader behavior, exact in-scope and tempting-but-out-of-scope paths, canonical post-change home, frozen source boundary, pins, repository-native commands with expected results, and specific STOP conditions (drift, a new pin, a required source edit, or a failed claim verification). End with a **prevention decision**: `Guard added`, `Ownership recorded`, or `No guard justified`. Add a guard only when it is the cheapest independent proof; never add a brittle link/source grep or permanent instruction merely to make the ticket look complete.

## Phase 4 — Drain

- One branch per ticket off current main; isolated worktrees when parallel. Markdown looks conflict-free and isn't — every ticket in this train rewrites the same handful of READMEs.
- **Re-verify at the merged state, not at authoring time.** Each merged car moves the paths and headings the next car's ticket cites: locate every target by content, never by line number, and re-run the link, anchor and command checks against the branch's own tree rather than trusting the report. A claim that no longer holds is a finding to report, never a silent skip or a blind apply.
- **Reconcile the ledger before every car.** Re-check every ready candidate against current main. Mark independently fixed work `Superseded`; refresh drifted evidence and scope before it can run; retain a reintroduced resolved problem as `Possible regression`, not a duplicate; and leave an evidence-backed `Rejected` or `Deliberate — do not fix` row visible so the next audit does not relitigate it. Drain all remaining `Approved` work without pausing for a checkpoint.
- **Do not hand-roll the drain.** Each ticket goes through the project's normal implement → review → merge pipeline (`agile-10-implement` / `agile-11-merge-train` where installed), so every car carries the same validation, phase markers, review receipts and post-merge postmortem as any other ticket. An audit train is a *source of tickets*, never a parallel process with weaker evidence: a car that merges with no marker trail leaves the board unable to say how the change was reviewed, and that gap is invisible precisely because the change shipped fine.
- **Render before you merge.** Markdown is compiled by renderers you don't control — the forge, the docs site, and a model reading the raw text disagree about nested lists, tables, inline HTML, relative links and admonitions. Check the actual rendered page for anything structural; a relative link that resolves on disk can still 404 on the published site.
- **Prove the compression kept its operative tokens.** The per-file before/after diff of commands, flags and keys goes in the PR as output, not as a sentence in the description claiming it was done.
- **A replicated invariant is edited in one scripted pass**, then a grep proves zero stale copies remain. Hand-editing N copies leaves N−1 wrong, and the wrong one is the one that gets read.
- **An instruction-file PR states its behavioral delta** — what an agent will now do differently, and which triggers or rules were reworded versus removed. A diff summary that describes bytes and not behavior has not reviewed the change.
- Merge only on a green CI run you verified yourself; sequential merges; rebase the next branch when file sets intersect. Two identical CI failures are a diagnosis, not a rerun. **Most repos have no doc CI at all** — where nothing checks links or commands, the PR carries the check output itself; "no gate failed" is not evidence when there is no gate.

## Work discovered mid-phase — fix it in the ticket; a new ticket is the exception

Every phase discovers work its ticket did not plan for. A new ticket costs a refinement slot, a review, a merge and a cold re-read, and discovered work almost always belongs to the ticket that found it.

**1. Default: do it here.** Anything that makes this change correct, complete or consistent with the code it touches goes into this ticket's diff, even when that makes the PR larger: adjacent tests and docs, a missed call site, a flaky test the change exposes, cleanup beside edited code. The ticket's points absorb it. Never split a ticket's own remainder into follow-ups.

**2. File a ticket only when** the user asked for one, or a critical defect (runtime error, data corruption, security, migration drift) cannot ship inside this change, including because this skill's scope forbids touching it. Create one ticket per defect, never several small ones.

**3. Everything else is an observation**: one line in the PR body or the report for a human to promote. Never a ticket, and never a comment-only TODO in the code.

**When you do file:** the product backlog is the default; the current sprint only if the defect blocks the sprint goal or a human asked. **Point it at creation** — a ticket minted mid-phase never returns through refinement, so unpointed here is unpointed forever; `unsized` + a one-line reason is a recorded decision, an empty field is not.

## Definition of done

Every surviving claim verified by execution or resolution rather than by reading; zero broken links or anchors; the duplication map applied — one fact, one home — and every replicated invariant byte-identical with a check that proves it; auto-loaded instruction files smaller with no operative token or trigger phrase lost; zero source changes in the train; the report updated or superseded; every new lesson (a pin class you hadn't met, a renderer that disagreed, a generator you didn't know existed) written down where the next audit will find it.
