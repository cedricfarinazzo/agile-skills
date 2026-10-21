# Planning page templates

Skeletons for the Roadmap family. The `##` headings and their order are fixed by the canonical layout table in every Confluence-using skill; this file gives the fields. Keep every heading even when empty (`—`), so an agent can patch a section by name. History goes in `## Change history`, never inline.

A `## Properties` section is a two-column `Field | Value` table. When the integration can write macros, wrap it in the Page Properties macro so a Page Properties Report can roll it up; the agent still updates the rollup rows itself.

## Roadmap — [Project]

```
# Roadmap — [Project]

## Status
Current: [Iteration N] · [Sprint N] ([status]) · Last updated: [date]
📊 Live roadmap: [artifact URL]
Related: [PRD] · [ADR] · [Decision Log] · [Working Agreements] · [Retrospectives] · [Closeouts]

## Guiding principle
[one sentence]

## Iterations
| Iteration | Status | Sprints | Period | Headline (≤ 120 chars) | Page |

## Progress
| Sprint | Iteration | Theme | Committed | Delivered | Status | Sprint page |
One row per sprint of the current iteration; one totals row per closed iteration (`MVP — S1–S12 | — | <theme> | <Σ committed> | <Σ delivered> | ✅ Complete | <iteration page>`).

## Parking lot
[N] ideas · [N] rejected → [Parking Lot — Project]

## Next step
→ [one line: the next skill to run and its input]

## Change history
| Date | Change | By |
```

Velocity cells are points only (`delivered` / `committed` as integers); tickets counts go on the Sprint page.

## MVP / Iteration N — [Project]

```
# Iteration N — [Project]

## Properties
| Status | Not started / Planned / In progress / ✅ Complete |
| Sprints | S[a]–S[b] |
| Period | [start] → [end] |
| Epics | [keys] |
| Release | [tag, sha] (when closed) |

## Goal
[current goal, one paragraph]
| Date | Goal change | Decision |        ← goal history; the original goal is the first row

## Success criteria
| # | Criterion | Source (PRD §/KPI) | Result |

## Epics in scope
| Epic | Jira | Why | Complexity | Owner | Sprint | Status |

## Sprints
| Sprint | Theme | Period | Committed | Delivered | Status | Retro | Closeout |

## Scope changes
| Date | Change | Decision |

## Dependencies and risks
| Kind (seam / risk) | Description | Affects | Status |

## Feedback carried in
[2–5 bullets from the previous retro that shaped this scope, each linking the retro]

## Research record
[findings that shaped the scope: what was evaluated, the result, the link]

## Closing summary
[at close: what the iteration delivered, totals, release; links]

## Change history
| Date | Change | By |
```

## Sprint N — [Project]

```
# Sprint N — [Project]

## Properties
| Iteration | [page link] |
| Theme | [short theme] |
| Status | Planned / In progress / ✅ Complete |
| Period (planned) | [start] → [end] |
| Period (actual) | [start] → [end] |
| Jira sprint | [id], board [id] |
| Epics | [keys] |
| Committed | [pts] ([N] tickets) |
| Delivered | [pts] ([N] tickets) |
| Added after start | [N] tickets / [pts] |
| Carried over | [N] |
| Closeout | [verdict] → [link] |
| Retro | [link] |
| Explainer | [artifact link] |

## Goal
"[goal as committed in Jira]" — [Achieved / Partially achieved / Not achieved] ([one clause why])

## Scope
In: … · Out: …

## Decisions
| ID | Title |        ← text lives in the Decision Log

## Backlog
| Rank | Key | Type | Epic | Summary | Pts | Layer | Depends on | Outcome |
Unplanned tickets are rows with Rank `+`. Outcome: Done / Won't Do / Carried / In progress.

## Build order
[roots → … → convergence; collision sets to merge adjacently]

## Success criteria
| # | Criterion | Source | Result |

## Risks
| Risk | Mitigation | Outcome |

## Conclusion
Shipped: … · Slipped: … · Lessons: [3–5 bullets, each linking the Retro] · Follow-ups: [keys]
(empty until the retro; written once)

## Notes
[code grounding, migration order, tooling notes, post-close additions — anything no other heading fits]

## Change history
| Date | Change | By |
```

## Decision Log — [Project] and its range pages

Register on the Decision Log page, one row per decision, newest last:

```
## Register
| ID | Alias | Date | By | Title | Status | Scope | Supersedes / Amends | ADR § | Entry |
```

- **ID** `D###`, continuous across the project, never reused. **Alias** keeps a legacy id (`⑲`, `㊹a`) when one existed.
- **Status** `active` / `amended by D###` / `superseded by D###`. An amendment is a new entry that points at the one it amends; the old entry's text is never edited, only its Status cell.
- **Scope** the iteration and sprint it governs (`It2 / S37`), or `project`.
- **Entry** links the `## D###` section on its range page.

Range page `Decisions D001–D099 — [Project]` (child of the Decision Log), one section per decision:

```
## D### — [title]
Decision: … · Why: … · Alternatives rejected: … · Consequences: [incl. what a choice against the recommendation obliges] · Supersedes / Amends: … · Source: [interview / retro / refinement, date]
```

## Parking Lot — [Project]

```
## Ideas
| Idea | Raised | Why parked | Earmark | Link |
## Rejected
| Idea | Date | By | Why |
## Change history
```

An idea promoted into an iteration leaves this page: its row moves to that iteration's `## Scope changes` with the decision id.

## Working Agreements — [Project]

```
## Rules in force
| Rule | Kind (process / planning / operator / ops) | Since | Source | Applies to |
## Retired
| Rule | Retired | Why |
## Change history
```

One rule per row, imperative and testable. Changing a rule retires the old row and adds the new one.

## Debt Register — [Project] (in Extras)

```
## Open
| Item | Source (Retro N / Closeout N) | Jira | Size | Target |
## Closed
| Item | Closed | How |
## Change history
```
