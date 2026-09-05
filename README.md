# agile-skills

### Ship sprints while you sleep. 🌙

[Claude Code](https://claude.ai/code) and [Codex](https://openai.com/codex/) skills that run the whole agile cycle — Vision, PRD, roadmap, then **autonomously code & self-review every Jira ticket into a PR**.

Raw idea → sprint retro, wired into **Confluence** and **Jira**. Seven focused plugins, one marketplace — install only the phases you want, load only the skills you need. You bring the product taste; the agent does the typing.

| Plugin | Phase | Skills | Needs |
|--------|-------|--------|-------|
| [**agile-product**](plugins/agile-product/README.md) | Discovery — *what & why* | Vision Doc, PRD, Design Brief / Specs UI, ADR | Atlassian MCP |
| [**agile-planning**](plugins/agile-planning/README.md) | Planning | Roadmap (+ published Artifact view), Epics, Stories, Refinement, Sprint Planning | Atlassian MCP |
| [**agile-execution**](plugins/agile-execution/README.md) | Build (autonomous) | Implement (+ 6 sub-skills) | Atlassian MCP + `gh` |
| [**agile-merge-review**](plugins/agile-merge-review/README.md) | Merge (formerly `dev-skills`) | Merge Train (+ 4 sub-skills) | `gh` + Atlassian MCP |
| [**agile-sprint-close**](plugins/agile-sprint-close/README.md) | Close | Tech-Debt Sweep, Sprint Closeout, QA Validation, Retro | `gh` + Atlassian MCP |
| [**agile-sprint-drain**](plugins/agile-sprint-drain/README.md) | Drain (autonomous) | Sprint Drain — auto-alternate Implement ↔ Merge Train to a fixed point | `gh` + Atlassian MCP + the two above |
| [**deep-refactor**](plugins/deep-refactor/README.md) | Deep cleanup (out-of-cycle, autonomous) | Deep Refactor (codebase audit → ticket train → PR drain, test contract frozen), Test Refactor (per-suite test cleanup, production frozen, coverage kept), Doc Refactor (every `.md` audited — lies, drift, duplication, bloat — source frozen, claims verified) | `gh` + your tracker |

**Each plugin has its own README with the full skill list, triggers, and detail — linked above.**

⭐ **The headline act:** `agile-execution` pulls the active sprint, walks tickets in Jira dependency order, and drives each one to an open, self-reviewed PR — no mid-loop hand-holding. It even tells you what it's doing as it goes (`▶ VC-123 — implementing`, `✓ VC-123 → In Review`).

User-facing skills keep a global cycle numbering (`agile-1` … `agile-15`) across plugins, so the order is legible at a glance. The two orchestrators (`agile-10-implement`, `agile-11-merge-train`) compose **unnumbered sub-skills** you don't call directly — each dispatched to a scoped subagent (model/effort sized per phase, see each plugin's README). Invoke with `/<plugin>:<skill>`, e.g. `/agile-planning:agile-5-roadmap`.

## Cycle order (all plugins together)

