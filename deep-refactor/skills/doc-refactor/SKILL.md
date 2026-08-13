---
name: doc-refactor
description: "Audit every markdown file in a repo — READMEs, docs/, and agent-instruction files — for lies, drift, duplication and bloat, then ticket and ship the cleanup as a sequenced PR train, with source code frozen and every surviving claim verified against the repo rather than read. Triggers: doc refactor, refactor the docs, clean the docs, documentation audit, README audit, docs are stale, DRY the docs, audit every markdown file."
user-invocable: true
---

# doc-refactor

The third sibling, with the contract inverted once more. `deep-refactor` freezes the test suite; `test-refactor` freezes production code; here **the source is frozen entirely** and the markdown is the object of change. A doc fix that "needs" a code change is out of scope — a doc that disagrees with the code is a finding, the audit says which side is wrong, and if it's the code that's wrong it becomes its own separately-ticketed PR, never smuggled into a doc PR.

**The goal is documentation that is true, findable, DRY and cheap to read.** The failure mode is not ugliness, it is **a confident false statement**: a doc that lies costs more than no doc at all, because a reader acts on it and then debugs the wrong thing. So the proof here is neither a suite nor a coverage number — it is **verification**. Every claim that survives the audit has been executed or resolved against the repo, and an unchecked sentence is a hypothesis wearing the voice of documentation.

**Some markdown is executable.** `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, skill and agent frontmatter — these are loaded into an agent's context and change what it does. Treat them as code with no test suite: a dropped trigger phrase or a deleted rule is a silent behavioral regression that nothing will catch, and they are paid in **tokens on every session, forever**, which makes their size a deliverable and not a matter of taste.

Four phases: **audit → report → ticket → drain**.

## Phase 1 — Audit

**Inventory before you judge.** Every `.md` in the repo, each tagged with its audience and its **load path** — human-browsed on the forge, rendered by a docs site, or auto-loaded into an agent's context. That tag decides every later call: a README optimizes for a newcomer's first ten minutes, a `docs/` page for a reader who already arrived and knows what they want, an instruction file for a machine that will follow it literally and bill you per token.

Then fan out **parallel read-only agents over disjoint slices** (root docs, the `docs/` tree, per-package READMEs, `.github/` templates, agent-instruction files), plus one pass over the docs *toolchain* — site config, nav/sidebar, link checker, generator markers. **Don't stop until you are satisfied of the entire surface**: a second pass over "already read" docs routinely finds a stale command the first pass skimmed past because it looked plausible. Stop only when a pass comes back empty (loop-until-dry).

Classify every file — no doc is skipped because it reads well:

1. **False — fix or delete.** Commands that no longer run, flags that no longer exist, paths that moved, config keys renamed, links and anchors that 404, screenshots of a UI that shipped twice since. Each finding names the check that caught it, and every fix is re-verified by that same check. This is the top of the report: a lie outranks every style improvement below it.
2. **Stale-but-true-once — date it or drop it.** Roadmaps, "coming soon", migration notes for a version nobody runs, changelog prose duplicating the release notes. History belongs in git; a doc describing a state the repo already left is a trap wearing a helpful face.
3. **Duplicated — pick one home, link the rest.** Same fact in N files → one canonical location, the others link to it. But distinguish **deliberate replication**: with no include mechanism at read time, a block may *have* to exist verbatim in many files (a rule an agent must see wherever it lands). That is not duplication to collapse — it is a replicated invariant, and it ships with its sync rule and the one-line command that proves every copy identical, or it degrades into N drifting copies within two commits.
4. **Generated — never hand-edit.** API refs from docstrings, CLI docs from `--help`, TOCs, badge tables. Find the generator and its marker before touching a line: a hand-fix here is overwritten on the next build and silently re-lands the bug. Fix the source or the template; if the generator is gone, the file is now hand-maintained and the report says so out loud.
5. **Bloated — compress.** Rationale narrative, war stories, defensive restatements of a rule already given, placeholder prose in templates telling the reader what to write. Keep the gotcha, cut the lecture — but see the content-loss rule below, which is where compression actually goes wrong.
6. **Missing — write last.** Gaps found by walking a real journey (fresh clone → first successful run → first change shipped), never by imagining an outline of what a project "should" document. Every added doc names an owner and how it will be kept true, or it is just category 2 with a later date.

**Pins point at docs from outside.** Enumerate them before moving or renaming any file or heading: inbound deep links (issues, PRs, blog posts, other repos), docs-site nav and sidebar entries, `#anchor` targets referenced elsewhere, badge and CI-status URLs, `.github/` files whose filename is load-bearing (`ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`), names a tool reads exactly (`CLAUDE.md`, `AGENTS.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md` — the forge surfaces these by path), `${CLAUDE_PLUGIN_ROOT}`-style path references, and any code that reads a markdown file at runtime. A move ships with that inventory or it doesn't ship.

**Verify, don't read.** "The command works" comes from running it in a clean checkout; "the flag exists" from `--help` or the argument parser's source; "the path exists" from the filesystem at HEAD; "the link resolves" from a fetch *plus* an anchor check, since a 200 with a missing `#section` is still a broken instruction; "the example compiles" from executing it; "it matches the code" from reading the code, never the neighbouring doc that agrees with it. Docs are the one artifact where every statement has a checkable referent, so a claim you merely found plausible is a finding you haven't made yet.

