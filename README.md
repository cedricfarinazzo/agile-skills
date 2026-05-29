# agile-skills

Two complementary plugins for [Claude Code](https://claude.ai/code), distributed from the same marketplace:

- **`agile-skills`** — full product cycle, raw idea → sprint retrospective, integrated with **Confluence** and **Jira**.
- **`dev-skills`** — developer workflow: deep PR review, fix-until-satisfied, rebase with conflict resolution, structured Jira postmortems, multi-PR merge train, and sprint-end closeout gate.

The two pair naturally: `agile-skills` plans and ships the sprint; `dev-skills` reviews, merges, and closes it out.

## Plugin: agile-skills

| # | Skill | Trigger |
|---|-------|---------|
| 1 | `agile-skills:agile-1-create-vision-doc` | New product idea, CEO asks to build X, "start a new project" |
| 2 | `agile-skills:agile-2-create-prd` | "write the PRD", "create the PRD", "draft product requirements" |
| 3 | `agile-skills:agile-3-design-brief` | "write the design brief", "create Specs UI", "design the UI" |
| 4 | `agile-skills:agile-4-create-adr` | "write the ADR", "create architecture decision record", "technical feasibility" |
| 5 | `agile-skills:agile-5-roadmap` | "create the roadmap", "define MVP scope", "plan iterations" |
| 6 | `agile-skills:agile-6-create-epics` | "create epics", "write epics in Jira", "break roadmap into epics" |
| 7 | `agile-skills:agile-7-create-stories` | "write stories", "create user stories", "break epics into stories" |
| 8 | `agile-skills:agile-8-refinement` | "run refinement", "estimate stories", "story points" |
| 9 | `agile-skills:agile-9-sprint-planning` | "plan the sprint", "start sprint", "assemble sprint" |
| 10 | `agile-skills:agile-10-implement` | "implement the sprint", "work the sprint", "pick up tickets", "implement story PROJ-XXX" — **autonomous** sprint loop |
| 11 | `agile-skills:agile-11-dev-review` | "review the PR", "dev review", "approve the pull request" |
| 12 | `agile-skills:agile-12-qa-validation` | "validate the story", "QA check", "test the implementation" |
| 13 | `agile-skills:agile-13-retro` | "run retro", "sprint retrospective", "document retro" |

Skills fire automatically when Claude detects a matching phrase, or invoke directly with `/agile-skills:<skill-name>`.

## Plugin: dev-skills

| # | Skill | Trigger |
|---|-------|---------|
| 1 | `dev-skills:dev-update-pr` | "update pr", "merge main into", "/update-pr" |
| 2 | `dev-skills:dev-review-pr` | "review pr", "/review-pr" |
| 3 | `dev-skills:dev-fix-until-satisfied` | "fix all", "fix everything", "/fix-until-satisfied" |
| 4 | `dev-skills:dev-jira-postmortem` | "comment jira", "jira postmortem", "/jira-postmortem" |
| 5 | `dev-skills:dev-merge-train` | "merge train", "process all open prs", "/merge-train" |
| 6 | `dev-skills:dev-tech-debt-sweep` | "tech debt sweep", "cleanup sweep", "housekeeping", "/tech-debt-sweep" |
| 7 | `dev-skills:dev-sprint-closeout` | "sprint closeout", "close sprint", "/sprint-closeout" |

`dev-merge-train` composes skills 1–5: rebase → review → fix → CI wait → merge → postmortem, sequentially across the open-PR queue. `dev-tech-debt-sweep` then audits the repo for cruft / CI waste / misplaced artifacts before `dev-sprint-closeout` runs the end-of-sprint smoke gate before `agile-13-retro`.

> `dev-merge-train` clears the **merge** queue (open PR → `main`). Its agile-side counterpart, `agile-10-implement`, clears the **build** queue (`To Do` Story → open PR): it autonomously pulls the active board's work (current sprint on a Scrum board, ready column on a Kanban board — never the backlog or a future sprint), orders tickets by Jira dependency links, and runs validate → plan → implement → commit → PR → self-review → In Review per ticket — then hands the PRs to `dev-merge-train`.

## Requirements

- [Claude Code](https://claude.ai/code) v2.1.128+
- Atlassian MCP configured (Confluence + Jira access) — both plugins
- GitHub CLI (`gh`) — `dev-skills` only

## Install

### From GitHub (recommended)

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-skills@agile-skills      # full agile cycle
/plugin install dev-skills@agile-skills        # dev / PR / merge-train skills
/reload-plugins
```

Install one or both. The marketplace ships both plugins from this repo.

### Local (dev / test)

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
claude --plugin-dir ./agile-skills
```

### Codex CLI

Skills follow the [Agent Skills](https://agentskills.io) open standard — copy skill directories to your skills folder:

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
# User-level (all projects)
cp -r agile-skills/skills/* ~/.agents/skills/
# Or repo-level (current project only)
cp -r agile-skills/skills/* .agents/skills/
```

Or use the built-in installer:

```
$skill-installer https://github.com/cedricfarinazzo/agile-skills
```

### GitHub Copilot CLI

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
# User-level (all projects)
cp -r agile-skills/skills/* ~/.copilot/skills/
# Or repo-level
cp -r agile-skills/skills/* .github/skills/
```

Then reload:

```
/skills reload
/skills info agile-1-create-vision-doc
```

Or use the GitHub CLI:

```bash
gh skill install cedricfarinazzo/agile-skills
```

## Cycle order (both plugins together)

```
                    PRODUCT / DISCOVERY
                    ───────────────────
  1. Vision Doc  →  2. PRD  →  3. Design Brief
                            →  4. ADR

                    PLANNING
                    ────────
  5. Roadmap     →  6. Epics  →  7. Stories
                              →  8. Refinement
                                  └─ bundled tool: sprint-shared-file-audit.sh
                                     (run via ${CLAUDE_PLUGIN_ROOT})
                              →  9. Sprint Planning

                    EXECUTION  (autonomous, whole sprint)
                    ─────────────────────────────────────
 ┌────────────────────────────────────────────────────────┐
 │  10. agile-10-implement  (one ticket at a time, in     │
 │      Jira dependency order, no mid-loop confirmation): │
 │    validate ticket        gate: send under-spec'd back │
 │    plan                   🤖 plan comment              │
 │    implement              ADR + Specs UI, all ACs      │
 │    commit + push                                       │
 │    open PR                🤖 pr comment                │
 │    11. agile-11-dev-review  six-lens self-review gate  │
 │    transition → In Review 🤖 status_change            │
 │    monitor PR             review comments / CI / rebase│
 └────────────────────────────────────────────────────────┘

                    PER-PR MERGE  (dev-skills)
                    ────────────
 ┌────────────────────────────────────────────────────────┐
 │  dev-merge-train  (one PR at a time, sequentially):    │
 │    dev-update-pr            rebase on main             │
 │    dev-review-pr            read every file, vs ACs    │
 │    dev-fix-until-satisfied  fix Critical + Minor       │
 │    CI wait                  fresh post-rebase green    │
 │    gh pr merge --squash                                │
 │    dev-jira-postmortem      comment + transition Done  │
 └────────────────────────────────────────────────────────┘

                    SPRINT CLOSE
                    ────────────
  dev-tech-debt-sweep      →  dev-sprint-closeout      →  12. QA Validation         →  13. Retro
  (dev-skills)                (dev-skills)                (agile-skills, Mode B:       (agile-skills)
  cruft + CI + repo audit     dev-stack smoke gate        confirm-after-merge,         back to 5. Roadmap
  report → approve → apply    on closed-out epic          per signed-off story)
```

Plugin ownership:

- **agile-skills:** steps 1–13. Steps 10 (Implement) + 11 (Dev Review) run as one autonomous loop; QA Validation (skill 12) runs in **Mode B (confirm-after-merge)** after the merge train.
- **dev-skills:** the merge box + the dev-stack closeout gate. Plugs in between Dev Review and QA Validation.

Skill 12 (QA Validation) has two entry modes:

- **Mode A — classic.** Story is `In Review`, dev-review-approved but not yet merged. QA pass transitions Story to `Done`. Use when not running `dev-merge-train`.
- **Mode B — confirm-after-merge.** Story is already `Done` (merge train + postmortem closed it). QA confirms ACs hold on `main`, stamps sign-off comment, no transition. Post-merge regression → file Bug, do not reopen Story.

Mode is auto-detected from Story status. See [`skills/agile-12-qa-validation/SKILL.md`](skills/agile-12-qa-validation/SKILL.md) for the full ladder.

Each skill reads from what the previous skill wrote (Confluence pages, Jira issues) and picks up where it left off if re-run. Running a skill twice never duplicates content.

## Confluence structure

Every `agile-skills` skill shares one canonical folder layout (embedded in each Confluence-using skill so it holds regardless of load order). All project docs live under a single root folder created by `agile-1`:

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

**The Roadmap is a short index.** It holds only the guiding principle, an iterations index table (linking to each `MVP` / `Iteration N` child page), a one-row-per-sprint progress rollup, and the parking lot. All deep detail — goal, success criteria, epics-in-scope, per-sprint backlog, decisions, retro write-ups — lives on the `MVP — [Project]` / `Iteration N — [Project]` child pages. Those pages carry a top **Epic Sprint Plan** index table, one detail section per sprint, and a Dev Flow footer.

## Per-repo configuration

Both plugins read project-specific values from the consumer repo's `CLAUDE.md` / `AGENTS.md` (`## Skill configuration` section). `dev-skills` and `agile-10-implement` use:

- `cloudId` — Atlassian cloud id for MCP calls (e.g. `yourorg.atlassian.net`)
- `ticket-prefix-regex` — defaults to `[A-Z]+-\d+`
- `done-status-name` / `todo-status-name` / `in-progress-status-name` / `in-review-status-name` — project state names, matched by substring (e.g. `Done`, `Terminé(e)`, `À faire`)
- Lint / unit / integration commands per language stack
- `base-branch` / `branch-prefix` (default `feature/`) — used by `agile-10-implement`
- Optional `done-transition-id` for fast-path Jira transition

Skills fall back to lookups when values are absent.

## License

MIT