```
                    PRODUCT / DISCOVERY          (agile-product)
                    ───────────────────
  1. Vision Doc  →  2. PRD  →  3. Design Brief
                            →  4. ADR

                    PLANNING                     (agile-planning)
                    ────────
  5. Roadmap     →  6. Epics  →  7. Stories
     └─ short index in Confluence + a published Claude Code
        Artifact view (refreshed by 9 and 15; Confluence stays
        the source of truth, the artifact is regenerated from it)
                              →  8. Refinement
                                  └─ bundled tool: sprint-shared-file-audit.sh
                                     (resolved from the installed skill directory)
                              →  9. Sprint Planning

                    EXECUTION  (agile-execution — autonomous, whole sprint)
                    ─────────────────────────────────────
 ┌────────────────────────────────────────────────────────┐
 │  10. agile-10-implement  (one ticket at a time, in     │
 │      Jira dependency order, no mid-loop confirmation): │
 │    validate ticket   gate: repo-scope + spec readiness │
 │    plan / implement / commit / open PR    🤖 markers   │
 │    implement-review        six-lens self-review gate   │
 │    transition → In Review · monitor PR (comments/CI)   │
 └────────────────────────────────────────────────────────┘

                    PER-PR MERGE  (agile-merge-review)
                    ────────────
 ┌────────────────────────────────────────────────────────┐
 │  agile-11-merge-train  (one PR at a time, sequentially):│
 │    merge-update-pr · merge-review-pr · merge-fix-until- │
 │    satisfied · fresh CI · gh pr merge · postmortem+Done │
 └────────────────────────────────────────────────────────┘

         DRAIN (agile-sprint-drain — autonomous outer loop)
         ──────────────────────────────────────────────────
   agile-sprint-drain  alternates 10 ⇄ 11 to a fixed point:
     each pass: implement eligible To-Do → merge open PRs
     (both orchestrators invoked INLINE — dispatch doesn't nest,
      so the drain ships no agents; only outcomes → ledger) ;
     actionable-work guard keeps retrying while any item can
     advance, STUCK only when all remaining are human-blocked ;
     DRAINED (all Done + merged) hands off to agile-sprint-close

                    SPRINT CLOSE                 (agile-sprint-close)
                    ────────────
  12. tech-debt-sweep  →  13. sprint-closeout  →  14. QA Validation   →  15. Retro
  cruft + CI audit        dev-stack smoke gate     (confirm-after-merge   back to 5. Roadmap
                          on closed-out epic        per signed-off story)
```

Each skill reads from what the previous skill wrote (Confluence pages, Jira issues) and picks up where it left off if re-run. Running a skill twice never duplicates content.

`agile-10-implement` clears the **build** queue (`To Do` Story → open PR); `agile-11-merge-train` clears the **merge** queue (open PR → `main`); `agile-sprint-close` ends the sprint. The same code is reviewed by **three different roles** — author self-review ([implement-review](plugins/agile-execution/README.md)), independent PR review ([merge-review-pr](plugins/agile-merge-review/README.md)), and a global sprint review ([sprint-closeout](plugins/agile-sprint-close/README.md)) — by design, not redundancy.

## Requirements

- [Claude Code](https://claude.ai/code) v2.1.128+ or [Codex CLI](https://openai.com/codex/)
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
/plugin install agile-sprint-drain@agile-skills   # needs execution + merge-review
/plugin install deep-refactor@agile-skills        # out-of-cycle: deep-refactor + test-refactor + doc-refactor
/reload-plugins
```

Install only the phases you run. Common combos: planning + execution + merge-review for an active dev loop; product + planning for discovery only.

### Local (dev / test)

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
claude --plugin-dir ./agile-skills/plugins/agile-execution   # one plugin dir at a time
```

### Codex

Install the same focused plugins from the Codex marketplace:

```bash
codex plugin marketplace add cedricfarinazzo/agile-skills
codex plugin add agile-product@agile-skills
codex plugin add agile-planning@agile-skills
# install any other phase by the same name
```

Codex reads consumer-repository `AGENTS.md` files first. Put the `## Skill configuration` block there; `CLAUDE.md` remains a compatibility fallback.

### GitHub Copilot CLI

Skills follow the [Agent Skills](https://agentskills.io) open standard:

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
cp -r agile-skills/plugins/agile-*/skills/* ~/.copilot/skills/
```

## Confluence structure & per-repo configuration

All Confluence-using skills share one canonical folder layout with a **short-index Roadmap** (detail on `MVP` / `Iteration N` child pages) — see [agile-planning ▸ Confluence structure](plugins/agile-planning/README.md#confluence-structure).

The dev-side plugins read project values (`cloudId`, status names, lint commands, board/branch settings) from the consumer repo's `AGENTS.md` / `CLAUDE.md` — see each plugin README ([execution](plugins/agile-execution/README.md#configuration), [merge-review](plugins/agile-merge-review/README.md#configuration)).

## License

MIT
