# agile-planning

**Planning** plugin — turns the approved product/architecture docs into a Roadmap, Jira Epics + Stories, a refined backlog, and a launched sprint. Integrates with **Confluence + Jira**.

Part of [agile-skills](../../README.md). Needs the Atlassian MCP.

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-planning@agile-skills
/reload-plugins
```

## Skills

| # | Skill | Produces | Trigger |
|---|-------|----------|---------|
| 5 | `agile-5-roadmap` | Roadmap index + MVP/Iteration scope pages + published Artifact view | "create the roadmap", "define MVP scope", "plan iterations" |
| 6 | `agile-6-create-epics` | Epics in Jira, linked to the MVP/Iteration page | "create epics", "break roadmap into epics" |
| 7 | `agile-7-create-stories` | User Stories in Jira under each Epic | "write stories", "create user stories" |
| 8 | `agile-8-refinement` | Points + ACs + DoD; `refined` / `not-ready` labels | "run refinement", "estimate stories", "story points" |
| 9 | `agile-9-sprint-planning` | A launched Jira sprint, capacity-fit, dependency-ordered | "plan the sprint", "start sprint", "assemble sprint" |

## The short-index Roadmap (core model)

`agile-5-roadmap` keeps the **Roadmap page a short index** — guiding principle + an iterations index table (links to each child page) + a one-row-per-sprint progress rollup + parking lot. **All deep detail lives on child pages:** `MVP — [Project]` and `Iteration N — [Project]`, each carrying an **Epic Sprint Plan** index table and one detail section per sprint (goal, decisions locked, backlog, scope, success criteria, conclusion + retro/closeout links). Never inline that detail into the Roadmap.

Writers across the cycle keep this split:
- `agile-9-sprint-planning` writes the per-sprint backlog + Epic Sprint Plan row on the MVP/Iteration page; only a one-row rollup goes on the Roadmap index.
- `agile-8-refinement` records refined-backlog detail in the relevant `## Sprint [N]` section, never the index.
- `agile-15-retro` flips the sprint section + index row to ✅ Complete and adds conclusion/retro links.

## The Roadmap Artifact (published view)

`agile-5-roadmap` also publishes the Roadmap index as an optional **Artifact** view when the host supports it — a private, shareable web page stakeholders can read without a Confluence seat, rendering the progress rollup as a real velocity chart instead of a table of dashes.

**Confluence stays the source of truth; the artifact is a regenerated view of it.** Its identity is a `📊 Live roadmap:` line on the Confluence Roadmap page holding the artifact URL — every refresher reads that URL and republishes to it, so the link stakeholders already hold keeps working:

- `agile-5-roadmap` publishes it (INIT) or refreshes it (ITERATION), and writes the URL back to Confluence on first publish.
- `agile-9-sprint-planning` refreshes it after the sprint rollup row lands.
- `agile-15-retro` refreshes it at sprint close, when delivered-vs-committed numbers become real.

The page is self-contained (a strict CSP blocks every external host), theme-aware, responsive, and keeps a stable `🗺️` favicon across redeploys. If the Artifact tool is unavailable the step is skipped and noted — Confluence alone is a complete result.

## Confluence structure

Canonical folder layout, identical across **every** agile-skills plugin (embedded verbatim in each Confluence-using skill):

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

## Bundled tool — shared-file collision audit

`agile-8-refinement` bundles `scripts/sprint-shared-file-audit.sh`. It surfaces cross-Story file overlap so blocking Jira links are added at refinement instead of being rediscovered as merge conflicts. **Invoke it via the plugin root** (a bare relative path won't resolve when installed as a plugin):

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/agile-8-refinement/scripts/sprint-shared-file-audit.sh" ABC-28 ABC-30 ABC-39
```

On Codex, resolve this script relative to the loaded `SKILL.md` instead. See `skills/agile-8-refinement/docs/sprint-shared-file-audit.md` for full usage.

## How it works

Read-before-write, idempotent, resumable. Refinement is the gate: only `refined` Stories enter a sprint; `not-ready` ones are listed but excluded. Sprint planning enforces a capacity buffer, dependency order, and a real (testable) sprint goal.

## Where it fits

After **agile-product**, before **agile-execution**. See the [full cycle](../../README.md#cycle-order).