**Content loss is the compression failure mode.** Operative tokens — commands, flags, env vars, tool and MCP names, config keys, marker strings, field ids, thresholds, exact error strings — survive a rewrite or the rewrite is a regression. Prose is what you meant to cut; `--no-verify` is not. **Diff per file, not tree-wide**: a token surviving in some *other* doc is not evidence this one kept it, and that masking is exactly how a fully-qualified name degrades into a bare, unusable one in three files at once.

**Instruction files carry silent contracts.** A skill or agent description is a routing key, not a summary: reword it freely, subtract a trigger phrase never — nothing fails, the file just stops matching the wording its users actually type. The same holds for any rule whose only enforcement was the sentence you deleted. Every instruction-file edit diffs its operative content against the previous revision and states what each removal governed; "it read as redundant" is a hypothesis about behavior, and behavior is what you are editing.

## Phase 2 — Report

One synthesized document: falsehoods (each with the check that caught it), stale sections, the **duplication map** naming the chosen home for every repeated fact, replicated invariants with their sync rule, generated files with their generators, compression candidates with measured sizes, the gap list, and any **code defects the audit uncovered** — reported, not fixed. Three baselines attached: total doc bytes, the per-file token cost of everything auto-loaded into an agent's context, and the link/anchor/command checks as a pass table. Publish where the team can act on it; the report is the contract for everything after.

## Phase 3 — Ticket

One ticket = one PR, sequenced:

1. **Falsehood fixes** — the lies, each PR restating the verification that now passes. First, because everything downstream edits the same files and a stale line rewritten is a stale line preserved.
2. **Deletions** — stale sections and dead files, each enumerated in advance with what still covers the topic or why nothing needs to.
3. **Deduplication** — one fact, one home, links from the rest; replicated invariants normalized byte-identical in a single scripted pass, with their sync check added in the same PR.
4. **Compression** — the per-file operative-token diff attached to the PR; auto-loaded instruction files reported with before/after token cost against the baseline.
5. **Gaps, then structural moves last** — new docs written onto the cleaned tree, then renames and file moves, each with its pin inventory, redirect stubs or nav updates in the *same* PR, and every inbound link either fixed or knowingly broken and listed.

Every ticket lists its own out-of-scope items. Source diff in every PR is **empty**, verified mechanically (diff the non-doc paths — zero lines); the only non-markdown files a doc PR may touch are docs-toolchain config (site nav, link-checker config), named in the ticket in advance.

## Phase 4 — Drain

- One branch per ticket off current main; isolated worktrees when parallel. Markdown looks conflict-free and isn't — every ticket in this train rewrites the same handful of READMEs.
- **Re-verify at the merged state, not at authoring time.** Each merged car moves the paths and headings the next car's ticket cites: locate every target by content, never by line number, and re-run the link, anchor and command checks against the branch's own tree rather than trusting the report. A claim that no longer holds is a finding to report, never a silent skip or a blind apply.
- **Do not hand-roll the drain.** Each ticket goes through the project's normal implement → review → merge pipeline (`agile-10-implement` / `agile-11-merge-train` where installed), so every car carries the same validation, phase markers, review receipts and post-merge postmortem as any other ticket. An audit train is a *source of tickets*, never a parallel process with weaker evidence: a car that merges with no marker trail leaves the board unable to say how the change was reviewed, and that gap is invisible precisely because the change shipped fine.
- **Render before you merge.** Markdown is compiled by renderers you don't control — the forge, the docs site, and a model reading the raw text disagree about nested lists, tables, inline HTML, relative links and admonitions. Check the actual rendered page for anything structural; a relative link that resolves on disk can still 404 on the published site.
- **Prove the compression kept its operative tokens.** The per-file before/after diff of commands, flags and keys goes in the PR as output, not as a sentence in the description claiming it was done.
- **A replicated invariant is edited in one scripted pass**, then a grep proves zero stale copies remain. Hand-editing N copies leaves N−1 wrong, and the wrong one is the one that gets read.
- **An instruction-file PR states its behavioral delta** — what an agent will now do differently, and which triggers or rules were reworded versus removed. A diff summary that describes bytes and not behavior has not reviewed the change.
- Merge only on a green CI run you verified yourself; sequential merges; rebase the next branch when file sets intersect. Two identical CI failures are a diagnosis, not a rerun. **Most repos have no doc CI at all** — where nothing checks links or commands, the PR carries the check output itself; "no gate failed" is not evidence when there is no gate.

## Definition of done

Every surviving claim verified by execution or resolution rather than by reading; zero broken links or anchors; the duplication map applied — one fact, one home — and every replicated invariant byte-identical with a check that proves it; auto-loaded instruction files smaller with no operative token or trigger phrase lost; zero source changes in the train; the report updated or superseded; every new lesson (a pin class you hadn't met, a renderer that disagreed, a generator you didn't know existed) written down where the next audit will find it.
