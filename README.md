# agile-skills

End-to-end agile workflow skills for [Claude Code](https://claude.ai/code). Covers the full product cycle — from raw idea to sprint retrospective — integrated with **Confluence** and **Jira**.

## Skills

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
| 10 | `agile-skills:agile-10-qa-validation` | "validate the story", "QA check", "test the implementation" |
| 11 | `agile-skills:agile-11-retro` | "run retro", "sprint retrospective", "document retro" |
| 12 | `agile-skills:agile-12-implement` | Dev agent assigned a story, "implement story", "start coding" |
| 13 | `agile-skills:agile-13-dev-review` | "review the PR", "dev review", "approve the pull request" |

Skills fire automatically when Claude detects a matching phrase, or invoke directly with `/agile-skills:<skill-name>`.

## Requirements

- [Claude Code](https://claude.ai/code) v2.1.128+
- Atlassian MCP configured (Confluence + Jira access)

## Install

### From GitHub (recommended)

```bash
/plugin marketplace add cedricfarinazzo/agile-skills
/plugin install agile-skills@agile-skills
/reload-plugins
```

### Local (dev / test)

```bash
git clone https://github.com/cedricfarinazzo/agile-skills
claude --plugin-dir ./agile-skills
```

## Agile cycle order

```
1. Vision Doc  →  2. PRD  →  3. Design Brief
                          →  4. ADR
                          →  5. Roadmap  →  6. Epics  →  7. Stories
                                                      →  8. Refinement
                                                      →  9. Sprint Planning
                                                         ↓
                                              12. Implement  →  13. Dev Review  →  10. QA Validation
                                                                                →  11. Retro
```

Each skill reads from what the previous skill wrote (Confluence pages, Jira issues) and picks up where it left off if re-run. Running a skill twice never duplicates content.

## License

MIT
