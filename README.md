# agile-skills

Five focused [Claude Code](https://claude.ai/code) plugins for the full agile cycle — raw idea → sprint retrospective — integrated with **Confluence** and **Jira**. Distributed from one marketplace; install only the phases you want so you load only the skills you need.

| Plugin | Phase | Skills | Needs |
|--------|-------|--------|-------|
| **agile-product** | Discovery — *what & why* | Vision Doc, PRD, Design Brief / Specs UI, ADR | Atlassian MCP |
| **agile-planning** | Planning | Roadmap, Epics, Stories, Refinement, Sprint Planning | Atlassian MCP |
| **agile-execution** | Build (autonomous) | Implement, Dev Review | Atlassian MCP + `gh` |
| **agile-merge-review** | Merge (formerly `dev-skills`) | Update-PR, Review-PR, Fix-until-satisfied, Jira Postmortem, Merge Train | `gh` + Atlassian MCP |
| **agile-sprint-close** | Close | Tech-Debt Sweep, Sprint Closeout, QA Validation, Retro | `gh` + Atlassian MCP |

Skills keep their global cycle numbering (`agile-1` … `agile-13`) across plugins, so the order is still legible. Invoke with `/<plugin>:<skill>`, e.g. `/agile-planning:agile-5-roadmap`.

## Skills by plugin

### agile-product
| # | Skill | Trigger |
|---|-------|---------|
| 1 | `agile-1-create-vision-doc` | New product idea, "start a new project", "create vision doc" |
| 2 | `agile-2-create-prd` | "write the PRD", "draft product requirements" |
| 3 | `agile-3-design-brief` | "write the design brief", "create Specs UI", "integrate mockups" |
| 4 | `agile-4-create-adr` | "write the ADR", "architecture decisions", "technical feasibility" |

### agile-planning
| # | Skill | Trigger |
|---|-------|---------|
| 5 | `agile-5-roadmap` | "create the roadmap", "define MVP scope", "plan iterations" |
| 6 | `agile-6-create-epics` | "create epics", "break roadmap into epics" |
| 7 | `agile-7-create-stories` | "write stories", "create user stories" |
| 8 | `agile-8-refinement` | "run refinement", "estimate stories", "story points" |
| 9 | `agile-9-sprint-planning` | "plan the sprint", "start sprint", "assemble sprint" |

### agile-execution
| # | Skill | Trigger |
|---|-------|---------|
| 10 | `agile-10-implement` | "implement the sprint", "work the sprint", "pick up tickets" — **autonomous** loop |
| 11 | `agile-11-dev-review` | "review the PR", "dev review", "approve the pull request" |

### agile-merge-review
| # | Skill | Trigger |
|---|-------|---------|
| 1 | `dev-update-pr` | "update pr", "merge main into", "/update-pr" |
| 2 | `dev-review-pr` | "review pr", "/review-pr" |
| 3 | `dev-fix-until-satisfied` | "fix all", "fix everything", "/fix-until-satisfied" |
| 4 | `dev-jira-postmortem` | "comment jira", "jira postmortem", "/jira-postmortem" |
| 5 | `dev-merge-train` | "merge train", "process all open prs", "/merge-train" |

### agile-sprint-close
| # | Skill | Trigger |
|---|-------|---------|
| — | `dev-tech-debt-sweep` | "tech debt sweep", "cleanup sweep", "housekeeping" |
| — | `dev-sprint-closeout` | "sprint closeout", "close sprint", "/sprint-closeout" |
| 12 | `agile-12-qa-validation` | "validate the story", "QA check" — confirm-after-merge |
| 13 | `agile-13-retro` | "run retro", "sprint retrospective", "document retro" |

Skills fire automatically when Claude detects a matching phrase, or invoke directly with `/<plugin>:<skill>`.

## How the pieces compose

`agile-10-implement` clears the **build** queue (`To Do` Story → open PR): it autonomously pulls the active board's work (current sprint on a Scrum board, ready column on a Kanban board — never the backlog or a future sprint), orders tickets by Jira dependency links, and runs validate → plan → implement → commit → PR → self-review (`agile-11-dev-review`) → In Review per ticket. `dev-merge-train` (agile-merge-review) then clears the **merge** queue (open PR → `main`): rebase → deep review → fix → fresh CI → merge → Jira postmortem + Done, one PR at a time. `agile-sprint-close` ends the sprint: tech-debt sweep → closeout smoke gate → QA confirm-after-merge → retro.

## Requirements

- [Claude Code](https://claude.ai/code) v2.1.128+
- Atlassian MCP configured (Confluence + Jira) — all plugins use Jira/Confluence
- GitHub CLI (`gh`) — `agile-execution`, `agile-merge-review`, `agile-sprint-close`

## Install

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
# install any subset:
/plugin install agile-product@agile-skills
/plugin install agile-planning@agile-skills
/plugin install agile-execution@agile-skills
/plugin install agile-merge-review@agile-skills
/plugin install agile-sprint-close@agile-skills
/reload-plugins
```

Install only the phases you run. Common combos: planning + execution + merge-review for an active dev loop; product + planning for discovery only.

### Local (dev / test)

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
claude --plugin-dir ./agile-skills/agile-execution   # one plugin at a time
```

### Codex CLI / GitHub Copilot CLI

Skills follow the [Agent Skills](https://agentskills.io) open standard — copy the skill directories you want:

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
cp -r agile-skills/agile-*/skills/* ~/.agents/skills/      # Codex: all, or pick per plugin
cp -r agile-skills/agile-*/skills/* ~/.copilot/skills/     # Copilot
```

## Cycle order (all plugins together)

```
                    PRODUCT / DISCOVERY          (agile-product)
                    ───────────────────
  1. Vision Doc  →  2. PRD  →  3. Design Brief
                            →  4. ADR

                    PLANNING                     (agile-planning)
                    ────────
  5. Roadmap     →  6. Epics  →  7. Stories
                              →  8. Refinement
                                  └─ bundled tool: sprint-shared-file-audit.sh
                                     (run via ${CLAUDE_PLUGIN_ROOT})
                              →  9. Sprint Planning

                    EXECUTION  (agile-execution — autonomous, whole sprint)
                    ─────────────────────────────────────
 ┌────────────────────────────────────────────────────────┐
 │  10. agile-10-implement  (one ticket at a time, in     │
 │      Jira dependency order, no mid-loop confirmation): │
 │    validate ticket   gate: repo-scope + spec readiness │
 │    plan / implement / commit / open PR    🤖 markers   │
 │    11. agile-11-dev-review  six-lens self-review gate  │
 │    transition → In Review · monitor PR (comments/CI)   │
 └────────────────────────────────────────────────────────┘

                    PER-PR MERGE  (agile-merge-review)
                    ────────────
 ┌────────────────────────────────────────────────────────┐
 │  dev-merge-train  (one PR at a time, sequentially):    │
 │    dev-update-pr · dev-review-pr · dev-fix-until-       │
 │    satisfied · fresh CI · gh pr merge · postmortem+Done│
 └────────────────────────────────────────────────────────┘

                    SPRINT CLOSE                 (agile-sprint-close)
                    ────────────
  dev-tech-debt-sweep  →  dev-sprint-closeout  →  12. QA Validation   →  13. Retro
  cruft + CI audit        dev-stack smoke gate     (confirm-after-merge   back to 5. Roadmap
                          on closed-out epic        per signed-off story)
```

Each skill reads from what the previous skill wrote (Confluence pages, Jira issues) and picks up where it left off if re-run. Running a skill twice never duplicates content.

**QA Validation (skill 12) is confirm-after-merge only.** By the time it runs, the Story was already merged + transitioned to `Done` by `dev-merge-train` / `dev-jira-postmortem`. QA confirms the ACs hold on `main` and stamps a sign-off comment — it never transitions the Story. A post-merge regression is filed as a new Bug (linked `is caused by`), never a reopen. See [`agile-sprint-close/skills/agile-12-qa-validation/SKILL.md`](agile-sprint-close/skills/agile-12-qa-validation/SKILL.md).

## Confluence structure

Every Confluence-using skill shares one canonical folder layout (embedded in each skill so it holds regardless of load order). All project docs live under a single root folder created by `agile-1`:

```
📁 [Project Name]                   (root — agile-1)
├── 📄 Vision Doc — [Project]       (agile-1)
├── 📄 PRD — [Project]              (agile-2)
├── 📄 Design Brief — [Project]     (agile-3 BRIEF)
├── 📄 Specs UI — [Project]         (agile-3 INTEGRATE)
├── 📄 ADR — [Project]              (agile-4)
├── 📄 Roadmap — [Project]          (agile-5 — SHORT INDEX only)
│   ├── 📄 MVP — [Project]          (agile-5; per-sprint detail by agile-9, refined backlog by agile-8, conclusions by agile-13)
│   ├── 📄 Iteration 1 — [Project]  (agile-5 ITERATION)
│   └── 📄 Iteration N — [Project]
├── 📁 Retrospectives — [Project]   (folder, agile-13; one Retro page per sprint)
└── 📁 Closeouts — [Project]        (folder, dev-sprint-closeout — sibling of Retrospectives, NOT inside it)
```

**The Roadmap is a short index** — guiding principle, an iterations index table (linking to each `MVP` / `Iteration N` child page), a one-row-per-sprint progress rollup, and the parking lot. All deep detail — goal, success criteria, epics-in-scope, per-sprint backlog, decisions, retro write-ups — lives on the `MVP — [Project]` / `Iteration N — [Project]` child pages, which carry a top **Epic Sprint Plan** index table, one detail section per sprint, and a Dev Flow footer.

## Per-repo configuration

`agile-execution`, `agile-merge-review`, and `agile-sprint-close` read project-specific values from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`## Skill configuration` section):

- `cloudId` — Atlassian cloud id for MCP calls (e.g. `yourorg.atlassian.net`)
- `ticket-prefix-regex` — defaults to `[A-Z]+-\d+`
- `repo` / `repo-component-map` — current repo + label/component → repo mapping (used by `agile-10-implement`'s repo-scope gate)
- `done-status-name` / `todo-status-name` / `in-progress-status-name` / `in-review-status-name` / `backlog-status-name` — project state names, matched by substring (e.g. `Done`, `Terminé(e)`, `À faire`)
- Lint / unit / integration commands per language stack
- `base-branch` / `branch-prefix` (default `feature/`) — used by `agile-10-implement`
- Optional `done-transition-id` for fast-path Jira transition; optional `board-id` / `board-type`

Skills fall back to lookups when values are absent.

## License

MIT
