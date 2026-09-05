# Sprint Shared-File Audit Workflow

**Script:** bundled with this skill at `scripts/sprint-shared-file-audit.sh`.
**Invoke via the plugin root** so it resolves when installed as a plugin (cwd is the consumer repo, not the skill dir):

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/agile-8-refinement/scripts/sprint-shared-file-audit.sh" ...
```

The `./scripts/sprint-shared-file-audit.sh` form used in the examples below is shorthand — on Claude Code substitute the `${CLAUDE_PLUGIN_ROOT}`-prefixed path; on Codex use the script path relative to this loaded skill directory.

**Watchlist:** optional, per-repo, format: one path per line (`#` for comments)

---

## Purpose

Surface cross-story file collisions **before** sprint planning so the PM can
add `blocks` / `is blocked by` Jira links proactively. Reduces merge-time
conflicts and the postmortem class of bug "two stories silently raced to
modify the same file."

---

## When to run

During **refinement** (this skill), after story scope is set and file-level
"Technical notes" are added to each Jira ticket — before sprint start.

---

## Setup

```bash
export JIRA_BASE_URL=https://yourorg.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=<your-atlassian-api-token>
export JIRA_PROJECT=ABC                # or pass via --project ABC
```

Optional: create a per-repo watchlist of always-shared files (any single story
touching one triggers a warning). One path per line, `#` for comments:

```
# ./scripts/lib/shared-file-watchlist.txt
CLAUDE.md
AGENTS.md
docker-compose.yml
.env.example
# add stack-specific always-shared files here:
# backend/scheduler/main.py
# backend/shared/celery_app.py
```

Pass via `-w` on each invocation. Omit entirely to skip the watchlist section.

---

## Invocation modes

### Explicit story keys (live)

```bash
./scripts/sprint-shared-file-audit.sh ABC-28 ABC-30 ABC-39 ABC-40 ABC-41
```

### Full sprint via JQL (live)

```bash
./scripts/sprint-shared-file-audit.sh --project ABC --sprint "Sprint 5"
```

Fetches all tickets in the named sprint from Jira.

### Offline fixture mode (no Jira credentials)

```bash
./scripts/sprint-shared-file-audit.sh \
  --fixture ./my-sprint-fixture.tsv \
  ABC-28 ABC-30 ABC-39 ABC-40 ABC-41
```

Fixture TSV format: `STORY_KEY<TAB>file1<TAB>file2 ...`

### Custom watchlist

```bash
./scripts/sprint-shared-file-audit.sh -w ./scripts/lib/shared-file-watchlist.txt ABC-28 ABC-30
```

### Verbose output

```bash
./scripts/sprint-shared-file-audit.sh -v ABC-28 ABC-30
```

Prints raw extracted text per story — useful when live extraction misses paths.

---

## How to interpret output

Two sections may appear:

### COLLISIONS

Files touched by **≥2 stories** in this sprint. Immediate coordination points
— if two stories both modify the same file, there is a merge risk and likely
a sequencing dependency.

```
=== COLLISIONS (file touched by ≥2 stories) ===

COUNT  FILE                            STORIES
-----  ----                            -------
3      backend/scheduler/main.py       ABC-39 ABC-40 ABC-41
2      backend/worker/ingest.py        ABC-28 ABC-30
```

### WATCHLIST HITS

Files on the always-shared watchlist touched by **≥1 story**. Even a single
story touching these files should be flagged as a coordination point — another
story may add scope later.

---

## How to act on findings

For each collision row:

1. Open both Jira tickets.
2. Determine sequencing: smaller key number = earlier scheduled, **unless** sprint order or dependency says otherwise.
3. On the blocking ticket: add link `blocks → [later ticket]`.
4. On the blocked ticket: link is auto-added as `is blocked by ← [earlier ticket]`.
5. Add a comment on both tickets noting the shared file and why the link was added.

**Link direction heuristic:** Smaller Jira key = earlier work unless explicit sprint ordering overrides. When unclear, ask in sprint planning and document the decision.

**Watchlist-only hits (count=1):** No Jira link required, but flag in sprint planning so the team is aware and can add scope protection.

---

## Exit codes

| Code | Meaning |
|------|---------|
| 0    | No collisions, no watchlist hits |
| 1    | Collisions or watchlist hits detected |
| 2    | Argument or environment error |

CI-friendly: pipe through your CI's failure handler if you want refinement
gated by zero collisions.

---

## Improving detection accuracy

Live Jira extraction works best when ticket "Technical notes" sections
explicitly name file paths (e.g., `backend/scheduler/main.py`). During
refinement, instruct PM / dev to add a "Files touched" bullet to each ticket's
technical notes. This maximises script coverage; otherwise the watchlist
catches always-shared files as a safety net.

You can also override the path-extraction regex via env vars:

```bash
FILE_REGEX='(my-service|my-lib)/[A-Za-z0-9_./*-]+\.(py|ts)' \
ROOT_FILES_REGEX='(MAKEFILE|CLAUDE\.md)' \
  ./scripts/sprint-shared-file-audit.sh ...
```
